/**
 * 缓存降级处理器
 *
 * 实现熔断器模式，在 KV 不可用时自动降级
 */

export type CircuitState = "closed" | "open" | "half-open";

interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  halfOpenMaxCalls: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  recoveryTimeout: 60000,
  halfOpenMaxCalls: 3,
};

class CircuitBreaker {
  private state: CircuitState = "closed";
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private halfOpenCalls: number = 0;

  constructor(private config: CircuitBreakerConfig = DEFAULT_CONFIG) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (this.shouldAttemptReset()) {
        this.state = "half-open";
        this.halfOpenCalls = 0;
      } else {
        throw new Error("Circuit breaker is open");
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (e) {
      this.onFailure();
      throw e;
    }
  }

  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime >= this.config.recoveryTimeout;
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === "half-open") {
      this.halfOpenCalls++;
      if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
        this.state = "closed";
        this.halfOpenCalls = 0;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === "half-open") {
      this.state = "open";
      this.halfOpenCalls = 0;
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.state = "open";
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats(): {
    state: CircuitState;
    failureCount: number;
    lastFailureTime: number;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  reset(): void {
    this.state = "closed";
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.halfOpenCalls = 0;
  }
}

export class CacheFallback {
  private static circuitBreakers: Map<string, CircuitBreaker> = new Map();

  private static getCircuitBreaker(key: string): CircuitBreaker {
    if (!this.circuitBreakers.has(key)) {
      this.circuitBreakers.set(key, new CircuitBreaker());
    }
    return this.circuitBreakers.get(key)!;
  }

  static async get<T>(
    env: Env,
    key: string,
    fallback: () => Promise<T>,
    cacheType: string = "default"
  ): Promise<T | null> {
    const circuitBreaker = this.getCircuitBreaker(cacheType);

    try {
      return await circuitBreaker.execute(async () => {
        const cached = await env.SPKS_CACHE.get(key);
        if (cached) {
          return JSON.parse(cached) as T;
        }
        return null;
      });
    } catch (e) {
      console.warn(
        `Cache fallback triggered for ${cacheType}:`,
        e instanceof Error ? e.message : String(e)
      );
      return null;
    }
  }

  static async put<T>(
    env: Env,
    key: string,
    value: T,
    options?: { expirationTtl?: number },
    cacheType: string = "default"
  ): Promise<boolean> {
    const circuitBreaker = this.getCircuitBreaker(cacheType);

    try {
      await circuitBreaker.execute(async () => {
        const putOptions = options?.expirationTtl
          ? { expirationTtl: options.expirationTtl }
          : undefined;
        await env.SPKS_CACHE.put(key, JSON.stringify(value), putOptions);
      });
      return true;
    } catch (e) {
      console.warn(
        `Cache write fallback triggered for ${cacheType}:`,
        e instanceof Error ? e.message : String(e)
      );
      return false;
    }
  }

  static async delete(
    env: Env,
    key: string,
    cacheType: string = "default"
  ): Promise<boolean> {
    const circuitBreaker = this.getCircuitBreaker(cacheType);

    try {
      await circuitBreaker.execute(async () => {
        await env.SPKS_CACHE.delete(key);
      });
      return true;
    } catch (e) {
      console.warn(
        `Cache delete fallback triggered for ${cacheType}:`,
        e instanceof Error ? e.message : String(e)
      );
      return false;
    }
  }

  static getCircuitState(cacheType: string): CircuitState {
    const circuitBreaker = this.getCircuitBreaker(cacheType);
    return circuitBreaker.getState();
  }

  static getAllCircuitStates(): Record<string, CircuitState> {
    const states: Record<string, CircuitState> = {};
    for (const [key, breaker] of this.circuitBreakers.entries()) {
      states[key] = breaker.getState();
    }
    return states;
  }

  static resetCircuit(cacheType?: string): void {
    if (cacheType) {
      const breaker = this.circuitBreakers.get(cacheType);
      if (breaker) {
        breaker.reset();
      }
    } else {
      for (const breaker of this.circuitBreakers.values()) {
        breaker.reset();
      }
    }
  }

  static getCircuitStats(cacheType: string): {
    state: CircuitState;
    failureCount: number;
    lastFailureTime: number;
  } {
    const circuitBreaker = this.getCircuitBreaker(cacheType);
    return circuitBreaker.getStats();
  }

  static async withFallback<T>(
    env: Env,
    key: string,
    fallback: () => Promise<T>,
    cacheType: string = "default",
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(env, key, fallback, cacheType);

    if (cached !== null) {
      return cached;
    }

    const result = await fallback();

    await this.put(env, key, result, ttl ? { expirationTtl: ttl } : undefined, cacheType);

    return result;
  }
}
