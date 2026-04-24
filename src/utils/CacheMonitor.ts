/**
 * 缓存监控器
 *
 * 提供缓存性能监控和统计功能
 */

export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  totalRequests: number;
  avgLatency: number;
  lastUpdated: number;
}

export interface CacheMetricData {
  date: string;
  hits: number;
  misses: number;
  totalLatency: number;
  requestCount: number;
}

export class CacheMonitor {
  private static readonly METRICS_KEY = "_internal:cache_metrics";
  private static readonly METRICS_TTL = 86400 * 7;

  static getToday(): string {
    return new Date().toISOString().split("T")[0];
  }

  static async recordHit(
    env: Env,
    cacheType: string,
    latency: number
  ): Promise<void> {
    await this.updateMetrics(env, cacheType, true, latency);
  }

  static async recordMiss(
    env: Env,
    cacheType: string,
    latency: number
  ): Promise<void> {
    await this.updateMetrics(env, cacheType, false, latency);
  }

  private static async updateMetrics(
    env: Env,
    cacheType: string,
    isHit: boolean,
    latency: number
  ): Promise<void> {
    const metricsKey = `${this.METRICS_KEY}:${cacheType}:${this.getToday()}`;

    try {
      const existingData = await env.SPKS_CACHE.get(metricsKey);
      let metrics: CacheMetricData;

      if (existingData) {
        metrics = JSON.parse(existingData);
        if (metrics.date !== this.getToday()) {
          metrics = this.createEmptyMetrics();
        }
      } else {
        metrics = this.createEmptyMetrics();
      }

      if (isHit) {
        metrics.hits++;
      } else {
        metrics.misses++;
      }

      metrics.totalLatency += latency;
      metrics.requestCount++;

      await env.SPKS_CACHE.put(metricsKey, JSON.stringify(metrics), {
        expirationTtl: this.METRICS_TTL,
      });
    } catch (e) {
      console.warn("Failed to update cache metrics:", e);
    }
  }

  private static createEmptyMetrics(): CacheMetricData {
    return {
      date: this.getToday(),
      hits: 0,
      misses: 0,
      totalLatency: 0,
      requestCount: 0,
    };
  }

  static async getMetrics(env: Env, cacheType: string): Promise<CacheMetrics> {
    const metricsKey = `${this.METRICS_KEY}:${cacheType}:${this.getToday()}`;

    try {
      const data = await env.SPKS_CACHE.get(metricsKey);

      if (!data) {
        return this.getEmptyMetrics();
      }

      const metrics: CacheMetricData = JSON.parse(data);
      const totalRequests = metrics.hits + metrics.misses;
      const avgLatency =
        metrics.requestCount > 0
          ? metrics.totalLatency / metrics.requestCount
          : 0;

      return {
        hits: metrics.hits,
        misses: metrics.misses,
        hitRate: totalRequests > 0 ? (metrics.hits / totalRequests) * 100 : 0,
        totalRequests,
        avgLatency: Math.round(avgLatency * 100) / 100,
        lastUpdated: Date.now(),
      };
    } catch (e) {
      console.warn("Failed to get cache metrics:", e);
      return this.getEmptyMetrics();
    }
  }

  static async getAllMetrics(env: Env): Promise<Record<string, CacheMetrics>> {
    const cacheTypes = ["package", "arch_index", "all_index", "device_config"];
    const results: Record<string, CacheMetrics> = {};

    for (const type of cacheTypes) {
      results[type] = await this.getMetrics(env, type);
    }

    return results;
  }

  private static getEmptyMetrics(): CacheMetrics {
    return {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalRequests: 0,
      avgLatency: 0,
      lastUpdated: Date.now(),
    };
  }

  static async resetMetrics(env: Env, cacheType?: string): Promise<void> {
    if (cacheType) {
      const metricsKey = `${this.METRICS_KEY}:${cacheType}:${this.getToday()}`;
      await env.SPKS_CACHE.delete(metricsKey);
    } else {
      const cacheTypes = [
        "package",
        "arch_index",
        "all_index",
        "device_config",
      ];
      for (const type of cacheTypes) {
        const metricsKey = `${this.METRICS_KEY}:${type}:${this.getToday()}`;
        await env.SPKS_CACHE.delete(metricsKey);
      }
    }
  }

  static formatMetricsReport(metrics: CacheMetrics): string {
    return `
缓存性能报告
====================
总请求数: ${metrics.totalRequests}
命中次数: ${metrics.hits}
未命中次数: ${metrics.misses}
命中率: ${metrics.hitRate.toFixed(2)}%
平均延迟: ${metrics.avgLatency}ms
最后更新: ${new Date(metrics.lastUpdated).toLocaleString("zh-CN")}
    `.trim();
  }
}
