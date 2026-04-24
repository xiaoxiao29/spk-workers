# Spkrepo 项目接口文档

## 项目概述

Spkrepo 是一个功能丰富的 Synology Package Repository 应用程序，兼容 DSM 4.2 及以上版本。它提供了 API、高级权限管理和后台管理界面。

**项目地址**: https://github.com/SynoCommunity/spkrepo

**技术栈**: Python Flask + PostgreSQL + Flask-Admin

**主要功能**:
- SPK 包上传和管理
- NAS 设备包目录查询
- 用户权限管理
- 包签名验证
- 下载统计

---

## 认证机制

### API 认证

访问 API 需要满足以下条件：
1. 用户必须已注册
2. 用户必须拥有 `developer` 角色
3. 用户必须从个人资料页面生成 API Key

**认证方式**: HTTP Basic Authentication
- Authorization header 必须包含 API Key 作为用户名
- 无需密码

**示例**:
```http
Authorization: Basic <api_key>:
```

**注意**: 
- 出于安全考虑，同一时间只能有一个有效的 API Key
- 如果 API Key 泄露，可以从个人资料页面重新生成

### 错误响应

认证失败时返回 `401 Unauthorized`

---

## API 接口

### 基础信息

- **基础路径**: `/api`
- **返回格式**: JSON
- **HTTP 状态码**: 标准 HTTP 状态码

### 1. 上传 SPK 包

**接口**: `POST /api/packages`

**功能**: 将 SPK 包上传到仓库

**认证**: 需要 API Key 认证

**请求体**: SPK 文件二进制数据

**处理流程**:
1. 首先根据包名创建 Package（如果不存在）
   - 只有 `package_admin` 角色的用户可以创建新包
   - 其他用户必须被定义为包的维护者
2. 然后创建 Version 及其相关关系（如果不存在）
3. 最后创建 Build 及其相关关系并保存文件

**请求示例**:
```bash
curl -X POST \
  https://example.com/api/packages \
  -H "Authorization: Basic <api_key>:" \
  --data-binary @package.spk
```

**成功响应** (201 Created):
```json
{
  "package": "btsync",
  "version": "1.4.103-10",
  "firmware": "3.1-1594",
  "architectures": ["88f628x"]
}
```

**错误响应**:

| 状态码 | 说明 |
|--------|------|
| 400 Bad Request | 请求体为空 |
| 401 Unauthorized | 认证失败 |
| 403 Forbidden | 权限不足 |
| 409 Conflict | Build 已存在 |
| 422 Unprocessable Entity | 无效或格式错误的 SPK |
| 500 Internal Server Error | 签名或文件系统问题 |

**错误响应示例**:
```json
{
  "message": "Unknown architecture: myarch"
}
```

**注意事项**:
- 创建的 Build 默认不是 active 状态
- 拒绝已签名的包
- 支持的架构必须在系统中定义
- 固件版本格式必须为 `X.X-XXXXX`

---

## NAS 接口

### 基础信息

- **基础路径**: `/nas`
- **返回格式**: JSON
- **用途**: 供 Synology NAS 设备查询和下载包

### 1. 获取包目录

**接口**: `POST /nas/` 或 `GET /nas/`

**功能**: 获取适用于特定 NAS 设备的包目录

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| build | integer | 是 | DSM 构建号 |
| arch | string | 是 | 架构代码 |
| language | string | 是 | 语言代码（如 enu） |
| major | integer | 否 | DSM 主版本号 |
| package_update_channel | string | 否 | 更新通道（beta） |

**请求示例**:
```bash
curl "http://localhost:5000/nas?package_update_channel=beta&build=24922&language=enu&major=6&micro=2&arch=x86_64&minor=2"
```

**成功响应** (DSM 5.1+):
```json
{
  "packages": [
    {
      "package": "btsync",
      "version": "1.4.103-10",
      "dname": "BitTorrent Sync",
      "desc": "BitTorrent Sync application",
      "link": "http://example.com/nas/download/1/24922/123",
      "thumbnail": [
        "http://example.com/nas/packages/btsync/10/icon_72.png"
      ],
      "qinst": true,
      "qupgrade": true,
      "qstart": true,
      "deppkgs": "openssl",
      "conflictpkgs": null,
      "download_count": 12345
    }
  ],
  "keyrings": [
    "-----BEGIN PGP PUBLIC KEY BLOCK-----\n..."
  ]
}
```

