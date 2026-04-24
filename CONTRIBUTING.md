# 贡献指南

感谢您对 SPK Workers 项目的兴趣！我们欢迎各种形式的贡献，包括但不限于代码、功能建议、文档改进和错误报告。

---

## 目录

- [行为准则](#行为准则)
- [快速开始](#快速开始)
- [开发环境](#开发环境)
- [分支管理](#分支管理)
- [提交规范](#提交规范)
- [Pull Request 流程](#pull-request-流程)
- [代码规范](#代码规范)
- [测试要求](#测试要求)
- [文档改进](#文档改进)
- [报告问题](#报告问题)

---

## 行为准则

参与本项目即表示您同意遵守我们的行为准则。我们期望所有贡献者都能保持友好、尊重和专业的交流态度。

---

## 快速开始

### Fork 项目

1. 点击 GitHub 页面右上角的 **Fork** 按钮
2. 克隆您的 Fork：
   ```bash
   git clone https://github.com/YOUR_USERNAME/spk-workers.git
   cd spk-workers
   ```
3. 添加上游仓库：
   ```bash
   git remote add upstream https://github.com/original-owner/spk-workers.git
   ```

### 安装依赖

```bash
npm install
```

---

## 开发环境

### 1. 复制环境变量文件

```bash
cp wrangler.toml.example wrangler.toml
```

编辑 `wrangler.toml` 配置您的 Cloudflare 资源。

### 2. 创建本地环境变量

```bash
cp .dev.vars.example .dev.vars
```

编辑 `.dev.vars` 设置开发环境变量。

### 3. 启动开发服务器

```bash
npm run dev
```

访问 `http://localhost:8787` 查看应用。

### 4. 运行测试

```bash
# 所有测试
npm test

# 类型检查
npm run typecheck

# 代码检查
npm run lint
```

---

## 分支管理

我们采用以下分支策略：

| 分支 | 用途 |
|------|------|
| `main` | 生产版本，只接受合并 |
| `develop` | 开发分支，功能集成的目标分支 |

### 分支命名规范

| 类型 | 格式 | 示例 |
|------|------|------|
| 功能 | `feature/xxx` | `feature/package-filter` |
| 修复 | `fix/xxx` | `fix/cache-invalidation` |
| 重构 | `refactor/xxx` | `refactor/handlers` |
| 文档 | `docs/xxx` | `docs/api-reference` |
| 测试 | `test/xxx` | `test/new-endpoint` |

---

## 提交规范

### 提交信息格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type 类型

| Type | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修复 bug |
| `docs` | 文档变更 |
| `style` | 代码格式（不影响功能） |
| `refactor` | 重构（不影响功能） |
| `test` | 测试相关 |
| `chore` | 构建/工具/依赖 |

### 提交示例

```
feat(package): add architecture filtering

- Add setArchitectureFilter method
- Support noarch packages
- Add unit tests

Closes #123
```

```
fix(handler): resolve CORS preflight issue

The OPTIONS request was not handled correctly,
causing CORS errors in browsers.

Fixes #456
```

### 提交注意事项

- 提交前确保所有测试通过
- 保持提交信息清晰、简洁
- 每个提交应该只做一件事
- 避免在提交中混入不相关的更改

---

## Pull Request 流程

### 创建 PR 前

1. **同步上游代码**
   ```bash
   git fetch upstream
   git rebase upstream/develop
   ```

2. **确保测试通过**
   ```bash
   npm test
   npm run typecheck
   npm run lint
   ```

3. **创建有意义的提交**

### PR 描述模板

```markdown
## 描述
简要说明这个 PR 做了什么。

## 变更类型
- [ ] 新功能 (feat)
- [ ] 修复bug (fix)
- [ ] 文档更新 (docs)
- [ ] 代码重构 (refactor)
- [ ] 测试相关 (test)
- [ ] 其他 (chore)

## 关联 Issue
Fixes #xxx 或 Related to #xxx

## 测试
描述您是如何测试这些更改的。

## 截图（如有 UI 变更）
添加截图帮助审查。
```

### PR 审查流程

1. 至少需要 1 人审查通过
2. 所有 CI 检查必须通过
3. 需要处理所有审查意见
4. 合并前 squash 提交

---

## 代码规范

### TypeScript 规范

- 使用 **ES2022** 目标
- 启用严格模式 (`strict: true`)
- 使用 **2 空格**缩进
- 使用 **单引号** 字符串
- 末尾分号可选

### 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 类 | PascalCase | `PackageFilter` |
| 接口 | PascalCase | `PackageMetadata` |
| 方法 | camelCase | `getFilteredPackageList` |
| 常量 | SCREAMING_SNAKE | `MAX_CACHE_AGE` |
| 文件 | kebab-case | `package-filter.ts` |

### 类型定义

优先使用 `interface` 而非 `type`：

```typescript
// ✅ 推荐
interface PackageMetadata {
  package: string;
  version: string;
  arch: string[];
}

// ❌ 避免
type PackageMetadata = {
  package: string;
  version: string;
  arch: string[];
};
```

### 异步处理

优先使用 `async/await`：

```typescript
// ✅ 推荐
async function fetchPackage(name: string): Promise<Package> {
  const obj = await env.SPKS_BUCKET.get(`packages/${name}.spk`);
  if (!obj) throw new Error('Package not found');
  return Package.fromR2(env.SPKS_BUCKET, name);
}

// ❌ 避免
function fetchPackage(name: string): Promise<Package> {
  return new Promise(async (resolve) => {
    const obj = await env.SPKS_BUCKET.get(`packages/${name}.spk`);
    resolve(obj);
  });
}
```

---

## 测试要求

### 测试框架

项目使用 **Vitest** + **@cloudflare/vitest-pool-workers**

### 测试文件位置

```
src/config/Config.ts     → tests/unit/Config.test.ts
src/package/Package.ts   → tests/unit/Package.test.ts
src/handlers/*.ts       → tests/unit/Handler.test.ts
```

### 测试覆盖率要求

- 核心业务逻辑必须测试
- 新功能必须包含测试
- Bug 修复必须添加回归测试

### 运行测试

```bash
# 运行所有测试
npm test

# 监听模式（开发时使用）
npm run test:watch

# 生成覆盖率报告
npm run test:coverage
```

---

## 文档改进

文档改进同样重要！如果您发现：

- 文档描述不准确
- 缺少必要的说明
- 示例代码过时
- 拼写/语法错误

欢迎提交文档 PR。

### 文档文件

| 文件 | 说明 |
|------|------|
| `README.md` | 项目主页 |
| `docs/SPEC.md` | 项目规范 |
| `docs/DEVELOPMENT.md` | 开发指南 |
| `docs/FAQ.md` | 常见问题 |
| `docs/SSPKS接口文档.md` | API 文档 |

---

## 报告问题

### Bug 报告

请包含以下信息：

1. **问题描述**：清晰描述问题
2. **复现步骤**：如何复现
3. **预期行为**：应该怎样
4. **实际行为**：实际怎样
5. **环境信息**：Node 版本、操作系统等
6. **日志/截图**：如有

### 功能建议

请包含：

1. **用例场景**：在什么场景下需要
2. **预期效果**：希望实现什么
3. **替代方案**：是否有其他解决办法

### Issue 模板

```markdown
## Bug 描述

## 复现步骤
1.
2.
3.

## 预期行为

## 实际行为

## 环境
- OS:
- Node version:
- Package version:

## 日志
```

---

## 许可证

通过贡献代码，您同意将您的贡献以 MIT 许可证发布。

---

## 联系方式

- GitHub Issues：问题反馈
- GitHub Discussions：讨论区

感谢您的贡献！🎉
