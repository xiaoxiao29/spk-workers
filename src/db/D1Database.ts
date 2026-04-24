/**
 * D1 数据库操作封装
 *
 * 提供 D1 数据库的基础 SQL 操作
 */

import { PackageMetadata, PackageInfo, normalizeArchs } from "../package/Package";
import { CacheKeyBuilder } from "../utils/CacheKeyBuilder";

// 完整的数据库初始化 SQL 脚本
const FULL_SCHEMA_SQL = `-- =============================================================================
-- SSPKS 完整数据库架构
-- 
-- 项目: Simple SPK Server
-- 版本: 1.0.0
-- 创建时间: 2026-04-24
-- 
-- 描述: 完整的数据库初始化脚本，包含所有表结构、索引和字段
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 删除现有表（如果存在）
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS downloads;
DROP TABLE IF EXISTS package_arch;
DROP TABLE IF EXISTS packages;

-- -----------------------------------------------------------------------------
-- 2. 创建 packages 表 - 存储包的元数据信息
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS packages (
  id TEXT PRIMARY KEY,
  r2_key TEXT NOT NULL,
  version TEXT NOT NULL,
  displayname TEXT,
  description TEXT DEFAULT '',
  maintainer TEXT,
  maintainer_url TEXT,
  distributor TEXT,
  distributor_url TEXT,
  support_url TEXT,
  helpurl TEXT,
  arch TEXT DEFAULT '[]',
  firmware TEXT,
  beta INTEGER DEFAULT 0,
  thumbnail_url TEXT DEFAULT '',
  size INTEGER DEFAULT 0,
  checksum TEXT DEFAULT '',
  download_count INTEGER DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER
);

-- -----------------------------------------------------------------------------
-- 3. 创建 package_arch 表 - 存储包与架构的关联关系
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS package_arch (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  package_id TEXT NOT NULL,
  arch TEXT NOT NULL,
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
  UNIQUE(package_id, arch)
);

-- -----------------------------------------------------------------------------
-- 4. 创建 downloads 表 - 存储下载记录
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS downloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  package_id TEXT NOT NULL,
  arch TEXT,
  firmware_build TEXT,
  ip_address TEXT,
  user_agent TEXT,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- 5. 创建索引
-- -----------------------------------------------------------------------------

-- 基础索引
CREATE INDEX IF NOT EXISTS idx_arch ON package_arch(arch);
CREATE INDEX IF NOT EXISTS idx_packages_updated ON packages(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_packages_displayname ON packages(displayname);
CREATE INDEX IF NOT EXISTS idx_package_arch_composite ON package_arch(arch, package_id);
CREATE INDEX IF NOT EXISTS idx_packages_created_at ON packages(created_at DESC);

-- 性能优化索引
CREATE INDEX IF NOT EXISTS idx_packages_arch_displayname ON packages(arch, displayname);
CREATE INDEX IF NOT EXISTS idx_packages_search ON packages(displayname, description);

-- 下载统计索引
CREATE INDEX IF NOT EXISTS idx_downloads_package ON downloads(package_id);
CREATE INDEX IF NOT EXISTS idx_downloads_timestamp ON downloads(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_downloads_ip ON downloads(ip_address);

-- -----------------------------------------------------------------------------
-- 6. 优化查询
-- -----------------------------------------------------------------------------
PRAGMA optimize;`;

// 仅创建表结构的 SQL 脚本（不删除现有表）
const CREATE_SCHEMA_SQL = `-- =============================================================================
-- SSPKS 数据库初始化
-- 
-- 描述: 创建数据库表结构和索引（不删除现有表）
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 创建 packages 表 - 存储包的元数据信息
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS packages (
  id TEXT PRIMARY KEY,
  r2_key TEXT NOT NULL,
  version TEXT NOT NULL,
  displayname TEXT,
  description TEXT DEFAULT '',
  maintainer TEXT,
  maintainer_url TEXT,
  distributor TEXT,
  distributor_url TEXT,
  support_url TEXT,
  helpurl TEXT,
  arch TEXT DEFAULT '[]',
  firmware TEXT,
  beta INTEGER DEFAULT 0,
  thumbnail_url TEXT DEFAULT '',
  size INTEGER DEFAULT 0,
  checksum TEXT DEFAULT '',
  download_count INTEGER DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER
);

-- -----------------------------------------------------------------------------
-- 2. 创建 package_arch 表 - 存储包与架构的关联关系
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS package_arch (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  package_id TEXT NOT NULL,
  arch TEXT NOT NULL,
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
  UNIQUE(package_id, arch)
);

-- -----------------------------------------------------------------------------
-- 3. 创建 downloads 表 - 存储下载记录
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS downloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  package_id TEXT NOT NULL,
  arch TEXT,
  firmware_build TEXT,
  ip_address TEXT,
  user_agent TEXT,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- 4. 创建索引
-- -----------------------------------------------------------------------------

-- 基础索引
CREATE INDEX IF NOT EXISTS idx_arch ON package_arch(arch);
CREATE INDEX IF NOT EXISTS idx_packages_updated ON packages(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_packages_displayname ON packages(displayname);
CREATE INDEX IF NOT EXISTS idx_package_arch_composite ON package_arch(arch, package_id);
CREATE INDEX IF NOT EXISTS idx_packages_created_at ON packages(created_at DESC);

-- 性能优化索引
CREATE INDEX IF NOT EXISTS idx_packages_arch_displayname ON packages(arch, displayname);
CREATE INDEX IF NOT EXISTS idx_packages_search ON packages(displayname, description);

-- 下载统计索引
CREATE INDEX IF NOT EXISTS idx_downloads_package ON downloads(package_id);
CREATE INDEX IF NOT EXISTS idx_downloads_timestamp ON downloads(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_downloads_ip ON downloads(ip_address);

-- -----------------------------------------------------------------------------
-- 5. 优化查询
-- -----------------------------------------------------------------------------
PRAGMA optimize;`;