**包条目字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| package | string | 包名 |
| version | string | 版本字符串 |
| dname | string | 显示名称 |
| desc | string | 描述 |
| link | string | 下载链接 |
| thumbnail | array | 缩略图 URL 列表 |
| qinst | boolean | 是否可以静默安装 |
| qupgrade | boolean | 是否可以静默升级 |
| qstart | boolean | 是否可以静默启动 |
| deppkgs | string | 依赖包 |
| conflictpkgs | string | 冲突包 |
| download_count | integer | 下载次数 |
| conf_deppkgs | object | 配置依赖 |
| conf_conxpkgs | object | 配置冲突 |
| conf_privilege | object | 权限配置 |
| conf_resource | object | 资源配置 |

**错误响应**:

| 状态码 | 说明 |
|--------|------|
| 400 Bad Request | 缺少必要参数 |
| 422 Unprocessable Entity | 无效的架构或语言 |

**缓存**: 
- 响应会被缓存 600 秒（10 分钟）
- 架构和语言验证结果也会被缓存

**特殊逻辑**:
- DSM 7.0+ (build >= 40000) 不会返回 beta 包
- 自动过滤不兼容的架构和固件版本
- 支持无架构包 (noarch)

### 2. 下载包

**接口**: `GET /nas/download/<architecture_id>/<firmware_build>/<build_id>`

**功能**: 下载指定的 SPK 包并记录下载统计

**路径参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| architecture_id | integer | 架构 ID |
| firmware_build | integer | 固件构建号 |
| build_id | integer | 构建 ID |

**处理流程**:
1. 验证 Build 是否存在且 active
2. 验证架构是否匹配
3. 验证固件版本是否兼容
4. 记录下载信息到数据库（IP、User-Agent 等）
5. 重定向到实际文件路径

**成功响应**: 302 重定向到文件下载路径

**错误响应**:

| 状态码 | 说明 |
|--------|------|
| 400 Bad Request | 架构或固件不匹配 |
| 403 Forbidden | Build 不 active |
| 404 Not Found | Build 或架构不存在 |

**下载记录字段**:
- build: 关联的 Build
- architecture: 架构
- firmware_build: 固件构建号
- ip_address: 客户端 IP
- user_agent: 客户端 User-Agent

### 3. 获取数据文件

**接口**: `GET /nas/<path:path>`

**功能**: 从数据目录提供静态文件服务

**路径参数**:
- path: 文件相对路径

**用途**: 
- 提供 SPK 文件下载
- 提供包图标文件
- 提供其他静态资源

**示例**:
```bash
# 下载 SPK 文件
GET /nas/packages/btsync/10/btsync-x86_64-1.4.103-10.spk

# 获取图标
GET /nas/packages/btsync/10/icon_72.png
```

---

## 前端接口

### 基础信息

- **基础路径**: `/`
- **返回格式**: HTML
- **用途**: 提供用户界面

### 1. 首页

**接口**: `GET /`

**功能**: 显示网站首页

**认证**: 无需认证

**响应**: HTML 页面

### 2. 用户资料页面

**接口**: `GET /profile`

**功能**: 显示和编辑用户资料，生成 API Key

**认证**: 需要用户登录

**功能**:
- 查看当前 API Key
- 生成新的 API Key
- 修改密码

**请求方法**:
- `GET`: 显示资料页面
- `POST`: 生成新的 API Key

**API Key 生成规则**:
- 使用 `os.urandom(32)` 生成随机数据
- 通过 SHA256 哈希生成 64 位十六进制字符串

**注意**: 只有拥有 `developer` 角色的用户才能生成 API Key

### 3. 包列表页面

**接口**: `GET /packages`

**功能**: 显示所有可用包的列表

**认证**: 无需认证

**显示内容**:
- 包名
- 最新版本
- 图标
- 显示名称
- 描述

**数据查询**:
- 只显示至少有一个版本的包
- 不考虑 Build 是否 active
- 按包名排序

**响应**: HTML 页面

### 4. 包详情页面

**接口**: `GET /package/<name>`

**功能**: 显示指定包的详细信息

**路径参数**:
- name: 包名

**认证**: 无需认证

**显示内容**:
- 包基本信息
- 所有版本列表
- 截图
- 下载统计

**错误响应**:
- 404 Not Found: 包不存在或没有版本

