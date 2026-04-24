# Wrangler CLI 数据库迁移使用指南

本文档介绍如何使用官方 Wrangler CLI 管理 Cloudflare D1 数据库迁移。

## 📋 目录

- [快速开始](#快速开始)
- [迁移命令](#迁移命令)
- [迁移文件规范](#迁移文件规范)
- [工作流程](#工作流程)
- [最佳实践](#最佳实践)
- [常见问题](#常见问题)

---

## 🚀 快速开始

### 1. 检查 Wrangler 版本

```bash
npx wrangler --version
# 需要 >= 3.33.0
```

### 2. 登录 Cloudflare

```bash
npx wrangler login
```

### 3. 检查数据库状态

```bash
npm run db:status
```

---

## 📚 迁移命令

### 创建迁移

```bash
# 创建新的迁移文件
npx wrangler d1 migrations create <database_name> <migration_name>

# 示例
npx wrangler d1 migrations create spks add_user_table
```

**输出**：
```
migrations/
└── 0001_add_user_table.sql
```

### 应用迁移

```bash
# 应用到远程数据库
npx wrangler d1 migrations apply <database_name> --remote

# 应用到本地数据库
npx wrangler d1 migrations apply <database_name> --local

# 示例
npx wrangler d1 migrations apply spks --remote
```

### 列出迁移

```bash
# 列出所有迁移状态
npx wrangler d1 migrations list <database_name>

# 示例
npx wrangler d1 migrations list spks
```

**输出**：
```
Migrations to be applied:
┌─────────────────────────────────┐
│ name                            │
├─────────────────────────────────┤
│ 0001_init_schema.sql            │
│ 0002_add_performance_indexes.sql│
└─────────────────────────────────┘
```

### 执行 SQL

```bash
# 执行单个 SQL 命令
npx wrangler d1 execute <database_name> --command "<sql>" --remote

# 执行 SQL 文件
npx wrangler d1 execute <database_name> --file=<path> --remote

# 示例
npx wrangler d1 execute spks --command "SELECT * FROM packages LIMIT 5" --remote
npx wrangler d1 execute spks --file=./migrations/0001_init_schema.sql --remote
```

---

## 📝 迁移文件规范

### 文件命名

```
migrations/
├── 0001_init_schema.sql
├── 0002_add_performance_indexes.sql
├── 0003_add_user_table.sql
└── 0004_add_timestamp_columns.sql
```

**命名规则**：
- 使用 4 位数字前缀（自动生成）
- 使用下划线分隔单词
- 使用描述性名称
- 文件扩展名必须是 `.sql`

### 文件结构

```sql
-- =============================================================================
-- 迁移标题
-- 
-- 创建时间: YYYY-MM-DD
-- 作者: Your Name
-- 描述: 简要描述迁移的目的
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 创建表
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS table_name (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

-- -----------------------------------------------------------------------------
-- 2. 创建索引
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_table_name_name 
ON table_name(name);

-- -----------------------------------------------------------------------------
-- 3. 优化
-- -----------------------------------------------------------------------------
PRAGMA optimize;
```

### 最佳实践

1. **使用 IF NOT EXISTS**：
   ```sql
   ✅ CREATE TABLE IF NOT EXISTS ...
   ✅ CREATE INDEX IF NOT EXISTS ...
   
   ❌ CREATE TABLE ...
   ❌ CREATE INDEX ...
   ```

2. **添加注释**：
   ```sql
   -- 创建用户表
   -- 用于存储用户基本信息
   CREATE TABLE IF NOT EXISTS users (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     email TEXT NOT NULL UNIQUE,
     name TEXT
   );
   ```

3. **使用事务（可选）**：
   ```sql
   BEGIN TRANSACTION;
   
   CREATE TABLE IF NOT EXISTS users (...);
   CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
   
   COMMIT;
   ```

4. **添加 PRAGMA optimize**：
   ```sql
   -- 在迁移文件末尾添加
   PRAGMA optimize;
   ```

---

## 🔄 工作流程

### 初始化新数据库

```bash
# 1. 创建数据库（如果不存在）
npx wrangler d1 create spks

# 2. 应用初始迁移
npx wrangler d1 migrations apply spks --remote

# 3. 验证表结构
npx wrangler d1 execute spks --command ".schema" --remote
```

### 添加新迁移

```bash
# 1. 创建迁移文件
npx wrangler d1 migrations create spks add_new_feature

# 2. 编辑迁移文件
# 编辑 migrations/0003_add_new_feature.sql

# 3. 测试迁移（本地）
npx wrangler d1 migrations apply spks --local

# 4. 应用到远程
npx wrangler d1 migrations apply spks --remote
```

### 导出现有数据

```bash
# 导出所有表数据
npm run db:export -- --output ./backup/data.sql

# 导出特定表
npm run db:export:packages -- --output ./backup/packages.sql

# 导出为 JSON 格式
npm run db:export -- --format json --output ./backup/data.json
```

### 完整迁移流程

```mermaid
graph TD
    A[开始] --> B{数据库存在?}
    B -->|否| C[创建数据库]
    C --> D[应用初始迁移]
    B -->|是| D
    D --> E[检查迁移状态]
    E --> F{有待执行迁移?}
    F -->|是| G[应用迁移]
    G --> H[验证结果]
    F -->|否| H
    H --> I[完成]
```

---

## ✅ 最佳实践

### 1. 迁移文件管理

```bash
# ✅ 推荐：使用版本控制
git add migrations/
git commit -m "Add migration: create users table"

# ❌ 不推荐：手动编辑已应用的迁移
```

### 2. 测试流程

```bash
# 1. 本地测试
npx wrangler d1 migrations apply spks --local

# 2. 验证本地数据
npx wrangler d1 execute spks --local --command "SELECT * FROM users LIMIT 5"

# 3. 应用到远程
npx wrangler d1 migrations apply spks --remote
```

### 3. 备份策略

```bash
# 导出数据备份
npm run db:export -- --output ./backups/backup_$(date +%Y%m%d).sql

# 定期备份
# 可以设置为定时任务
```

### 4. 回滚策略

D1 不支持自动回滚，需要手动创建回滚迁移：

```bash
# 创建回滚迁移
npx wrangler d1 migrations create spks rollback_add_users

# 编辑回滚 SQL
# migrations/0004_rollback_add_users.sql
DROP TABLE IF EXISTS users;
DROP INDEX IF EXISTS idx_users_email;
```

---

## ❓ 常见问题

### Q1: 迁移已应用但需要修改？

**A**: 创建新的迁移文件，不要修改已应用的迁移。

```bash
# ❌ 错误：修改已应用的迁移
# 编辑 0001_init_schema.sql

# ✅ 正确：创建新迁移
npx wrangler d1 migrations create spks fix_schema_issue
```

### Q2: 如何查看迁移历史？

**A**: 查询 `d1_migrations` 表：

```bash
npx wrangler d1 execute spks --remote --command "SELECT * FROM d1_migrations"
```

### Q3: 本地和远程数据库不同步？

**A**: 分别应用迁移：

```bash
# 应用到本地
npx wrangler d1 migrations apply spks --local

# 应用到远程
npx wrangler d1 migrations apply spks --remote
```

### Q4: 如何重置数据库？

**A**: 删除并重新创建：

```bash
# ⚠️ 警告：会删除所有数据
npx wrangler d1 delete spks
npx wrangler d1 create spks
npx wrangler d1 migrations apply spks --remote
```

### Q5: 迁移失败怎么办？

**A**: 检查错误信息并修复：

```bash
# 查看详细错误
npx wrangler d1 migrations apply spks --remote --verbose

# 修复 SQL 后重新应用
# 或者创建修复迁移
```

---

## 📖 项目特定命令

### SSPKS 项目命令

```bash
# 数据库管理
npm run db:init              # 初始化数据库
npm run db:init:reset        # 重置数据库
npm run db:migrate           # 应用所有迁移
npm run db:migrate:list      # 列出迁移状态
npm run db:status            # 查看数据库状态
npm run db:status:json       # JSON 格式状态

# 数据导出
npm run db:export            # 导出所有数据
npm run db:export:packages   # 导出 packages 表
npm run db:export:arch       # 导出 package_arch 表
```

### Wrangler CLI 命令

```bash
# 数据库操作
npx wrangler d1 list                          # 列出所有数据库
npx wrangler d1 info spks                     # 查看数据库信息
npx wrangler d1 create spks                   # 创建数据库
npx wrangler d1 delete spks                   # 删除数据库

# 迁移操作
npx wrangler d1 migrations create spks <name> # 创建迁移
npx wrangler d1 migrations apply spks --remote # 应用迁移
npx wrangler d1 migrations list spks          # 列出迁移

# SQL 执行
npx wrangler d1 execute spks --command "<sql>" --remote  # 执行 SQL
npx wrangler d1 execute spks --file=<path> --remote      # 执行文件
```

---

## 🔗 相关资源

- [Cloudflare D1 官方文档](https://developers.cloudflare.com/d1/)
- [Wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/)
- [D1 迁移文档](https://developers.cloudflare.com/d1/reference/migrations/)
- [项目数据库脚本](./scripts/)

---

## 📝 更新日志

- **2026-04-16**: 创建初始版本，包含完整的迁移流程和最佳实践
