# 常见问题 (FAQ)

本文档收集了 SPK Workers 项目的常见问题及解决方案。

---

## 目录

- [用户问题](#用户问题)
- [配置问题](#配置问题)
- [部署问题](#部署问题)
- [功能问题](#功能问题)
- [开发问题](#开发问题)
- [运行时问题](#运行时问题)

## 用户问题

### Q: 添加仓库后看不到包？

**可能原因：**

1. **架构不匹配**：您的 NAS 架构可能不在包支持的列表中
2. **缓存延迟**：新上传的包可能需要几分钟才能显示
3. **网络问题**：检查 Synology 与 SPK Workers 的网络连接

**解决方法：**
- 清除浏览器缓存后刷新
- 等待 5-10 分钟后重试
- 检查包的 INFO 文件中是否包含正确的架构

### Q: 上传失败？

**可能原因：**

1. **API Key 错误**：检查 API Key 是否正确
2. **文件格式错误**：必须是 `.spk` 扩展名
3. **文件太大**：默认限制 500MB

**解决方法：**
- 确认 API Key 正确
- 检查文件格式
- 尝试重新下载 SPK 文件

### Q: 包显示但无法安装？

**可能原因：**

1. **固件版本不匹配**：包的最低固件要求高于您的 DSM 版本
2. **依赖未满足**：包依赖的其他服务未安装

**解决方法：**
- 升级 DSM 到最新版本
- 查看包的说明了解依赖要求

### Q: 如何获取 API Key？

API Key 由服务器管理员设置。如果您是管理员，请在 Cloudflare Workers 设置中配置 `SSPKS_API_KEY` 环境变量。

---

## 配置问题

### Q: wrangler.toml 应该如何配置？

A: 复制配置文件模板：

```bash
cp examples/wrangler.toml.example wrangler.toml
```

然后编辑 `wrangler.toml`，填入您的实际配置值。详细说明请参考 [examples/README.md](../examples/README.md)。

### Q: 如何设置 API Key？

A: 生产环境应使用 Cloudflare Secret：

```bash
wrangler secret put SSPKS_API_KEY
# 输入你的 API 密钥
```

本地开发使用 `.dev.vars` 文件：

```bash
cp examples/.dev.vars.example .dev.vars
# 编辑 .dev.vars 填入实际值
```

### Q: R2 和 KV 权限如何配置？

A: 在 Cloudflare Dashboard 中：

1. 创建 R2 Bucket 名称为 `spks`
2. 创建 KV Namespace
3. 在 Workers 设置中绑定到 `SPKS_BUCKET` 和 `SPKS_CACHE`

### Q: 如何配置设备列表？

A: 设备列表存储在 R2 中，需要手动上传：

1. 上传配置文件到 R2：
   ```bash
   wrangler r2 object put spks/conf/synology_models.yaml --file=conf/synology_models.yaml
   ```

2. 或通过 Cloudflare Dashboard 上传：
   - 进入 R2 Bucket 管理页面
   - 创建 `conf/` 目录
   - 上传 `synology_models.yaml` 文件

注意：部署前必须确保 R2 中存在此配置文件，否则服务将无法启动。

### Q: 主题不生效？

A: 检查以下配置：

1. `SSPKS_SITE_THEME` 环境变量设为 `material` 或 `classic`
2. 主题文件位于 `themes/{theme}/` 目录
3. 确认 `baseUrlRelative` 路径正确

---

## 部署问题

### Q: 构建失败 (tsc 错误)？

A: 常见原因及解决方案：

1. **类型错误**：运行 `npm run typecheck` 查看具体错误
2. **缺少类型定义**：安装 `npm install --save-dev @types/xxx`
3. **ESLint 错误**：运行 `npm run lint` 查看

### Q: 部署超时？

A: 解决方案：

1. 减小 Worker 代码体积（移除未使用的依赖）
2. 使用 `wrangler deploy --dry-run` 检查
3. 确认 `wrangler.toml` 配置正确

### Q: 部署失败提示配额超限？

A: 检查 Cloudflare Workers 配额：

- 免费计划：100,000 请求/天，50ms CPU/请求
- 付费计划：最高 30s CPU 时间

优化建议：
- 减少 Worker 代码
- 优化缓存策略
- 使用 KV 缓存减少计算

### Q: 部署后显示 "Worker exceeded resource limits"？

A: CPU 时间超限，解决方法：

1. 启用 KV 缓存减少重复计算
2. 优化 `PackageFinder` 查询
3. 使用 `waitUntil` 处理异步任务
4. 考虑升级到付费计划

---

## 功能问题

### Q: SPK 文件上传失败？

A: 常见原因：

1. **文件格式错误**：必须是 `.spk` 扩展名
2. **文件太大**：默认限制 500MB
3. **API Key 错误**：检查 `X-API-Key` 请求头
4. **R2 配额不足**：检查 Cloudflare R2 存储配额

### Q: 上传成功但包列表不显示？

A: 可能原因：

1. **缓存未更新**：KV 缓存可能需要 1-5 分钟刷新
2. **元数据解析失败**：检查 SPK 包 INFO 文件格式
3. **架构不匹配**：包可能不包含请求的 arch

解决方案：清除 KV 缓存或等待自动过期

### Q: 包索引不更新？

A: KV 缓存默认 TTL 为 3600 秒（1小时）。解决方法：

1. 手动清除 `SPKS_CACHE` KV
2. 使用 `wrangler kv:key delete` 删除特定键
3. 修改 `expirationTtl` 缩短缓存时间

### Q: Synology Package Center 无法连接？

A: 检查以下内容：

1. URL 格式：`https://your-worker.workers.dev`
2. CORS 配置：确保允许跨域请求
3. SSL 证书：Cloudflare 自动提供
4. 请求参数：参考 Synology API 格式

---

## 开发问题

### Q: 本地开发时 R2/KV 对象不可见？

A: Miniflare 会模拟 R2 和 KV，但需要正确配置：

1. 确保 `wrangler.toml` 配置正确
2. 使用 `npm run dev` 启动开发服务器
3. 检查 `wrangler.json` 模拟数据配置

### Q: 类型检查失败？

A: 常见类型错误：

1. **Env 类型未定义**：确保 `src/index.ts` 中定义 `Env` 类型
2. **R2Object 属性错误**：检查 `R2Object` 接口
3. **Request/Response 类型**：使用内置类型而非自定义

### Q: 测试无法 mock R2/KV？

A: 使用 `@cloudflare/vitest-pool-workers`：

```typescript
import { environments } from '@cloudflare/vitest-pool-workers';

const mockEnv = {
  SPKS_BUCKET: environments.prod,
  SPKS_CACHE: environments.prod,
} as Environment;
```

### Q: 本地无法访问云端资源？

A: 这是正常现象。本地开发使用 Miniflare 模拟：
- R2 存储使用内存模拟
- KV 使用内存模拟
- 部署后使用真实云端资源

---

## 运行时问题

### Q: 50ms CPU 时间超限？

A: 优化建议：

1. **启用缓存**：减少重复计算
   ```typescript
   const cached = await env.SPKS_CACHE.get(key);
   if (cached) return cached;
   ```

2. **延迟加载**：使用 `waitUntil` 处理非关键任务
   ```typescript
   ctx.waitUntil(updateCache(env));
   ```

3. **简化响应**：减少 JSON 序列化
   ```typescript
   return new Response(cached);
   ```

4. **代码拆分**：将复杂逻辑移到独立函数

### Q: 内存超限 (128MB)？

A: 解决建议：

1. 避免一次性加载大文件到内存
2. 使用 Streaming 处理大文件
3. 及时释放不需要的对象引用

### Q: 请求体大小限制 (100MB)？

A: SPK 文件通过 R2 直传，不受此限制。确保：

1. 前端使用 `FormData` 上传
2. Worker 不直接读取大文件内容
3. 使用 `request.formData()` 流式处理

### Q: CORS 跨域问题？

A: 在 `src/index.ts` 中添加 CORS 头：

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
};
```

### Q: 大文件下载超时？

A: 使用 Streaming Response：

```typescript
const obj = await env.SPKS_BUCKET.get(key);
if (obj) {
  return new Response(obj.body, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${key}"`,
    },
  });
}
```

---

## 获取更多帮助

- [SPEC.md](SPEC.md) - 完整项目规范
- [DEVELOPMENT.md](DEVELOPMENT.md) - 开发指南
- [SSPKS接口文档.md](SSPKS接口文档.md) - API 接口文档