**响应**: HTML 页面

---

## 管理接口

### 基础信息

- **基础路径**: `/admin`
- **返回格式**: HTML
- **认证**: 需要管理员权限
- **框架**: Flask-Admin

### 管理模块

系统提供以下管理视图：

1. **用户管理** (UserView)
   - 用户创建、编辑、删除
   - 角色分配
   - API Key 管理

2. **架构管理** (ArchitectureView)
   - 架构定义
   - Synology 架构映射

3. **固件管理** (FirmwareView)
   - DSM 版本管理
   - 构建号管理

4. **服务管理** (ServiceView)
   - 系统服务定义
   - 服务依赖关系

5. **截图管理** (ScreenshotView)
   - 包截图管理

6. **包管理** (PackageView)
   - 包信息管理
   - 维护者分配
   - 下载统计查看

7. **版本管理** (VersionView)
   - 版本信息管理
   - 多语言支持
   - 图标管理

8. **构建管理** (BuildView)
   - 构建配置
   - 激活/停用
   - 文件管理

### 管理界面功能

- 数据表格展示
- 搜索和过滤
- 批量操作
- 数据导出
- 关系编辑

---

## 数据模型

### 核心模型

#### Package (包)
- name: 包名（唯一）
- author: 作者
- maintainers: 维护者列表
- versions: 版本列表
- screenshots: 截图列表
- download_count: 下载次数

#### Version (版本)
- package: 所属包
- version: 版本号
- upstream_version: 上游版本
- changelog: 更新日志
- report_url: 报告 URL（beta 标识）
- distributor: 分发者
- maintainer: 维护者
- install_wizard: 安装向导
- upgrade_wizard: 升级向导
- startable: 是否可启动
- icons: 图标字典
- displaynames: 显示名称字典
- descriptions: 描述字典

#### Build (构建)
- version: 所属版本
- architectures: 架构列表
- firmware_min: 最低固件
- firmware_max: 最高固件
- publisher: 发布者
- path: 文件路径
- checksum: 校验和
- md5: MD5 哈希
- active: 是否激活
- buildmanifest: 构建清单

#### Architecture (架构)
- code: 架构代码
- name: 架构名称
- from_syno: Synology 架构映射

#### Firmware (固件)
- version: 版本号
- build: 构建号
- type: 类型（dsm）

### 辅助模型

#### BuildManifest (构建清单)
- dependencies: 依赖包
- conf_dependencies: 配置依赖
- conflicts: 冲突包
- conf_conflicts: 配置冲突
- conf_privilege: 权限配置
- conf_resource: 资源配置

#### Icon (图标)
- size: 尺寸
- path: 文件路径

#### DisplayName (显示名称)
- language: 语言
- displayname: 显示名称

#### Description (描述)
- language: 语言
- description: 描述

#### Download (下载记录)
- build: 关联构建
- architecture: 架构
- firmware_build: 固件构建号
- ip_address: IP 地址
- user_agent: User-Agent
- timestamp: 时间戳

---

## 权限系统

### 用户角色

1. **admin** (管理员)
   - 完全访问权限
   - 可以访问管理界面
   - 可以管理所有资源

2. **package_admin** (包管理员)
   - 可以创建新包
   - 可以管理所有包
   - 可以上传任何包的版本

3. **developer** (开发者)
   - 可以上传 SPK 包
   - 可以生成 API Key
   - 只能管理自己是维护者的包

### 权限检查流程

1. **创建新包**:
   - 需要 `package_admin` 角色
   - 或被添加为包的维护者

2. **上传版本**:
   - 需要 `developer` 角色
   - 包必须存在
   - 必须是包的维护者或 `package_admin`

3. **访问管理界面**:
   - 需要 `admin` 角色

---

## 包签名机制

### 签名流程

1. 接收未签名的 SPK 包
2. 使用 GPG 私钥对包进行签名
3. 保存签名后的包到文件系统

### 配置要求

```python
# config.py
GNUPG_PATH = "/usr/local/bin/gpg"  # GPG 可执行文件路径
GNUPG_TIMESTAMP_URL = "http://timestamp.example.com"  # 时间戳服务
GNUPG_FINGERPRINT = "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"  # 密钥指纹
```

### 注意事项

- 已签名的包会被拒绝
- 签名失败会返回 500 错误
- DSM 5.1+ 会在目录响应中包含公钥

