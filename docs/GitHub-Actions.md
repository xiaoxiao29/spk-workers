# GitHub Actions 部署配置

推送代码到 `main` 分支时，自动部署到 Cloudflare Workers。

---

## 配置步骤

### 1. 创建 Cloudflare API Token

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Profile → API Tokens**
3. 点击 **Create Token**
4. 选择 **Edit Cloudflare Workers** 模板
5. 配置权限：
   - Account: Workers Scripts: Edit
   - R2: Bucket Objects: Edit
   - D1: Database: Edit
   - KV Namespace: KV Namespace: Edit
6. 创建并保存 Token

### 2. 获取 Cloudflare Account ID

1. 进入 **Workers & Pages**
2. 右上角显示的 32 位字符串即为 Account ID

### 3. 配置 GitHub Secrets

在 GitHub 仓库 **Settings → Secrets and variables → Actions** 中添加：

| Secret | 说明 |
|--------|------|
| `CLOUDFLARE_API_TOKEN` | 第 1 步创建的 API Token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |
| `KV_NAMESPACE_ID` | KV Namespace ID |
| `D1_DATABASE_ID` | D1 Database ID |
| `API_KEY` | 包上传认证密钥 |
| `SITE_NAME` | 网站名称 |

---

## 工作流文件

```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloudflare Workers

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - run: npm ci
      - run: npm run build

      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          kvNamespaceId: ${{ secrets.KV_NAMESPACE_ID }}
          d1DatabaseId: ${{ secrets.D1_DATABASE_ID }}
          variables: |
            SSPKS_SITE_NAME: ${{ secrets.SITE_NAME }}
            SSPKS_SITE_THEME: ${{ secrets.SITE_THEME || 'sspks' }}
            SSPKS_STORAGE_BACKEND: ${{ secrets.STORAGE_BACKEND || 'd1' }}
            SSPKS_PACKAGES_FILE_MASK: ${{ secrets.PACKAGES_FILE_MASK || '*.spk' }}
          secrets: |
            SSPKS_API_KEY: ${{ secrets.API_KEY }}
```

---

## Secrets 配置参考

参考 `examples/secrets.example` 文件获取完整的配置说明。
