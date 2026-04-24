-- =============================================================================
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
PRAGMA optimize;