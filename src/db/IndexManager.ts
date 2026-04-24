/**
 * 索引管理器
 *
 * 统一管理 KV 存储中的架构索引和全局索引，
 * 避免 HybridStorage 和 KVStorage 中重复实现相同的索引操作逻辑
 */

import { CacheKeyBuilder, CACHE_TTL } from "../utils/CacheKeyBuilder";

interface ArchIndex {
  packages: string[];
  updated: number;
}

export class IndexManager {
  static async addToArchIndex(
    env: Env,
    arch: string,
    packageName: string
  ): Promise<void> {
    const indexKey = CacheKeyBuilder.forArchIndex(arch);
    const indexValue = await env.SPKS_CACHE.get(indexKey);
    const now = Date.now();

    let index: ArchIndex;
    if (indexValue) {
      index = JSON.parse(indexValue);
      if (!index.packages.includes(packageName)) {
        index.packages.push(packageName);
      }
      index.updated = now;
    } else {
      index = { packages: [packageName], updated: now };
    }

    await env.SPKS_CACHE.put(indexKey, JSON.stringify(index), {
      expirationTtl: CACHE_TTL.PACKAGE_LIST,
    });
  }

  static async removeFromArchIndex(
    env: Env,
    arch: string,
    packageName: string
  ): Promise<void> {
    const indexKey = CacheKeyBuilder.forArchIndex(arch);
    const indexValue = await env.SPKS_CACHE.get(indexKey);

    if (!indexValue) {
      return;
    }

    try {
      const index: ArchIndex = JSON.parse(indexValue);
      index.packages = index.packages.filter((p) => p !== packageName);
      index.updated = Date.now();

      if (index.packages.length > 0) {
        await env.SPKS_CACHE.put(indexKey, JSON.stringify(index), {
          expirationTtl: CACHE_TTL.PACKAGE_LIST,
        });
      } else {
        await env.SPKS_CACHE.delete(indexKey);
      }
    } catch (e) {
      console.warn(`Failed to remove from arch index ${arch}:`, e);
    }
  }

  static async getArchIndex(env: Env, arch: string): Promise<string[]> {
    const indexKey = CacheKeyBuilder.forArchIndex(arch);
    const indexValue = await env.SPKS_CACHE.get(indexKey);

    if (!indexValue) {
      return [];
    }

    try {
      const index: ArchIndex = JSON.parse(indexValue);
      return index.packages || [];
    } catch {
      return [];
    }
  }

  static async addToAllIndex(env: Env, packageName: string): Promise<void> {
    const indexKey = CacheKeyBuilder.forAllIndex();
    const indexValue = await env.SPKS_CACHE.get(indexKey);
    const now = Date.now();

    let index: ArchIndex;
    if (indexValue) {
      index = JSON.parse(indexValue);
      if (!index.packages.includes(packageName)) {
        index.packages.push(packageName);
      }
      index.updated = now;
    } else {
      index = { packages: [packageName], updated: now };
    }

    await env.SPKS_CACHE.put(indexKey, JSON.stringify(index), {
      expirationTtl: CACHE_TTL.PACKAGE_LIST,
    });
  }

  static async removeFromAllIndex(env: Env, packageName: string): Promise<void> {
    const indexKey = CacheKeyBuilder.forAllIndex();
    const indexValue = await env.SPKS_CACHE.get(indexKey);

    if (!indexValue) {
      return;
    }

    try {
      const index: ArchIndex = JSON.parse(indexValue);
      index.packages = index.packages.filter((p) => p !== packageName);
      index.updated = Date.now();

      if (index.packages.length > 0) {
        await env.SPKS_CACHE.put(indexKey, JSON.stringify(index), {
          expirationTtl: CACHE_TTL.PACKAGE_LIST,
        });
      } else {
        await env.SPKS_CACHE.delete(indexKey);
      }
    } catch (e) {
      console.warn("Failed to remove from all index:", e);
    }
  }

  static async getAllIndex(env: Env): Promise<string[]> {
    const indexKey = CacheKeyBuilder.forAllIndex();
    const indexValue = await env.SPKS_CACHE.get(indexKey);

    if (!indexValue) {
      return [];
    }

    try {
      const index: ArchIndex = JSON.parse(indexValue);
      return index.packages || [];
    } catch {
      return [];
    }
  }
}
