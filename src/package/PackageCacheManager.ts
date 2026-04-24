/**
 * 包缓存管理器
 *
 * 优化策略：最小化写入次数
 * - 上传：写 pkg:{name} + index:all（2次写入）
 * - 删除：只删除 pkg:{name}（1次写入）
 * - 读取：懒清理 index:all 中的无效包名
 */

import { PackageMetadata, PackageInfo, CacheData } from "./Package";

interface ArchIndex {
  packages: string[];
  updated: number;
}

export class PackageCacheManager {
  private static readonly ALL_INDEX_KEY = "index:all";

  static async savePackage(
    env: Env,
    packageName: string,
    r2Key: string,
    metadata: Partial<PackageMetadata>
  ): Promise<void> {
    const now = Date.now();
    const archs = metadata.arch || [];

    const cacheData: CacheData = {
      key: r2Key,
      metadata,
      updated: now,
      archs,
    };

    await env.SPKS_CACHE.put(
      `pkg:${packageName}`,
      JSON.stringify(cacheData)
    );

    await this.addToAllIndex(env, packageName);
  }

  static async deletePackage(
    env: Env,
    packageName: string
  ): Promise<void> {
    await env.SPKS_CACHE.delete(`pkg:${packageName}`);
  }

  static async getAllPackageNames(env: Env): Promise<string[]> {
    const indexValue = await env.SPKS_CACHE.get(this.ALL_INDEX_KEY);

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

  static async getPackagesByArch(
    env: Env,
    arch: string,
    baseUrl: string
  ): Promise<PackageInfo[]> {
    const allNames = await this.getAllPackageNames(env);

    if (allNames.length === 0) {
      return [];
    }

    const packages: PackageInfo[] = [];
    const validNames: string[] = [];

    for (const name of allNames) {
      const cacheKey = `pkg:${name}`;
      const cacheValue = await env.SPKS_CACHE.get(cacheKey);

      if (!cacheValue) {
        continue;
      }

      try {
        const cacheData: CacheData = JSON.parse(cacheValue);
        const pkgArch = cacheData.archs || [];

        if (pkgArch.includes(arch) || pkgArch.includes("noarch")) {
          const metadata: PackageMetadata = {
            package: cacheData.metadata.package || name,
            version: cacheData.metadata.version || "unknown",
            displayname: cacheData.metadata.displayname || cacheData.metadata.package || name,
            description: cacheData.metadata.description || "",
            arch: cacheData.metadata.arch || [],
            thumbnail: cacheData.metadata.thumbnail || [],
            thumbnail_url: cacheData.metadata.thumbnail_url || [],
            snapshot: cacheData.metadata.snapshot || [],
            snapshot_url: cacheData.metadata.snapshot_url || [],
            maintainer: cacheData.metadata.maintainer,
            maintainer_url: cacheData.metadata.maintainer_url,
            beta: cacheData.metadata.beta,
            firmware: cacheData.metadata.firmware,
            qinst: cacheData.metadata.qinst,
            qupgrade: cacheData.metadata.qupgrade,
            qstart: cacheData.metadata.qstart,
            spk: cacheData.key,
            spk_url: "",
            silent_install: cacheData.metadata.silent_install,
            silent_uninstall: cacheData.metadata.silent_uninstall,
            silent_upgrade: cacheData.metadata.silent_upgrade,
            checksum: cacheData.metadata.checksum,
          };

          packages.push({
            key: cacheData.key,
            filename: cacheData.key.replace("packages/", ""),
            size: 0,
            lastModified: new Date(cacheData.updated).toISOString(),
            metadata,
          });
        }

        validNames.push(name);
      } catch {
        continue;
      }
    }

    if (validNames.length !== allNames.length) {
      await this.rebuildAllIndex(env, validNames);
    }

    for (const pkg of packages) {
      pkg.metadata.spk_url = `${baseUrl}/packages/${pkg.filename}`;
    }

    return packages;
  }

  static async getPackage(env: Env, packageName: string): Promise<PackageInfo | null> {
    const cacheValue = await env.SPKS_CACHE.get(`pkg:${packageName}`);

    if (!cacheValue) {
      return null;
    }

    try {
      const cacheData: CacheData = JSON.parse(cacheValue);
      return {
        key: cacheData.key,
        filename: cacheData.key.replace("packages/", ""),
        size: 0,
        lastModified: new Date(cacheData.updated).toISOString(),
        metadata: {
          package: cacheData.metadata.package || packageName,
          version: cacheData.metadata.version || "unknown",
          displayname: cacheData.metadata.displayname || cacheData.metadata.package || packageName,
          description: cacheData.metadata.description || "",
          arch: cacheData.metadata.arch || [],
          thumbnail: cacheData.metadata.thumbnail || [],
          thumbnail_url: cacheData.metadata.thumbnail_url || [],
          snapshot: cacheData.metadata.snapshot || [],
          snapshot_url: cacheData.metadata.snapshot_url || [],
          maintainer: cacheData.metadata.maintainer,
          maintainer_url: cacheData.metadata.maintainer_url,
          beta: cacheData.metadata.beta,
          firmware: cacheData.metadata.firmware,
          qinst: cacheData.metadata.qinst,
          qupgrade: cacheData.metadata.qupgrade,
          qstart: cacheData.metadata.qstart,
          spk: cacheData.key,
          spk_url: "",
          silent_install: cacheData.metadata.silent_install,
          silent_uninstall: cacheData.metadata.silent_uninstall,
          silent_upgrade: cacheData.metadata.silent_upgrade,
          checksum: cacheData.metadata.checksum,
        },
      };
    } catch {
      return null;
    }
  }

  private static async addToAllIndex(
    env: Env,
    packageName: string
  ): Promise<void> {
    const indexValue = await env.SPKS_CACHE.get(this.ALL_INDEX_KEY);
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

    await env.SPKS_CACHE.put(this.ALL_INDEX_KEY, JSON.stringify(index));
  }

  private static async rebuildAllIndex(
    env: Env,
    validPackages: string[]
  ): Promise<void> {
    const index: ArchIndex = {
      packages: validPackages,
      updated: Date.now(),
    };

    await env.SPKS_CACHE.put(this.ALL_INDEX_KEY, JSON.stringify(index));
  }
}
