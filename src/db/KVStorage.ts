/**
 * KV 存储实现
 *
 * 使用 Cloudflare KV 存储包信息（保留作为回退方案）
 */

import { IStorage } from "./IStorage";
import { PackageMetadata, PackageInfo, normalizeArchs } from "../package/Package";
import { CACHE_TTL, CacheKeyBuilder } from "../utils/CacheKeyBuilder";
import { IndexManager } from "./IndexManager";

interface CacheData {
  key: string;
  metadata: Partial<PackageMetadata>;
  updated: number;
  archs: string[];
}

export class KVStorage implements IStorage {
  async savePackage(
    env: Env,
    packageName: string,
    r2Key: string,
    metadata: Partial<PackageMetadata>
  ): Promise<void> {
    const now = Date.now();
    const archs = normalizeArchs(metadata.arch);

    const cacheData: CacheData = {
      key: r2Key,
      metadata,
      updated: now,
      archs,
    };

    await env.SPKS_CACHE.put(CacheKeyBuilder.forPackage(packageName), JSON.stringify(cacheData), {
      expirationTtl: CACHE_TTL.PACKAGE_DETAIL
    });

    await IndexManager.addToAllIndex(env, packageName);
  }

  async deletePackage(env: Env, packageName: string): Promise<void> {
    const cacheKey = CacheKeyBuilder.forPackage(packageName);
    const cacheValue = await env.SPKS_CACHE.get(cacheKey);

    let archs: string[] = [];
    if (cacheValue) {
      try {
        const cacheData: CacheData = JSON.parse(cacheValue);
        archs = cacheData.archs || [];
      } catch (e) {
        console.error("Failed to parse cache during deletion:", e);
      }
    }

    await env.SPKS_CACHE.delete(cacheKey);

    const deletePromises: Promise<void>[] = [];
    for (const arch of archs) {
      deletePromises.push(IndexManager.removeFromArchIndex(env, arch, packageName));
    }
    if (!archs.includes("noarch")) {
      deletePromises.push(IndexManager.removeFromArchIndex(env, "noarch", packageName));
    }
    deletePromises.push(IndexManager.removeFromAllIndex(env, packageName));

    await Promise.all(deletePromises);
  }

  async getPackage(env: Env, packageName: string): Promise<PackageInfo | null> {
    const cacheKey = CacheKeyBuilder.forPackage(packageName);
    const cacheValue = await env.SPKS_CACHE.get(cacheKey);

    if (!cacheValue) {
      return null;
    }

    try {
      const cacheData: CacheData = JSON.parse(cacheValue);
      const metadata: PackageMetadata = {
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
        helpurl: cacheData.metadata.helpurl,
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

      return {
        key: cacheData.key,
        filename: cacheData.key.replace("packages/", ""),
        size: 0,
        lastModified: new Date(cacheData.updated).toISOString(),
        metadata,
      };
    } catch (e) {
      console.error("Failed to parse cache data:", e);
      return null;
    }
  }

  async getPackagesByArch(
    env: Env,
    arch: string,
    baseUrl: string
  ): Promise<PackageInfo[]> {
    const archListKey = CacheKeyBuilder.forArchPackageList(arch);
    const cachedList = await env.SPKS_CACHE.get(archListKey, { type: "json" });
    if (cachedList && Array.isArray(cachedList)) {
      const packages = cachedList as PackageInfo[];
      return packages.map(pkg => {
        pkg.metadata.spk_url = `${baseUrl}/packages/${pkg.filename}`;
        return pkg;
      });
    }

    const allNames = await this.getAllPackageNames(env);
    if (allNames.length === 0) {
      return [];
    }

    const packages: PackageInfo[] = [];
    for (const name of allNames) {
      const pkg = await this.getPackage(env, name);
      if (pkg) {
        const pkgArch = pkg.metadata.arch || [];
        if (pkgArch.includes(arch) || pkgArch.includes("noarch")) {
          pkg.metadata.spk_url = `${baseUrl}/packages/${pkg.filename}`;
          packages.push(pkg);
        }
      }
    }

    try {
      await env.SPKS_CACHE.put(archListKey, JSON.stringify(packages), {
        expirationTtl: CACHE_TTL.PACKAGE_LIST,
      });
    } catch (e) {
      console.warn("Failed to cache arch package list:", e);
    }

    return packages;
  }

  async getAllPackageNames(env: Env): Promise<string[]> {
    return await IndexManager.getAllIndex(env);
  }
}
