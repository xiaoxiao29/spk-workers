# export-data.mjs 使用说明

## 📋 目录

- [脚本概述](#脚本概述)
- [功能特性](#功能特性)
- [安装和配置](#安装和配置)
- [基本用法](#基本用法)
- [命令选项](#命令选项)
- [使用示例](#使用示例)
- [输出格式](#输出格式)
- [常见场景](#常见场景)
- [故障排除](#故障排除)
- [最佳实践](#最佳实践)

---

## 🎯 脚本概述

### 什么是 export-data.mjs？

`export-data.mjs` 是一个数据导出脚本，用于从 Cloudflare D1 数据库导出数据为 SQL 或 JSON 格式。

### 为什么需要这个脚本？

**Wrangler CLI 的局限性**：
- ❌ 没有直接的数据导出命令
- ❌ 只能手动查询并处理结果
- ❌ 不支持批量导出
- ❌ 不支持格式化输出

**export-data.mjs 的优势**：
- ✅ 一键导出所有数据
- ✅ 支持 SQL INSERT 格式
- ✅ 支持 JSON 格式
- ✅ 支持特定表导出
- ✅ 自动格式化和转义

---

## ✨ 功能特性

### 核心功能

| 功能 | 说明 | Wrangler CLI 对比 |
|------|------|------------------|
| **SQL 导出** | 生成 INSERT SQL 语句 | ❌ 不支持 |
| **JSON 导出** | 生成 JSON 格式数据 | ❌ 不支持 |
| **批量导出** | 一次导出多个表 | ❌ 不支持 |
| **特定表导出** | 只导出指定的表 | ❌ 不支持 |
| **文件输出** | 导出到文件 | ❌ 不支持 |
| **自动转义** | 自动处理特殊字符 | ❌ 不支持 |

### 导出格式

#### SQL 格式

```sql
-- =============================================================================
-- SSPKS 数据库数据导出
-- 
-- 导出时间: 2026-04-16T07:32:48.000Z
-- 总行数: 2
-- =============================================================================

-- Data for table: packages
-- Rows: 2

INSERT INTO packages (id, r2_key, version, displayname, description) VALUES ('nginx', 'packages/nginx.spk', '1.0.0', 'Nginx', 'High performance web server');
INSERT INTO packages (id, r2_key, version, displayname, description) VALUES ('redis', 'packages/redis.spk', '2.0.0', 'Redis', 'In-memory data structure store');
```

#### JSON 格式

```json
{
  "exported_at": "2026-04-16T07:32:48.000Z",
  "tables": {
    "packages": {
      "count": 2,
      "rows": [
        {
          "id": "nginx",
          "r2_key": "packages/nginx.spk",
          "version": "1.0.0",
          "displayname": "Nginx",
          "description": "High performance web server"
        },
        {
          "id": "redis",
          "r2_key": "packages/redis.spk",
          "version": "2.0.0",
          "displayname": "Redis",
          "description": "In-memory data structure store"
        }
      ]
    }
  }
}
```

---

## 🔧 安装和配置

### 前置要求

- Node.js >= 18.0.0
- Wrangler CLI >= 3.33.0
- 已登录 Cloudflare 账户
- 已创建 D1 数据库并有数据

### 安装步骤

脚本已包含在项目中，无需额外安装：

```bash
# 检查脚本是否存在
ls scripts/export-data.mjs

# 检查 package.json 命令
npm run db:export -- --help
```

### 配置说明

脚本默认导出以下表：
- `packages`
- `package_arch`

如需修改：

```javascript
// 编辑 scripts/export-data.mjs
// 修改默认导出的表
const tables = ALL_TABLES 
  ? ['packages', 'package_arch', 'your_table']  // 添加你的表
  : [TABLE_NAME];
```

---

## 🚀 基本用法

### 快速开始

```bash
# 导出所有数据（默认 SQL 格式）
npm run db:export
```

### 常用命令

```bash
# 导出到文件
npm run db:export -- --output backup.sql

# 导出为 JSON 格式
npm run db:export -- --format json --output backup.json

# 只导出特定表
npm run db:export:packages -- --output packages.sql
npm run db:export:arch -- --output arch.sql
```

---

## 📝 命令选项

### 选项列表

| 选项 | 说明 | 示例 |
|------|------|------|
| `--table <name>` | 导出指定表 | `npm run db:export -- --table packages` |
| `--all` | 导出所有表（默认） | `npm run db:export -- --all` |
| `--output <file>` | 输出到文件 | `npm run db:export -- --output backup.sql` |
| `--format <type>` | 输出格式（sql/json） | `npm run db:export -- --format json` |

### 选项组合

```bash
# 导出特定表到文件
npm run db:export -- --table packages --output packages.sql

# 导出所有表为 JSON 格式
npm run db:export -- --format json --output all_data.json

# 导出特定表为 JSON 格式
npm run db:export -- --table packages --format json --output packages.json
```

---

## 💡 使用示例

### 示例 1：导出所有数据

```bash
npm run db:export
```

**输出**：
```
ℹ === D1 Database Export ===

ℹ Exporting table: packages
✓ Exported 2 rows from packages

ℹ Exporting table: package_arch
✓ Exported 0 rows from package_arch

ℹ === Export Summary ===
ℹ   packages: 2 rows
ℹ   package_arch: 0 rows
ℹ   Total: 2 rows

-- =============================================================================
-- SSPKS 数据库数据导出
-- 
-- 导出时间: 2026-04-16T07:32:48.000Z
-- 总行数: 2
-- =============================================================================

-- Data for table: packages
-- Rows: 2

INSERT INTO packages (id, r2_key, version, displayname) VALUES ('nginx', 'packages/nginx.spk', '1.0.0', 'Nginx');
INSERT INTO packages (id, r2_key, version, displayname) VALUES ('redis', 'packages/redis.spk', '2.0.0', 'Redis');
```

### 示例 2：导出到文件

```bash
npm run db:export -- --output backup.sql
```

**输出**：
```
ℹ === D1 Database Export ===

ℹ Exporting table: packages
✓ Exported 2 rows from packages

ℹ Exporting table: package_arch
✓ Exported 0 rows from package_arch

ℹ === Export Summary ===
ℹ   packages: 2 rows
ℹ   package_arch: 0 rows
ℹ   Total: 2 rows

ℹ Writing to backup.sql...
✓ Export completed: backup.sql
```

### 示例 3：导出为 JSON 格式

```bash
npm run db:export -- --format json --output backup.json
```

**输出文件**：
```json
{
  "exported_at": "2026-04-16T07:32:48.000Z",
  "tables": {
    "packages": {
      "count": 2,
      "rows": [
        {
          "id": "nginx",
          "r2_key": "packages/nginx.spk",
          "version": "1.0.0",
          "displayname": "Nginx",
          "description": "High performance web server"
        },
        {
          "id": "redis",
          "r2_key": "packages/redis.spk",
          "version": "2.0.0",
          "displayname": "Redis",
          "description": "In-memory data structure store"
        }
      ]
    },
    "package_arch": {
      "count": 0,
      "rows": []
    }
  }
}
```

### 示例 4：导出特定表

```bash
# 只导出 packages 表
npm run db:export:packages -- --output packages.sql
```

**输出**：
```
ℹ === D1 Database Export ===

ℹ Exporting table: packages
✓ Exported 2 rows from packages

ℹ === Export Summary ===
ℹ   packages: 2 rows
ℹ   Total: 2 rows

ℹ Writing to packages.sql...
✓ Export completed: packages.sql
```

### 示例 5：使用 jq 处理 JSON 输出

```bash
# 导出为 JSON 并使用 jq 过滤
npm run db:export -- --format json | jq '.tables.packages.rows[] | {id, version}'

# 只获取特定版本的数据
npm run db:export -- --format json | jq '.tables.packages.rows[] | select(.version > "1.0.0")'

# 统计每个表的数据量
npm run db:export -- --format json | jq '.tables | to_entries[] | {table: .key, count: .value.count}'
```

---

## 📊 输出格式

### SQL 格式（默认）

**特点**：
- ✅ 生成 INSERT SQL 语句
- ✅ 自动转义特殊字符
- ✅ 可直接导入数据库
- ✅ 包含注释信息

**结构**：
```sql
-- =============================================================================
-- SSPKS 数据库数据导出
-- 
-- 导出时间: ISO时间戳
-- 总行数: 总数
-- =============================================================================

-- Data for table: 表名
-- Rows: 行数

INSERT INTO 表名 (列1, 列2, ...) VALUES (值1, 值2, ...);
INSERT INTO 表名 (列1, 列2, ...) VALUES (值1, 值2, ...);
...
```

**特殊字符处理**：
```javascript
// 自动转义单引号
const escaped = value.replace(/'/g, "''");

// 示例
// 原始: It's a test
// 转义: 'It''s a test'
```

### JSON 格式

**特点**：
- ✅ 结构化数据
- ✅ 易于程序化处理
- ✅ 包含元数据
- ✅ 支持嵌套结构

**结构**：
```json
{
  "exported_at": "ISO时间戳",
  "tables": {
    "表名1": {
      "count": 行数,
      "rows": [
        {数据行1},
        {数据行2}
      ]
    },
    "表名2": {
      "count": 行数,
      "rows": [...]
    }
  }
}
```

---

## 🎯 常见场景

### 场景 1：定期数据备份

```bash
#!/bin/bash
# 每日备份脚本

DATE=$(date +%Y%m%d)
BACKUP_DIR="./backups"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 导出数据
npm run db:export -- --output $BACKUP_DIR/backup_$DATE.sql

# 压缩备份
gzip $BACKUP_DIR/backup_$DATE.sql

# 保留最近7天的备份
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: backup_$DATE.sql.gz"
```

### 场景 2：数据迁移

```bash
# 1. 从源数据库导出
npm run db:export -- --output source_data.sql

# 2. 导入到目标数据库
npx wrangler d1 execute spks-new --remote --file=source_data.sql

# 3. 验证数据
npm run db:status
```

### 场景 3：数据分析

```bash
# 导出为 JSON 格式
npm run db:export -- --format json --output data.json

# 使用 Python 分析
python3 << EOF
import json

with open('data.json', 'r') as f:
    data = json.load(f)
    
    # 统计每个包的架构数量
    packages = data['tables']['packages']['rows']
    for pkg in packages:
        print(f"{pkg['id']}: {pkg['version']}")
EOF
```

### 场景 4：数据同步

```bash
#!/bin/bash
# 同步数据到本地开发环境

# 导出远程数据
npm run db:export -- --output remote_data.sql

# 导入到本地
npx wrangler d1 execute spks --local --file=remote_data.sql

echo "Data synced to local environment"
```

### 场景 5：选择性导出

```bash
# 只导出有数据的表
npm run db:export -- --format json | jq '
  .tables | to_entries | 
  map(select(.value.count > 0)) | 
  from_entries
' > filtered_data.json
```

---

## 🔧 故障排除

### 问题 1：数据库连接失败

**错误信息**：
```
✗ Failed to export table packages: Command failed
```

**解决方案**：
```bash
# 检查数据库状态
npm run db:status

# 检查网络连接
ping cloudflare.com

# 重新登录
npx wrangler logout
npx wrangler login
```

### 问题 2：表不存在

**错误信息**：
```
✗ Failed to export table nonexistent_table
```

**解决方案**：
```bash
# 检查表是否存在
npm run db:status -- --tables

# 使用正确的表名
npm run db:export -- --table packages
```

### 问题 3：权限不足

**错误信息**：
```
✗ Access denied
```

**解决方案**：
```bash
# 检查账户权限
npx wrangler whoami

# 确保有数据库访问权限
npx wrangler d1 info spks
```

### 问题 4：输出目录不存在

**错误信息**：
```
✗ ENOENT: no such file or directory
```

**解决方案**：
```bash
# 创建输出目录
mkdir -p ./backups

# 使用完整路径
npm run db:export -- --output ./backups/backup.sql
```

### 问题 5：数据量过大

**错误信息**：
```
✗ Command timed out
```

**解决方案**：
```bash
# 分批导出特定表
npm run db:export:packages -- --output packages.sql
npm run db:export:arch -- --output arch.sql

# 或使用 JSON 格式（更轻量）
npm run db:export -- --format json --output data.json
```

---

## ✅ 最佳实践

### 1. 定期备份

```bash
# 每日自动备份
# crontab -e
0 2 * * * cd /path/to/project && npm run db:export -- --output /backups/daily_$(date +\%Y\%m\%d).sql
```

### 2. 版本控制

```bash
# 将备份文件纳入版本控制
git add backups/
git commit -m "Update database backup"
```

### 3. 多格式备份

```bash
#!/bin/bash
# 同时备份 SQL 和 JSON 格式

DATE=$(date +%Y%m%d)

npm run db:export -- --output backup_$DATE.sql
npm run db:export -- --format json --output backup_$DATE.json

echo "Backup completed: backup_$DATE.sql, backup_$DATE.json"
```

### 4. 验证备份

```bash
# 导出后验证文件
npm run db:export -- --output backup.sql

# 检查文件大小
ls -lh backup.sql

# 检查文件内容
head -20 backup.sql

# 检查数据完整性
grep -c "INSERT INTO" backup.sql
```

### 5. 加密备份

```bash
# 加密备份文件
npm run db:export -- --output backup.sql
gpg -c backup.sql
rm backup.sql

# 解密备份文件
gpg -d backup.sql.gpg > backup.sql
```

---

## 📚 相关资源

- [数据库管理指南](./数据库管理指南.md)
- [db-status.mjs 使用说明](./db-status使用说明.md)
- [Wrangler CLI 数据库迁移指南](./Wrangler-CLI数据库迁移指南.md)
- [Cloudflare D1 官方文档](https://developers.cloudflare.com/d1/)

---

## 📝 更新日志

- **2026-04-16**: 创建初始版本
  - 支持 SQL 和 JSON 格式导出
  - 支持特定表导出
  - 支持文件输出
  - 自动转义特殊字符

---

## 💬 反馈和支持

如有问题或建议，请：
1. 查看本文档的故障排除部分
2. 查看 [数据库管理指南](./数据库管理指南.md)
3. 联系开发团队