export class D1Database {
  /**
   * 初始化数据库表和索引
   */
  async initialize(env: Env, recreateTables: boolean = false): Promise<void> {
    const db = env.SPKS_DB;

    // 根据是否需要重建表结构选择不同的 SQL 脚本
    const sql = recreateTables ? FULL_SCHEMA_SQL : CREATE_SCHEMA_SQL;
    
    // 执行 SQL 脚本
    await db.exec(sql);
  }

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

    if (existing) {
      await db
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
        .run();
    } else {
      await db
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
        .run();
    }

    await db
      .prepare("DELETE FROM package_arch WHERE package_id = ?")
      .bind(packageName)
      .run();

    const uniqueArchs = [...new Set(archs)];
    const allArchs = uniqueArchs.includes("noarch") ? uniqueArchs : [...uniqueArchs, "noarch"];

    const batch = allArchs.map(arch =>
      db
        .prepare("INSERT OR IGNORE INTO package_arch (package_id, arch) VALUES (?, ?)")
        .bind(packageName, arch)
    );
    
    await db.batch(batch);
  }

  async deletePackage(env: Env, packageName: string): Promise<void> {
    const db = env.SPKS_DB;

    const archResult = await db
      .prepare("SELECT arch FROM package_arch WHERE package_id = ?")
      .bind(packageName)
      .all();
    const archs = archResult.results.map((row) => row.arch as string);

    await db.prepare("DELETE FROM package_arch WHERE package_id = ?").bind(packageName).run();
    await db.prepare("DELETE FROM packages WHERE id = ?").bind(packageName).run();

    await this.invalidateKVCache(env, packageName, archs);
  }

  private async invalidateKVCache(env: Env, packageName: string, archs: string[]): Promise<void> {
    try {
      await env.SPKS_CACHE.delete(CacheKeyBuilder.forPackage(packageName));

      for (const arch of archs) {
        await this.removeFromArchIndex(env, arch, packageName);
      }
      if (!archs.includes("noarch")) {
        await this.removeFromArchIndex(env, "noarch", packageName);
      }

      await this.removeFromAllIndex(env, packageName);
    } catch (e) {
      console.warn("Failed to invalidate KV cache during D1 delete:", e);
    }
  }

  private async removeFromArchIndex(env: Env, arch: string, packageName: string): Promise<void> {
    const indexKey = CacheKeyBuilder.forArchIndex(arch);
    const indexValue = await env.SPKS_CACHE.get(indexKey);
    if (!indexValue) return;

    try {
      const index = JSON.parse(indexValue);
      index.packages = index.packages.filter((p: string) => p !== packageName);
      index.updated = Date.now();

      if (index.packages.length > 0) {
        await env.SPKS_CACHE.put(indexKey, JSON.stringify(index));
      } else {
        await env.SPKS_CACHE.delete(indexKey);
      }
    } catch (e) {
      console.warn(`Failed to remove from arch index ${arch}:`, e);
    }
  }

  private async removeFromAllIndex(env: Env, packageName: string): Promise<void> {
    const indexKey = CacheKeyBuilder.forAllIndex();
    const indexValue = await env.SPKS_CACHE.get(indexKey);
    if (!indexValue) return;

    try {
      const index = JSON.parse(indexValue);
      index.packages = index.packages.filter((p: string) => p !== packageName);
      index.updated = Date.now();

      if (index.packages.length > 0) {
        await env.SPKS_CACHE.put(indexKey, JSON.stringify(index));
      } else {
        await env.SPKS_CACHE.delete(indexKey);
      }
    } catch (e) {
      console.warn("Failed to remove from all index:", e);
    }
  }

  async getPackage(env: Env, packageName: string): Promise<PackageInfo | null> {
    const db = env.SPKS_DB;

    const result = await db
      .prepare("SELECT * FROM packages WHERE id = ?")
      .bind(packageName)
      .first();

    if (!result) {
      return null;
    }

    return this.rowToPackageInfo(result, env);
  }

  async getPackagesByArch(
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
      this.rowToPackageInfo(row, env, baseUrl)
    );
  }

  async getAllPackageNames(env: Env): Promise<string[]> {
    const db = env.SPKS_DB;

    const result = await db
      .prepare("SELECT id FROM packages ORDER BY updated_at DESC")
      .all();

    return result.results.map((row) => row.id as string);
  }

  private rowToPackageInfo(
    row: Record<string, unknown>,
    env: Env,
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
