# Spkrepo API 快速参考

本文档提供 spkrepo 项目 API 的快速参考信息。

---

## 接口速查表

### API 接口

| 接口 | 方法 | 认证 | 功能 |
|------|------|------|------|
| `/api/packages` | POST | API Key | 上传 SPK 包 |

### NAS 接口

| 接口 | 方法 | 认证 | 功能 |
|------|------|------|------|
| `/nas/` | GET/POST | 无 | 获取包目录 |
| `/nas/download/<arch_id>/<firmware>/<build_id>` | GET | 无 | 下载包 |
| `/nas/<path>` | GET | 无 | 获取静态文件 |

### 前端接口

| 接口 | 方法 | 认证 | 功能 |
|------|------|------|------|
| `/` | GET | 无 | 首页 |
| `/profile` | GET/POST | 登录 | 用户资料 |
| `/packages` | GET | 无 | 包列表 |
| `/package/<name>` | GET | 无 | 包详情 |

---

## 认证方式

### API Key 认证

```http
Authorization: Basic <api_key>:
```

**注意**: 
- API Key 作为用户名，密码为空
- 只有 developer 角色可以生成 API Key

---

## 常用请求示例

### 1. 上传 SPK 包

```bash
curl -X POST \
  https://example.com/api/packages \
  -H "Authorization: Basic YOUR_API_KEY:" \
  --data-binary @package.spk
```

**成功响应** (201):
```json
{
  "package": "btsync",
  "version": "1.4.103-10",
  "firmware": "3.1-1594",
  "architectures": ["88f628x"]
}
```

### 2. 查询包目录

```bash
curl "https://example.com/nas?arch=x86_64&build=24922&language=enu&major=6"
```

**成功响应**:
```json
{
  "packages": [
    {
      "package": "btsync",
      "version": "1.4.103-10",
      "dname": "BitTorrent Sync",
      "desc": "BitTorrent Sync application",
      "link": "https://example.com/nas/download/...",
      "thumbnail": ["https://example.com/nas/packages/btsync/10/icon_72.png"],
      "qinst": true,
      "qupgrade": true,
      "qstart": true,
      "download_count": 12345
    }
  ],
  "keyrings": ["-----BEGIN PGP PUBLIC KEY BLOCK-----\n..."]
}
```

### 3. 下载包

```bash
# 方式 1: 通过下载接口（会记录统计）
curl -L "https://example.com/nas/download/1/24922/123"

# 方式 2: 直接访问文件
curl "https://example.com/nas/packages/btsync/10/btsync-x86_64-1.4.103-10.spk"
```

---

## 参数说明

### NAS 包目录查询参数

| 参数 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| arch | string | 是 | 架构代码 | x86_64, 88f628x |
| build | integer | 是 | DSM 构建号 | 24922 |
| language | string | 是 | 语言代码 | enu, chn |
| major | integer | 否 | DSM 主版本 | 6, 7 |
| package_update_channel | string | 否 | 更新通道 | beta |

### 常见架构代码

| 架构 | 说明 | 适用机型 |
|------|------|----------|
| x86_64 | 64位 Intel/AMD | DS918+, DS920+ |
| i686 | 32位 Intel/AMD | DS214play |
| 88f628x | Marvell Kirkwood | DS110j, DS210j |
| armv7 | ARM v7 | DS115j, DS215j |
| aarch64 | ARM 64位 | DS120j, DS220j |
| noarch | 无架构依赖 | 所有机型 |

### 常见语言代码

| 代码 | 语言 |
|------|------|
| enu | 英语（美国）|
| chn | 简体中文 |
| cht | 繁体中文 |
| jpn | 日语 |
| kor | 韩语 |
| ger | 德语 |
| fre | 法语 |

---

## HTTP 状态码

### 成功响应

| 状态码 | 说明 |
|--------|------|
| 200 OK | 请求成功 |
| 201 Created | 资源创建成功 |
| 302 Found | 重定向 |

### 客户端错误

| 状态码 | 说明 | 常见原因 |
|--------|------|----------|
| 400 Bad Request | 请求格式错误 | 缺少参数、参数格式错误 |
| 401 Unauthorized | 未认证 | API Key 无效或缺失 |
| 403 Forbidden | 权限不足 | 无权访问资源 |
| 404 Not Found | 资源不存在 | 包、版本或构建不存在 |
| 409 Conflict | 资源冲突 | Build 已存在 |
| 422 Unprocessable Entity | 数据验证失败 | 无效架构、固件版本 |

### 服务器错误

| 状态码 | 说明 | 常见原因 |
|--------|------|----------|
| 500 Internal Server Error | 服务器错误 | 签名失败、文件系统错误 |

---

## 错误响应格式

```json
{
  "message": "错误描述",
  "details": "详细信息（可选）"
}
```

### 常见错误示例

