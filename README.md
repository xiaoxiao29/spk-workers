# SPK Workers

一个基于 Cloudflare Workers 的 Synology SPK 包服务器，用 TypeScript 重写自 [SSPKS](https://github.com/jdel/sspks)。

## 特性

- **边缘计算**: 基于 Cloudflare Workers，全球低延迟访问
- **原生兼容**: 完全兼容 Synology Package Center API
- **高效存储**: 使用 R2 Storage 存储 SPK 包，无出口费用
- **双重缓存**: Workers KV + D1 数据库，灵活切换
- **D1 数据库**: 支持 SQL 查询，5M 行读取/天配额（KV 的 50 倍）
- **智能缓存**: Workers KV 索引缓存，毫秒级响应
- **双主题支持**: Material Design 和 Classic 主题
- **响应式布局**: 完美的移动端适配
- **上传功能**: Web 界面上传 SPK 包
- **TypeScript**: 完整类型安全，IDE 支持完善
- **官方测试**: @cloudflare/vitest-pool-workers 集成测试

## 使用方法

### 上传 SPK 包

通过 Web 界面上传（需配置 API Key）：

1. 访问 `/upload` 页面
2. 输入 API Key
3. 拖拽或选择 SPK 文件

或使用 API：

```bash
curl -X POST https://your-worker.workers.dev/api/upload \
  -H "X-API-Key: your-api-key" \
  -F "spk=@/path/to/package.spk"
```

### 配置 Synology Package Center

在 Synology NAS 的 Package Center 中添加自定义仓库：

```
https://your-worker.workers.dev
```

### Cloudflare Access Bypass 自动同步

如果你启用了 Cloudflare Access（Zero Trust），部署时会自动同步 bypass 规则，避免套件中心被 302 登录页拦截。

1. 编辑本地配置：`conf/access-bypass.json`
2. 设置环境变量：`CLOUDFLARE_API_TOKEN`
3. 提供账号 ID（任选其一，优先环境变量）：
   - `CLOUDFLARE_ACCOUNT_ID`
   - 或 `wrangler.toml` 中的 `account_id`
4. `targetDomain` 可选：
   - 配置了就用配置值
   - 不配置则自动推导为 `<wrangler.name>.<workers_subdomain>.workers.dev`
5. 部署时自动同步：`npm run deploy`

也可以单独执行：

```bash
npm run access:bypass:sync
```

### 浏览器访问

直接访问网站查看包列表：

```
https://your-worker.workers.dev/
```

## 文档

| 文档 | 说明 |
|------|------|
| [快速开始](docs/快速开始.md) | 用户快速开始指南 |
| [SPEC.md](docs/SPEC.md) | 完整项目规范 |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | 开发指南 |
| [FAQ.md](docs/FAQ.md) | 常见问题 |
| [SSPKS接口文档.md](docs/SSPKS接口文档.md) | Synology API 接口文档 |

## 移植自

本项目从 [SSPKS (PHP)](https://github.com/jdel/sspks) 移植而来，保留了原有的功能特性和 API 兼容性。

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## Cloudflare Workers 限制说明

| 特性 | 限制 | 本项目应对 |
|------|------|-----------|
| CPU 时间 | 50ms (免费) / 30s (付费) | 索引缓存减少计算 |
| 内存 | 128MB | 小型 JSON 处理无压力 |
| 请求体 | 100MB | SPK 通过 R2 直传 |
| 磁盘 | 无本地存储 | 使用 R2 + D1/KV |

## 存储后端

项目支持两种存储后端，通过环境变量 `SSPKS_STORAGE_BACKEND` 切换：

| 后端 | 读取配额 | 写入配额 | 适用场景 |
|------|----------|----------|----------|
| **D1 (推荐)** | 5M 行/天 | 100K/天 | 高流量、复杂查询 |
| **KV** | 100K/天 | 1K/天 | 简单场景、过渡使用 |

```bash
# 使用 D1 数据库（推荐）
SSPKS_STORAGE_BACKEND="d1"

# 使用 KV（回退方案）
SSPKS_STORAGE_BACKEND="kv"
```

### D1 数据库优势

- **50 倍读取配额**：5M 行/天 vs KV 100K 次/天
- **100 倍写入配额**：100K/天 vs KV 1K/天
- **原生 SQL 查询**：支持索引、搜索、排序
- **自动索引维护**：无需手动维护 `index:arch:*`

### 初始化 D1 数据库

```bash
# 创建 D1 数据库
wrangler d1 create spks

# 初始化表结构
wrangler d1 execute spks --file=./scripts/init-d1.sql --remote
```

### 从 KV 迁移到 D1

```bash
# 设置环境变量后执行迁移
CLOUDFLARE_ACCOUNT_ID=xxx \
CLOUDFLARE_API_KEY=xxx \
KV_NAMESPACE_ID=xxx \
D1_DATABASE_ID=xxx \
node scripts/migrate-kv-to-d1.mjs
```
