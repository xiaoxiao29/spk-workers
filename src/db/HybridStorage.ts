/**
 * 混合存储实现
 *
 * 使用 D1 数据库作为持久化存储，KV 作为缓存层
 * 上传时：保存到 D1 并清除 KV 缓存（保证一致性）
 * 查询时：先查 KV 缓存 → 没有则查 D1 → 缓存到 KV
 */

import { IStorage } from "./IStorage";
import { PackageMetadata, PackageInfo, normalizeArchs } from "../package/Package";
import { CACHE_TTL, CacheKeyBuilder } from "../utils/CacheKeyBuilder";
import { CacheMonitor } from "../utils/CacheMonitor";
import { IndexManager } from "./IndexManager";

interface CacheData {
  key: string;
  metadata: Partial<PackageMetadata>;
  updated: number;
  archs: string[];
}

export class HybridStorage implements IStorage {
  async savePackage(
    env: Env,
    packageName: string,
    r2Key: string,
    metadata: Partial<PackageMetadata>
  ): Promise<void> {
    const db = env.SPKS_DB;
    const now = Date.now();
    const archs = normalizeArchs(metadata.arch);

    const existing = await db
      .prepare("SELECT id FROM packages WHERE id = ?")
      .bind(packageName)
      .first();

    const uniqueArchs = [...new Set(archs)];
    const allArchs = uniqueArchs.includes("noarch") ? uniqueArchs : [...uniqueArchs, "noarch"];

    const batch: D1PreparedStatement[] = [];

    if (existing) {
      batch.push(
        db
          .prepare(`
            UPDATE packages SET
              r2_key = ?,
              version = ?,
              displayname = ?,
              description = ?,
              maintainer = ?,
              maintainer_url = ?,
              distributor = ?,
              distributor_url = ?,
              helpurl = ?,
              arch = ?,
              firmware = ?,
              beta = ?,
              thumbnail_url = ?,
              size = ?,
              checksum = ?,
              updated_at = ?
            WHERE id = ?
          `)
          .bind(
            r2Key,
            metadata.version || "unknown",
            metadata.displayname || packageName,
            metadata.description || "",
            metadata.maintainer || null,
            metadata.maintainer_url || null,
            metadata.distributor || null,
            metadata.distributor_url || null,
            metadata.helpurl || null,
            JSON.stringify(archs),
            metadata.firmware || null,
            metadata.beta ? 1 : 0,
            metadata.thumbnail_url?.[0] || "",
            metadata.size || 0,
            metadata.checksum || "",
            now,
            packageName
          )
      );
    } else {
      batch.push(
        db
          .prepare(`
            INSERT INTO packages (id, r2_key, version, displayname, description, maintainer, maintainer_url, distributor, distributor_url, helpurl, arch, firmware, beta, thumbnail_url, size, checksum, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            packageName,
            r2Key,
            metadata.version || "unknown",
            metadata.displayname || packageName,
            metadata.description || "",
            metadata.maintainer || null,
            metadata.maintainer_url || null,
            metadata.distributor || null,
            metadata.distributor_url || null,
            metadata.helpurl || null,
            JSON.stringify(archs),
            metadata.firmware || null,
            metadata.beta ? 1 : 0,
            metadata.thumbnail_url?.[0] || "",
            metadata.size || 0,
            metadata.checksum || "",
            now,
            now
          )
      );
    }

    batch.push(
      db.prepare("DELETE FROM package_arch WHERE package_id = ?").bind(packageName)
    );

    for (const arch of allArchs) {
      batch.push(
        db
          .prepare("INSERT OR IGNORE INTO package_arch (package_id, arch) VALUES (?, ?)")
          .bind(packageName, arch)
      );
    }

    await db.batch(batch);

    await this.invalidateCache(env, packageName);
  }

  async deletePackage(env: Env, packageName: string): Promise<void> {
    const db = env.SPKS_DB;

    const archResult = await db
      .prepare("SELECT arch FROM package_arch WHERE package_id = ?")
      .bind(packageName)
      .all();
    const dbArchs = archResult.results.map((row) => row.arch as string);

    await db.batch([
      db.prepare("DELETE FROM package_arch WHERE package_id = ?").bind(packageName),
      db.prepare("DELETE FROM packages WHERE id = ?").bind(packageName),
    ]);

    await this.invalidateCache(env, packageName, dbArchs);
  }

  async getPackage(env: Env, packageName: string): Promise<PackageInfo | null> {
    const cached = await this.getFromKV(env, packageName);
    if (cached) {
      return cached;
    }

    const fromD1 = await this.getFromD1(env, packageName);
    if (fromD1) {
      await this.cacheToKV(env, packageName, fromD1);
      return fromD1;
    }

    return null;
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

    const fromD1 = await this.getPackagesByArchFromD1(env, arch, baseUrl);

    try {
      await env.SPKS_CACHE.put(archListKey, JSON.stringify(fromD1), {
        expirationTtl: CACHE_TTL.PACKAGE_LIST,
      });
    } catch (e) {
      console.warn("Failed to cache arch package list:", e);
    }

    for (const pkg of fromD1) {
      await this.cacheToKV(env, pkg.metadata.package, pkg);
    }
    return fromD1;
  }

  async getAllPackageNames(env: Env): Promise<string[]> {
    const cached = await IndexManager.getAllIndex(env);
    if (cached.length > 0) {
      return cached;
    }

    const fromD1 = await this.getAllPackageNamesFromD1(env);
    return fromD1;
  }

  private async getFromKV(env: Env, packageName: string): Promise<PackageInfo | null> {
    const startTime = Date.now();
    const cacheKey = CacheKeyBuilder.forPackage(packageName);
    const cacheValue = await env.SPKS_CACHE.get(cacheKey);

    if (!cacheValue) {
      const latency = Date.now() - startTime;
      await CacheMonitor.recordMiss(env, "package", latency);
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
        distributor: cacheData.metadata.distributor,
        distributor_url: cacheData.metadata.distributor_url,
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

      const latency = Date.now() - startTime;
      await CacheMonitor.recordHit(env, "package", latency);

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

  private async getFromD1(env: Env, packageName: string): Promise<PackageInfo | null> {
    const db = env.SPKS_DB;

    const result = await db
      .prepare("SELECT * FROM packages WHERE id = ?")
      .bind(packageName)
      .first();

    if (!result) {
      return null;
    }

    return this.rowToPackageInfo(result);
  }

  private async cacheToKV(
    env: Env,
    packageName: string,
    pkgInfo: PackageInfo
  ): Promise<void> {
    const cacheData: CacheData = {
      key: pkgInfo.key,
      metadata: pkgInfo.metadata,
      updated: new Date(pkgInfo.lastModified).getTime(),
      archs: pkgInfo.metadata.arch || [],
    };

    await env.SPKS_CACHE.put(
      CacheKeyBuilder.forPackage(packageName),
      JSON.stringify(cacheData),
      { expirationTtl: CACHE_TTL.PACKAGE_DETAIL }
    );

    const indexPromises: Promise<void>[] = [];
    for (const arch of cacheData.archs) {
      indexPromises.push(IndexManager.addToArchIndex(env, arch, packageName));
    }
    if (!cacheData.archs.includes("noarch")) {
      indexPromises.push(IndexManager.addToArchIndex(env, "noarch", packageName));
    }
    indexPromises.push(IndexManager.addToAllIndex(env, packageName));

    await Promise.all(indexPromises);
  }

  private async invalidateCache(env: Env, packageName: string, dbArchs: string[] = []): Promise<void> {
    const cacheKey = CacheKeyBuilder.forPackage(packageName);
    const cacheValue = await env.SPKS_CACHE.get(cacheKey);

    let archs: string[] = [];
    if (cacheValue) {
      try {
        const cacheData: CacheData = JSON.parse(cacheValue);
        archs = cacheData.archs || [];
      } catch (e) {
        console.error("Failed to parse cache during invalidation:", e);
      }
    }

    if (archs.length === 0) {
      archs = dbArchs;
    }

    await env.SPKS_CACHE.delete(cacheKey);

    const allArchs = archs.includes("noarch") ? archs : [...archs, "noarch"];
    const deletePromises = allArchs.map(arch =>
      env.SPKS_CACHE.delete(CacheKeyBuilder.forArchPackageList(arch))
    );
    deletePromises.push(env.SPKS_CACHE.delete(CacheKeyBuilder.forArchPackageList("noarch")));

    for (const arch of archs) {
      deletePromises.push(IndexManager.removeFromArchIndex(env, arch, packageName));
    }
    if (!archs.includes("noarch")) {
      deletePromises.push(IndexManager.removeFromArchIndex(env, "noarch", packageName));
    }

    deletePromises.push(IndexManager.removeFromAllIndex(env, packageName));

    await Promise.all(deletePromises);
  }

  private async getPackagesByArchFromD1(
    env: Env,
    arch: string,
    baseUrl: string
  ): Promise<PackageInfo[]> {
    const db = env.SPKS_DB;

    const result = await db
      .prepare(`
        SELECT p.* FROM packages p
        INNER JOIN package_arch pa ON p.id = pa.package_id
        WHERE pa.arch = ? OR pa.arch = 'noarch'
        ORDER BY p.updated_at DESC
      `)
      .bind(arch)
      .all();

    return result.results.map((row) =>
      this.rowToPackageInfo(row, baseUrl)
    );
  }

  private async getAllPackageNamesFromD1(env: Env): Promise<string[]> {
    const db = env.SPKS_DB;

    const result = await db
      .prepare("SELECT id FROM packages ORDER BY updated_at DESC")
      .all();

    return result.results.map((row) => row.id as string);
  }

  private rowToPackageInfo(
    row: Record<string, unknown>,
    baseUrl?: string
  ): PackageInfo {
    const archs = JSON.parse((row.arch as string) || "[]");
    const url = baseUrl || "";

    return {
      key: row.r2_key as string,
      filename: (row.r2_key as string).replace("packages/", ""),
      size: row.size as number,
      lastModified: new Date(row.updated_at as number).toISOString(),
      metadata: {
        package: row.id as string,
        version: row.version as string,
        displayname: (row.displayname as string) || (row.id as string),
        description: (row.description as string) || "",
        arch: archs,
        thumbnail: [],
        thumbnail_url: [(row.thumbnail_url as string) || ""],
        snapshot: [],
        snapshot_url: [],
        maintainer: row.maintainer as string | undefined,
        maintainer_url: row.maintainer_url as string | undefined,
        distributor: row.distributor as string | undefined,
        distributor_url: row.distributor_url as string | undefined,
        helpurl: row.helpurl as string | undefined,
        beta: row.beta ? true : false,
        firmware: row.firmware as string | undefined,
        spk: row.r2_key as string,
        spk_url: `${url}/packages/${(row.r2_key as string).replace("packages/", "")}`,
        checksum: row.checksum as string | undefined,
      },
    };
  }
}
