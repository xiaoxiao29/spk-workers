/**
 * 缓存预热器
 *
 * 在 Worker 启动时预加载热门数据，减少冷启动延迟
 */

import { IStorage } from "../db/IStorage";
import { StorageFactory } from "../db/StorageFactory";

interface WarmupConfig {
  enabled: boolean;
  popularPackages: string[];
  popularArchs: string[];
  maxConcurrent: number;
}

const DEFAULT_WARMUP_CONFIG: WarmupConfig = {
  enabled: true,
  popularPackages: ["nginx", "nodejs", "python", "redis", "mysql"],
  popularArchs: ["x86_64", "armv7", "aarch64"],
  maxConcurrent: 3,
};

export class CacheWarmer {
  private static warmupStatus: {
    lastWarmup: number;
    packagesWarmed: number;
    errors: string[];
  } = {
    lastWarmup: 0,
    packagesWarmed: 0,
    errors: [],
  };

  static async warmup(
    env: Env,
    baseUrl: string,
    config: Partial<WarmupConfig> = {}
  ): Promise<void> {
    const finalConfig = { ...DEFAULT_WARMUP_CONFIG, ...config };

    if (!finalConfig.enabled) {
      console.log("Cache warmup is disabled");
      return;
    }

    const startTime = Date.now();
    console.log("Starting cache warmup...");

    try {
      const storage = StorageFactory.createStorage(
        env.SSPKS_STORAGE_BACKEND || "hybrid"
      );

      await this.warmupPackages(env, storage, finalConfig);

      await this.warmupArchIndexes(env, storage, baseUrl, finalConfig);

      const duration = Date.now() - startTime;
      console.log(`Cache warmup completed in ${duration}ms`);

      this.warmupStatus.lastWarmup = Date.now();
    } catch (e) {
      console.error("Cache warmup failed:", e);
      this.warmupStatus.errors.push(
        `${new Date().toISOString()}: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  private static async warmupPackages(
    env: Env,
    storage: IStorage,
    config: WarmupConfig
  ): Promise<void> {
    console.log(`Warming up ${config.popularPackages.length} popular packages...`);

    const batches = this.chunkArray(config.popularPackages, config.maxConcurrent);

    for (const batch of batches) {
      await Promise.all(
        batch.map(async (packageName) => {
          try {
            const pkg = await storage.getPackage(env, packageName);
            if (pkg) {
              this.warmupStatus.packagesWarmed++;
              console.log(`Warmed up package: ${packageName}`);
            }
          } catch (e) {
            console.warn(`Failed to warmup package ${packageName}:`, e);
          }
        })
      );
    }
  }

  private static async warmupArchIndexes(
    env: Env,
    storage: IStorage,
    baseUrl: string,
    config: WarmupConfig
  ): Promise<void> {
    console.log(`Warming up ${config.popularArchs.length} architecture indexes...`);

    for (const arch of config.popularArchs) {
      try {
        const packages = await storage.getPackagesByArch(env, arch, baseUrl);
        console.log(`Warmed up ${packages.length} packages for arch: ${arch}`);
      } catch (e) {
        console.warn(`Failed to warmup arch ${arch}:`, e);
      }
    }
  }

  private static chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  static getWarmupStatus(): {
    lastWarmup: number;
    packagesWarmed: number;
    errors: string[];
  } {
    return { ...this.warmupStatus };
  }

  static resetStatus(): void {
    this.warmupStatus = {
      lastWarmup: 0,
      packagesWarmed: 0,
      errors: [],
    };
  }

  static async warmupIfNeeded(
    env: Env,
    baseUrl: string,
    intervalMs: number = 3600000
  ): Promise<void> {
    const now = Date.now();
    const timeSinceLastWarmup = now - this.warmupStatus.lastWarmup;

    if (timeSinceLastWarmup >= intervalMs) {
      console.log("Cache warmup interval reached, starting warmup...");
      await this.warmup(env, baseUrl);
    } else {
      console.log(
        `Cache warmup not needed, last warmup was ${Math.round(timeSinceLastWarmup / 1000)}s ago`
      );
    }
  }
}