```json
// 400 Bad Request
{
  "message": "No data to process"
}

// 401 Unauthorized
{
  "message": "Unauthorized"
}

// 403 Forbidden
{
  "message": "Insufficient permissions to create new packages"
}

// 409 Conflict
{
  "message": "Conflicting architectures: 88f628x, armv7"
}

// 422 Unprocessable Entity
{
  "message": "Unknown architecture: myarch"
}

// 500 Internal Server Error
{
  "message": "Failed to sign package",
  "details": "GPG signing failed"
}
```

---

## 用户角色权限

| 角色 | 权限 |
|------|------|
| admin | 完全访问权限，管理界面访问 |
| package_admin | 创建新包，管理所有包 |
| developer | 上传 SPK，生成 API Key，管理自己的包 |
| 普通用户 | 浏览包列表，下载包 |

---

## SPK 包要求

### 基本信息

- **格式**: .spk 文件
- **签名**: 必须未签名（系统会自动签名）
- **命名**: `{package}-{arch}-{version}.spk`

### 必需字段

| 字段 | 说明 | 格式 |
|------|------|------|
| package | 包名 | 字符串 |
| version | 版本号 | `upstream-build` |
| arch | 架构 | 架构代码 |
| firmware | 最低固件 | `X.X-XXXXX` |

### 可选字段

| 字段 | 说明 |
|------|------|
| os_min_ver | 最低固件版本 |
| os_max_ver | 最高固件版本 |
| changelog | 更新日志 |
| report_url | 报告 URL（beta 标识） |
| maintainer | 维护者 |
| install_dep_packages | 依赖包 |
| install_conflict_packages | 冲突包 |

---

## 开发环境设置

### 快速启动

```bash
# 1. 启动数据库
docker compose up db

# 2. 安装依赖
uv sync

# 3. 初始化数据库
uv run flask db upgrade

# 4. 创建管理员
uv run flask spkrepo create_admin -u admin -e admin@example.com -p admin

# 5. 启动服务
uv run flask run
```

### 访问地址

- 网站: http://localhost:5000
- 管理界面: http://localhost:5000/admin
- NAS 接口: http://localhost:5000/nas
- API: http://localhost:5000/api

---

## 常用 CLI 命令

```bash
# 创建用户
uv run flask spkrepo create_user -u username -e email@example.com -p password

# 创建管理员
uv run flask spkrepo create_admin -u admin -e admin@example.com -p password

# 填充测试数据
uv run flask spkrepo populate_db

# 清理测试数据
uv run flask spkrepo depopulate_db

# 分配角色
uv run flask roles add email@example.com admin
uv run flask roles add email@example.com package_admin
uv run flask roles add email@example.com developer

# 数据库迁移
uv run flask db upgrade
uv run flask db revision -m "description"
```

---

## 缓存配置

### 默认缓存时间

- 包目录: 600 秒（10 分钟）
- 架构验证: 600 秒
- 语言验证: 600 秒

### 缓存类型

```python
# 开发环境
CACHE_TYPE = "SimpleCache"

# 生产环境
CACHE_TYPE = "RedisCache"
CACHE_REDIS_URL = "redis://localhost:6379/0"
```

---

## 文件存储结构

```
data/
├── package_name/
│   ├── version_number/
│   │   ├── package-arch-version.spk
│   │   ├── icon_72.png
│   │   ├── icon_256.png
│   │   └── ...
│   └── ...
└── ...
```

---

## 测试示例

### 测试 NAS API

```bash
# DSM 6.x
curl "http://localhost:5000/nas?arch=x86_64&build=24922&language=enu&major=6"

# DSM 7.x
curl "http://localhost:5000/nas?arch=x86_64&build=40000&language=enu&major=7"

# 包含 beta 包
curl "http://localhost:5000/nas?arch=x86_64&build=24922&language=enu&major=6&package_update_channel=beta"
```

### 测试包上传

```bash
# 需要先获取 API Key
curl -X POST \
  http://localhost:5000/api/packages \
  -H "Authorization: Basic YOUR_API_KEY:" \
  --data-binary @test.spk
```

---

## 常见问题

### Q: 如何获取 API Key?

A: 
1. 注册账户
2. 获取 developer 角色
3. 访问 `/profile` 页面生成 API Key

### Q: 为什么上传包时返回 403?

A: 可能原因：
1. 没有 developer 角色
2. 包不存在且没有 package_admin 角色
3. 包存在但不是维护者

### Q: 为什么 NAS 查询不到包?

A: 可能原因：
1. Build 未激活
2. 架构不匹配
3. 固件版本不兼容
4. 缓存未更新

### Q: 如何激活 Build?

A: 通过管理界面 `/admin` 激活

---

## 相关链接

- **项目仓库**: https://github.com/SynoCommunity/spkrepo
- **官方文档**: https://spkrepo.readthedocs.io/
- **SynoCommunity**: https://synocommunity.com/
- **Synology 开发者**: https://developer.synology.com/

---

## 更新日志

- **v0.1** (2014-11-30): 初始版本

---

## 联系方式

- GitHub Issues: https://github.com/SynoCommunity/spkrepo/issues
- Email: contact@synocommunity.com
