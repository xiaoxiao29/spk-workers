# Configuration Examples

本文档包含 SSPKS 项目的配置文件模板和使用说明。

## 文件列表

| 文件 | 用途 |
|------|------|
| `wrangler.toml.example` | Cloudflare Workers 配置模板 |
| `.dev.vars.example` | 本地开发环境变量模板 |
| `secrets.example` | GitHub Actions Secrets 配置模板 |

---

## wrangler.toml.example

Cloudflare Workers 配置文件模板，用于配置 Workers、KV、D1、R2 等资源绑定。

### 配置项说明

| 配置项 | 说明 | 获取方式 |
|--------|------|----------|
| `name` | Worker 名称 | - |
| `compatibility_date` | 兼容性日期 | - |
| `kv_namespaces[].id` | KV 命名空间 ID | Cloudflare Dashboard → Workers & Pages → KV |
| `d1_databases[].database_id` | D1 数据库 ID | Cloudflare Dashboard → D1 |
| `r2_buckets[].bucket_name` | R2 存储桶名称 | Cloudflare Dashboard → R2 |

### 使用方法

```bash
cp examples/wrangler.toml.example wrangler.toml
# 编辑 wrangler.toml 填入实际值
```

---

## .dev.vars.example

本地开发环境变量配置文件，用于 `wrangler dev` 运行时读取敏感配置。

### 配置项说明

| 变量 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| `SSPKS_SITE_NAME` | 是 | - | 网站显示名称 |
| `SSPKS_SITE_THEME` | 否 | `sspks` | 主题名称 |
| `SSPKS_STORAGE_BACKEND` | 否 | `d1` | 存储后端 (`d1`, `kv`, `hybrid`) |
| `SSPKS_PACKAGES_FILE_MASK` | 否 | `*.spk` | 包文件匹配规则 |
| `SSPKS_API_KEY` | 是 | - | API 认证密钥 |

### 使用方法

```bash
cp examples/.dev.vars.example .dev.vars
# 编辑 .dev.vars 填入实际值
```

> **注意**: `.dev.vars` 包含敏感信息，已加入 `.gitignore`，请勿提交到版本控制。

---

## secrets.example

GitHub Actions 工作流 Secrets 配置模板，用于 CI/CD 自动化部署。

### 配置项说明

#### 必需 Secrets

| Secret | 说明 | 获取方式 |
|--------|------|----------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token | Cloudflare Dashboard → Profile → API Tokens |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账号 ID | Cloudflare Dashboard → Workers & Pages |
| `KV_NAMESPACE_ID` | KV 命名空间 ID | Cloudflare Dashboard → Workers & Pages → KV |
| `D1_DATABASE_ID` | D1 数据库 ID | Cloudflare Dashboard → D1 |
| `API_KEY` | API 认证密钥 | 自定义生成 |
| `SITE_NAME` | 网站显示名称 | 自定义 |

#### 可选 Secrets (有默认值)

| Secret | 默认值 | 说明 |
|--------|--------|------|
| `SITE_THEME` | `sspks` | 主题名称 |
| `STORAGE_BACKEND` | `d1` | 存储后端 |
| `PACKAGES_FILE_MASK` | `*.spk` | 包文件匹配规则 |

### 使用方法

1. 进入 GitHub 仓库 → Settings → Secrets and variables → Actions
2. 点击 "New repository secret"
3. 逐一添加上述 Secrets

---

## 快速开始

### 本地开发

```bash
# 1. 复制配置文件
cp examples/wrangler.toml.example wrangler.toml
cp examples/.dev.vars.example .dev.vars

# 2. 填入实际配置值
# 编辑 wrangler.toml 和 .dev.vars

# 3. 启动开发服务器
npm run dev
```

### GitHub Actions 部署

详细说明请参考 [docs/GitHub-Actions.md](../docs/GitHub-Actions.md)。

```bash
# 1. 在 GitHub 仓库添加 Secrets
# Settings → Secrets and variables → Actions → New repository secret
# 参考 secrets.example 文件配置

# 2. 推送代码到 main 分支触发部署
git push origin main
```

---

## 环境配置对比

| 配置项 | .dev.vars (本地) | GitHub Secrets (CI/CD) | wrangler.toml |
|--------|------------------|------------------------|---------------|
| KV ID | - | `KV_NAMESPACE_ID` | `kv_namespaces[].id` |
| D1 ID | - | `D1_DATABASE_ID` | `d1_databases[].database_id` |
| Site Name | `SSPKS_SITE_NAME` | `SITE_NAME` | - |
| Theme | `SSPKS_SITE_THEME` | `SITE_THEME` | - |
| API Key | `SSPKS_API_KEY` | `API_KEY` | - |
| Storage | `SSPKS_STORAGE_BACKEND` | `STORAGE_BACKEND` | - |
| File Mask | `SSPKS_PACKAGES_FILE_MASK` | `PACKAGES_FILE_MASK` | - |