---

## 缓存策略

### 缓存配置

```python
CACHE_TYPE = "SimpleCache"  # 或其他 Flask-Caching 后端
CACHE_DEFAULT_TIMEOUT = 600  # 10 分钟
```

### 缓存内容

1. **包目录** (`get_catalog`)
   - 缓存时间: 600 秒
   - 键: (arch, build, major, language, beta)

2. **架构验证** (`is_valid_arch`)
   - 缓存时间: 600 秒
   - 键: arch

3. **语言验证** (`is_valid_language`)
   - 缓存时间: 600 秒
   - 键: language

---

## 文件存储

### 目录结构

```
data/
├── package_name/
│   ├── version_number/
│   │   ├── package_arch-version.spk
│   │   ├── icon_72.png
│   │   ├── icon_256.png
│   │   └── ...
│   └── ...
└── ...
```

### 文件命名规则

```
{package}-{arch}-{version}-{build}.spk
```

示例:
```
btsync-x86_64-1.4.103-10.spk
```

---

## 错误处理

### 标准错误响应格式

```json
{
  "message": "错误描述信息",
  "details": "详细错误信息（可选）"
}
```

### 常见错误码

| 状态码 | 说明 | 常见原因 |
|--------|------|----------|
| 400 | Bad Request | 缺少必要参数、参数格式错误 |
| 401 | Unauthorized | 未提供认证信息、API Key 无效 |
| 403 | Forbidden | 权限不足、Build 未激活 |
| 404 | Not Found | 资源不存在 |
| 409 | Conflict | 资源冲突（如 Build 已存在） |
| 422 | Unprocessable Entity | 数据验证失败、格式错误 |
| 500 | Internal Server Error | 服务器内部错误、签名失败 |

---

## 开发和测试

### 本地开发环境

```bash
# 启动数据库
docker compose up db

# 安装依赖
uv sync

# 初始化数据库
uv run flask db upgrade

# 填充测试数据
uv run flask spkrepo populate_db

# 创建管理员账户
uv run flask spkrepo create_admin -u admin -e admin@example.com -p adminadmin

# 启动开发服务器
uv run flask run
```

### 测试 API

```bash
# 测试 NAS API
curl "http://localhost:5000/nas?package_update_channel=beta&build=24922&language=enu&major=6&micro=2&arch=x86_64&minor=2"

# 上传包（需要 API Key）
curl -X POST \
  http://localhost:5000/api/packages \
  -H "Authorization: Basic YOUR_API_KEY:" \
  --data-binary @package.spk
```

---

## 部署建议

### 生产环境配置

```python
# config.py
DEBUG = False
TESTING = False
SECRET_KEY = "随机生成的密钥"
SQLALCHEMY_DATABASE_URI = "postgresql://user:pass@localhost/dbname"
CACHE_TYPE = "RedisCache"  # 或其他生产级缓存
GNUPG_PATH = "/usr/local/bin/gpg"
```

### WSGI 部署

```bash
# 使用 Gunicorn
SPKREPO_CONFIG="$PWD/config.py" gunicorn -w 4 'wsgi:app'

# 或使用 uv
SPKREPO_CONFIG="$PWD/config.py" uv run --with gunicorn gunicorn -b 0.0.0.0:8080 -w 4 wsgi:app
```

### Docker 部署

```bash
# 使用 Docker
docker run -it --rm \
  --name spkrepo \
  -v $(pwd)/data:/data \
  -v $(pwd)/config.py:/config.py \
  -e SPKREPO_CONFIG=/config.py \
  -p 8000:8000 \
  ghcr.io/synocommunity/spkrepo
```

---

## 参考资源

- **项目仓库**: https://github.com/SynoCommunity/spkrepo
- **官方文档**: https://spkrepo.readthedocs.io/
- **API 文档**: https://spkrepo.readthedocs.io/en/latest/api.html
- **SynoCommunity**: https://synocommunity.com/
- **Synology DSM 开发**: https://developer.synology.com/

---

## 更新日志

### v0.1 (2014-11-30)
- 初始版本发布
- 基本的包管理功能
- API 接口
- 管理界面
- 用户权限系统

---

## 联系方式

- **GitHub Issues**: https://github.com/SynoCommunity/spkrepo/issues
- **Email**: contact@synocommunity.com
- **Discord**: SynoCommunity Discord 服务器
