# db-status.mjs 使用说明

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

### 什么是 db-status.mjs？

`db-status.mjs` 是一个数据库状态检查脚本，用于快速查看 Cloudflare D1 数据库的完整状态信息。

### 为什么需要这个脚本？

**Wrangler CLI 的局限性**：
- ❌ 没有一次性查看完整状态的命令
- ❌ 需要执行多条命令才能获取完整信息
- ❌ 不支持 JSON 格式输出
- ❌ 不便于程序化处理

**db-status.mjs 的优势**：
- ✅ 一条命令查看完整状态
- ✅ 自动汇总表结构、索引、统计、迁移历史
- ✅ 支持 JSON 格式输出
- ✅ 便于程序化处理和监控

---

## ✨ 功能特性

### 核心功能

| 功能 | 说明 | Wrangler CLI 对比 |
|------|------|------------------|
| **表结构查看** | 自动列出所有表和视图 | 需要手动查询 `sqlite_master` |
| **索引信息** | 自动列出所有索引 | 需要手动查询 `sqlite_master` |
| **数据统计** | 自动统计每个表的行数 | 需要手动执行 `COUNT(*)` |
| **迁移历史** | 显示已应用的迁移 | `wrangler d1 migrations list` |
| **JSON 输出** | 支持 JSON 格式输出 | ❌ 不支持 |

### 输出内容

```
=== D1 Database Status ===

Tables:
  - d1_migrations (table)
  - package_arch (table)
  - packages (table)

Indexes:
  - idx_arch (on package_arch)
  - idx_package_arch_composite (on package_arch)

Data Statistics:
  - d1_migrations: 2 rows
  - package_arch: 0 rows
  - packages: 0 rows

Migration History:
  - 0001_init_schema.sql (2026-04-16 15:32:48)
  - 0002_add_performance_indexes.sql (2026-04-16 15:32:48)
```

---

## 🔧 安装和配置

### 前置要求

- Node.js >= 18.0.0
- Wrangler CLI >= 3.33.0
- 已登录 Cloudflare 账户
- 已创建 D1 数据库

### 安装步骤

脚本已包含在项目中，无需额外安装：

```bash
# 检查脚本是否存在
ls scripts/db-status.mjs

# 检查 package.json 命令
npm run db:status --help
```

### 配置说明

脚本默认使用 `spks` 数据库，如需修改：

```javascript
// 编辑 scripts/db-status.mjs
// 修改数据库名称
const DB_NAME = 'your-database-name';
```

---

## 🚀 基本用法

### 快速开始

```bash
# 查看完整数据库状态
npm run db:status
```

### 常用命令

```bash
# JSON 格式输出
npm run db:status:json

# 只查看表结构
npm run db:status -- --tables

# 只查看索引
npm run db:status -- --indexes

# 只查看统计
npm run db:status -- --stats

# 只查看迁移历史
npm run db:status -- --migrations
```

---

## 📝 命令选项

### 选项列表

| 选项 | 说明 | 示例 |
|------|------|------|
| `--tables` | 只显示表结构 | `npm run db:status -- --tables` |
| `--indexes` | 只显示索引信息 | `npm run db:status -- --indexes` |
| `--stats` | 只显示数据统计 | `npm run db:status -- --stats` |
| `--migrations` | 只显示迁移历史 | `npm run db:status -- --migrations` |
| `--all` | 显示所有信息（默认） | `npm run db:status -- --all` |
| `--json` | JSON 格式输出 | `npm run db:status -- --json` |

### 选项组合

```bash
# 组合多个选项
npm run db:status -- --tables --indexes

# JSON 输出 + 特定信息
npm run db:status -- --tables --json
```

---

## 💡 使用示例

### 示例 1：快速检查数据库状态

```bash
npm run db:status
```

**输出**：
```
ℹ === D1 Database Status ===

ℹ 提示: 使用 Wrangler CLI 管理数据库
ℹ   - 创建数据库: npx wrangler d1 create spks
ℹ   - 应用迁移: npx wrangler d1 migrations apply spks --remote
ℹ   - 列出迁移: npx wrangler d1 migrations list spks

ℹ Tables:
ℹ   - d1_migrations (table)
ℹ   - package_arch (table)
ℹ   - packages (table)

ℹ Indexes:
ℹ   - idx_arch (on package_arch)
ℹ   - idx_package_arch_composite (on package_arch)
ℹ   - idx_packages_created_at (on packages)

ℹ Data Statistics:
ℹ   - d1_migrations: 2 rows
ℹ   - package_arch: 0 rows
ℹ   - packages: 0 rows

ℹ Migration History:
ℹ   - 0001_init_schema.sql (2026-04-16 15:32:48)
ℹ   - 0002_add_performance_indexes.sql (2026-04-16 15:32:48)

✓ Database status check completed
```

### 示例 2：检查特定信息

```bash
# 只查看表结构
npm run db:status -- --tables
```

**输出**：
```
ℹ Tables:
ℹ   - d1_migrations (table)
ℹ   - package_arch (table)
ℹ   - packages (table)
```

### 示例 3：JSON 格式输出

```bash
npm run db:status:json
```

**输出**：
```json
{
  "timestamp": "2026-04-16T07:32:48.000Z",
  "tables": [
    {"name": "d1_migrations", "type": "table"},
    {"name": "package_arch", "type": "table"},
    {"name": "packages", "type": "table"}
  ],
  "indexes": [
    {"name": "idx_arch", "tbl_name": "package_arch", "sql": "..."},
    {"name": "idx_package_arch_composite", "tbl_name": "package_arch", "sql": "..."}
  ],
  "stats": [
    {"table": "d1_migrations", "count": 2},
    {"table": "package_arch", "count": 0},
    {"table": "packages", "count": 0}
  ],
  "migrations": [
    {"id": 1, "name": "0001_init_schema.sql", "applied_at": "2026-04-16T07:32:48Z"},
    {"id": 2, "name": "0002_add_performance_indexes.sql", "applied_at": "2026-04-16T07:32:48Z"}
  ]
}
```

### 示例 4：使用 jq 处理 JSON 输出

```bash
# 只获取表名
npm run db:status:json | jq '.tables[].name'

# 只获取数据量大于 0 的表
npm run db:status:json | jq '.stats[] | select(.count > 0)'

# 统计总数据量
npm run db:status:json | jq '[.stats[].count] | add'
```

---

## 📊 输出格式

### 文本格式（默认）

```
=== D1 Database Status ===

提示: 使用 Wrangler CLI 管理数据库
  - 创建数据库: npx wrangler d1 create spks
  - 应用迁移: npx wrangler d1 migrations apply spks --remote
  - 列出迁移: npx wrangler d1 migrations list spks

Tables:
  - 表名 (类型)

Indexes:
  - 索引名 (on 表名)

Data Statistics:
  - 表名: 行数 rows

Migration History:
  - 迁移文件名 (应用时间)

✓ Database status check completed
```

### JSON 格式

```json
{
  "timestamp": "ISO时间戳",
  "tables": [
    {"name": "表名", "type": "类型"}
  ],
  "indexes": [
    {"name": "索引名", "tbl_name": "表名", "sql": "SQL语句"}
  ],
  "stats": [
    {"table": "表名", "count": 行数}
  ],
  "migrations": [
    {"id": ID, "name": "迁移名", "applied_at": "应用时间"}
  ]
}
```

---

## 🎯 常见场景

### 场景 1：开发环境检查

```bash
# 快速检查数据库是否正常
npm run db:status

# 检查迁移是否已应用
npm run db:status -- --migrations
```

### 场景 2：生产环境监控

```bash
# 检查数据量
npm run db:status:json | jq '.stats'

# 检查是否有异常表
npm run db:status:json | jq '.tables | length'
```

### 场景 3：部署前验证

```bash
# 验证数据库结构
npm run db:status -- --tables --indexes

# 验证迁移状态
npm run db:status -- --migrations
```

### 场景 4：自动化脚本

```bash
#!/bin/bash
# 检查数据库健康状态

# 获取表数量
TABLE_COUNT=$(npm run db:status:json | jq '.tables | length')

# 获取总数据量
TOTAL_ROWS=$(npm run db:status:json | jq '[.stats[].count] | add')

echo "数据库表数量: $TABLE_COUNT"
echo "总数据量: $TOTAL_ROWS"

# 判断是否健康
if [ "$TABLE_COUNT" -lt 2 ]; then
  echo "警告: 表数量过少"
  exit 1
fi
```

---

## 🔧 故障排除

### 问题 1：数据库不存在

**错误信息**：
```
✗ Fatal error: Command failed
```

**解决方案**：
```bash
# 检查数据库列表
npx wrangler d1 list

# 创建数据库
npx wrangler d1 create spks
```

### 问题 2：未登录 Cloudflare

**错误信息**：
```
✗ Not logged in
```

**解决方案**：
```bash
# 登录 Cloudflare
npx wrangler login
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

# 重新登录
npx wrangler logout
npx wrangler login
```

### 问题 4：网络问题

**错误信息**：
```
✗ Network error
```

**解决方案**：
```bash
# 检查网络连接
ping cloudflare.com

# 使用代理（如果需要）
export HTTP_PROXY=http://proxy:port
export HTTPS_PROXY=http://proxy:port
```

---

## ✅ 最佳实践

### 1. 定期检查数据库状态

```bash
# 每天检查一次
npm run db:status > logs/db_status_$(date +%Y%m%d).log
```

### 2. 使用 JSON 格式进行监控

```bash
# 监控数据量
npm run db:status:json | jq '.stats[] | select(.count > 10000)'
```

### 3. 部署前验证

```bash
# 部署前检查
npm run db:status -- --migrations
npm run db:status -- --tables
```

### 4. 结合其他工具

```bash
# 与 export-data.mjs 配合使用
npm run db:status
npm run db:export -- --output backup.sql
```

---

## 📚 相关资源

- [数据库管理指南](./数据库管理指南.md)
- [export-data.mjs 使用说明](./export-data使用说明.md)
- [Wrangler CLI 数据库迁移指南](./Wrangler-CLI数据库迁移指南.md)
- [Cloudflare D1 官方文档](https://developers.cloudflare.com/d1/)

---

## 📝 更新日志

- **2026-04-16**: 创建初始版本
  - 支持表结构、索引、统计、迁移历史查看
  - 支持 JSON 格式输出
  - 添加友好的命令行界面

---

## 💬 反馈和支持

如有问题或建议，请：
1. 查看本文档的故障排除部分
2. 查看 [数据库管理指南](./数据库管理指南.md)
3. 联系开发团队
