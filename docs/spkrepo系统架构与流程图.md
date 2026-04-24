# Spkrepo 系统架构与流程图

本文档提供 spkrepo 项目的系统架构图和关键流程的可视化说明。

---

## 系统架构概览

```mermaid
graph TB
    subgraph "客户端"
        NAS[Synology NAS]
        Browser[浏览器]
        API_Client[API 客户端]
    end

    subgraph "Spkrepo 应用"
        Router[路由层]
        
        subgraph "视图层"
            API[API 接口<br/>/api]
            NAS_API[NAS 接口<br/>/nas]
            Frontend[前端页面<br/>/]
            Admin[管理界面<br/>/admin]
        end

        subgraph "业务层"
            Auth[认证授权]
            Package_Mgr[包管理]
            Version_Mgr[版本管理]
            Build_Mgr[构建管理]
            Sign_Service[签名服务]
        end

        subgraph "数据层"
            Models[数据模型]
            Cache[缓存层]
        end
    end

    subgraph "存储层"
        PostgreSQL[(PostgreSQL<br/>数据库)]
        FileSystem[文件系统<br/>SPK 存储]
        GPG[GPG 密钥]
    end

    NAS --> Router
    Browser --> Router
    API_Client --> Router

    Router --> API
    Router --> NAS_API
    Router --> Frontend
    Router --> Admin

    API --> Auth
    NAS_API --> Package_Mgr
    Frontend --> Package_Mgr
    Admin --> Package_Mgr

    Auth --> Package_Mgr
    Package_Mgr --> Version_Mgr
    Version_Mgr --> Build_Mgr
    Build_Mgr --> Sign_Service

    Package_Mgr --> Models
    Version_Mgr --> Models
    Build_Mgr --> Models
    Models --> PostgreSQL
    Models --> Cache

    Build_Mgr --> FileSystem
    Sign_Service --> GPG

    style Router fill:#e1f5ff
    style API fill:#fff4e1
    style NAS_API fill:#fff4e1
    style Frontend fill:#e8f5e9
    style Admin fill:#f3e5f5
    style PostgreSQL fill:#ffebee
    style FileSystem fill:#ffebee
```

---

## 用户角色与权限

```mermaid
graph LR
    subgraph "用户角色层级"
        Admin[管理员<br/>admin]
        PkgAdmin[包管理员<br/>package_admin]
        Developer[开发者<br/>developer]
        User[普通用户]
    end

    Admin -->|继承| PkgAdmin
    PkgAdmin -->|继承| Developer
    Developer -->|继承| User

    subgraph "权限说明"
        P1[完全访问权限<br/>管理界面访问]
        P2[创建新包<br/>管理所有包]
        P3[上传 SPK<br/>生成 API Key<br/>管理自己的包]
        P4[浏览包列表<br/>下载包]
    end

    Admin -.-> P1
    PkgAdmin -.-> P2
    Developer -.-> P3
    User -.-> P4

    style Admin fill:#ffcdd2
    style PkgAdmin fill:#f8bbd0
    style Developer fill:#e1bee7
    style User fill:#d1c4e9
```

---

## SPK 包上传流程

```mermaid
sequenceDiagram
    participant Client as API 客户端
    participant API as API 接口
    participant Auth as 认证模块
    participant SPK as SPK 解析器
    participant DB as 数据库
    participant Sign as 签名服务
    participant FS as 文件系统

    Client->>API: POST /api/packages<br/>Authorization: Basic API_KEY
    API->>Auth: 验证 API Key
    Auth->>Auth: 检查 developer 角色
    
    alt 认证失败
        Auth-->>API: 401 Unauthorized
        API-->>Client: 认证失败
    else 认证成功
        Auth-->>API: 认证成功
        API->>SPK: 解析 SPK 文件
        
        alt SPK 格式错误
            SPK-->>API: 解析失败
            API-->>Client: 422 Unprocessable Entity
        else SPK 格式正确
            SPK->>SPK: 检查签名
            
            alt 已签名
                SPK-->>API: 拒绝已签名包
                API-->>Client: 422 拒绝已签名包
            else 未签名
                SPK->>DB: 验证架构
                SPK->>DB: 验证固件版本
                
                API->>DB: 查询 Package
                
                alt 包不存在
                    API->>Auth: 检查 package_admin 角色
                    
                    alt 无权限
                        Auth-->>API: 权限不足
                        API-->>Client: 403 Forbidden
                    else 有权限
                        API->>DB: 创建新 Package
                    end
                else 包存在
                    API->>Auth: 检查是否为维护者
                    
                    alt 不是维护者
                        Auth-->>API: 权限不足
                        API-->>Client: 403 Forbidden
                    end
                end
                
                API->>DB: 查询 Version
                
                alt 版本不存在
                    API->>DB: 创建新 Version
                end
                
                API->>DB: 查询 Build
                
                alt Build 已存在
                    DB-->>API: Build 冲突
                    API-->>Client: 409 Conflict
                else Build 不存在
                    API->>Sign: 签名 SPK 包
                    Sign->>FS: 保存签名后的包
                    Sign->>FS: 保存图标文件
                    
                    API->>DB: 创建 Build 记录
                    API->>DB: 提交事务
                    
                    API-->>Client: 201 Created<br/>返回包信息
                end
            end
        end
    end
```

---

## NAS 包目录查询流程

```mermaid
sequenceDiagram
    participant NAS as Synology NAS
    participant NAS_API as NAS 接口
    participant Cache as 缓存层
    participant DB as 数据库
    participant FS as 文件系统

    NAS->>NAS_API: GET /nas/<br/>?arch=x86_64&build=24922<br/>&language=enu&major=6

    NAS_API->>NAS_API: 验证必需参数
    
    alt 参数缺失
        NAS_API-->>NAS: 400 Bad Request
    else 参数完整
        NAS_API->>Cache: 查询缓存<br/>key: (arch, build, major, language, beta)
        
        alt 缓存命中
            Cache-->>NAS_API: 返回缓存数据
            NAS_API-->>NAS: JSON 响应
        else 缓存未命中
            NAS_API->>Cache: 验证架构
            Cache-->>NAS_API: 架构有效

            NAS_API->>Cache: 验证语言
            Cache-->>NAS_API: 语言有效

            NAS_API->>DB: 查询最新版本
            Note over DB: 复杂查询<br/>1. 过滤架构和固件<br/>2. 排除 beta（如需要）<br/>3. 获取最新版本<br/>4. 获取最新固件

            DB-->>NAS_API: 返回 Build 列表

            loop 对每个 Build
                NAS_API->>NAS_API: 构建包条目
                NAS_API->>FS: 获取图标 URL
                NAS_API->>DB: 获取下载统计
            end

            NAS_API->>NAS_API: 组装响应数据
            
            alt DSM 5.1+
                NAS_API->>DB: 获取 GPG 公钥
                NAS_API->>NAS_API: 添加 keyrings
            end

            NAS_API->>Cache: 缓存响应数据
            NAS_API-->>NAS: JSON 响应
        end
    end
```

---

## 包下载流程

```mermaid
sequenceDiagram
    participant NAS as Synology NAS
    participant NAS_API as NAS 接口
    participant DB as 数据库
    participant FS as 文件系统

    NAS->>NAS_API: GET /nas/download/<arch_id>/<firmware>/<build_id>

    NAS_API->>DB: 查询 Build
    
    alt Build 不存在
        DB-->>NAS_API: 404 Not Found
        NAS_API-->>NAS: Build 不存在
    else Build 存在
        DB-->>NAS_API: 返回 Build
        
        alt Build 未激活
            NAS_API-->>NAS: 403 Forbidden
        else Build 已激活
            NAS_API->>DB: 查询 Architecture
            
            alt 架构不存在
                DB-->>NAS_API: 404 Not Found
                NAS_API-->>NAS: 架构不存在
            else 架构存在
                NAS_API->>NAS_API: 验证架构匹配
                NAS_API->>NAS_API: 验证固件兼容性
                
                alt 验证失败
                    NAS_API-->>NAS: 400 Bad Request
                else 验证成功
                    NAS_API->>DB: 创建 Download 记录
                    Note over DB: 记录：<br/>- Build<br/>- Architecture<br/>- Firmware<br/>- IP 地址<br/>- User-Agent<br/>- 时间戳

                    NAS_API->>NAS_API: 生成文件 URL
                    NAS_API-->>NAS: 302 重定向到文件

                    NAS->>FS: GET /nas/<path>
                    FS-->>NAS: 返回 SPK 文件
                end
            end
        end
    end
```

---

## 数据模型关系

```mermaid
erDiagram
    User ||--o{ Package : "创建/维护"
    User ||--o{ Build : "发布"
    User ||--o{ Download : "下载"
    
    Package ||--o{ Version : "包含"
    Package ||--o{ Screenshot : "展示"
    
    Version ||--o{ Build : "构建"
    Version ||--o{ Icon : "图标"
    Version ||--o{ DisplayName : "显示名"
    Version ||--o{ Description : "描述"
    Version ||--o| Service : "依赖"
    
    Build }o--o{ Architecture : "支持"
    Build ||--o| Firmware : "最低固件"
    Build ||--o| Firmware : "最高固件"
    Build ||--o| BuildManifest : "清单"
    Build ||--o{ Download : "记录"

    User {
        int id PK
        string username UK
        string email UK
        string password
        string api_key
        boolean active
    }

    Package {
        int id PK
        string name UK
        int author_id FK
        int download_count
    }

    Version {
        int id PK
        int package_id FK
        int version
        string upstream_version
        string changelog
        string report_url
        boolean install_wizard
        boolean upgrade_wizard
        boolean startable
    }

    Build {
        int id PK
        int version_id FK
        string path
        string checksum
        string md5
        boolean active
        int publisher_id FK
    }

    Architecture {
        int id PK
        string code UK
        string name
    }

    Firmware {
        int id PK
        string version
        int build UK
        string type
    }

    BuildManifest {
        int id PK
        int build_id FK
        string dependencies
        string conflicts
        json conf_privilege
        json conf_resource
    }

    Download {
        int id PK
        int build_id FK
        int architecture_id FK
        int firmware_build
        string ip_address
        string user_agent
        timestamp timestamp
    }
```

---

## 缓存策略

```mermaid
graph TB
    subgraph "请求流程"
        Request[请求到达]
        Check{缓存检查}
        Hit[缓存命中]
        Miss[缓存未命中]
        Query[查询数据库]
        Process[处理数据]
        Store[存储缓存]
        Response[返回响应]
    end

    Request --> Check
    Check -->|存在| Hit
    Check -->|不存在| Miss
    Hit --> Response
    Miss --> Query
    Query --> Process
    Process --> Store
    Store --> Response

    subgraph "缓存内容"
        C1[包目录<br/>TTL: 600s]
        C2[架构验证<br/>TTL: 600s]
        C3[语言验证<br/>TTL: 600s]
    end

    subgraph "缓存键"
        K1["(arch, build, major,<br/>language, beta)"]
        K2["arch"]
        K3["language"]
    end

    C1 -.-> K1
    C2 -.-> K2
    C3 -.-> K3

    style Request fill:#e1f5ff
    style Hit fill:#e8f5e9
    style Miss fill:#fff4e1
    style Store fill:#f3e5f5
```

---

## 包签名流程

```mermaid
sequenceDiagram
    participant API as API 接口
    participant SPK as SPK 对象
    participant GPG as GPG 服务
    participant TS as 时间戳服务
    participant FS as 文件系统

    API->>SPK: 接收未签名 SPK
    SPK->>SPK: 解析 SPK 内容
    SPK->>SPK: 验证无签名

    API->>GPG: 初始化 GPG
    GPG->>GPG: 加载私钥

    API->>SPK: 调用签名方法
    SPK->>TS: 请求时间戳
    TS-->>SPK: 返回时间戳

    SPK->>GPG: 签名数据
    GPG->>GPG: 生成签名
    GPG-->>SPK: 返回签名

    SPK->>SPK: 添加签名到 SPK
    SPK->>FS: 保存签名后的文件

    SPK-->>API: 返回成功
```

---

## 前端页面流程

```mermaid
graph TB
    subgraph "用户访问流程"
        Start[用户访问]
        Home[首页]
        Login{已登录?}
        Profile[个人资料]
        Packages[包列表]
        PackageDetail[包详情]
    end

    Start --> Home
    Home --> Login
    Login -->|是| Profile
    Login -->|否| Packages
    Profile --> Packages
    Packages --> PackageDetail

    subgraph "个人资料功能"
        P1[查看 API Key]
        P2[生成新 API Key]
        P3[修改密码]
    end

    Profile --> P1
    Profile --> P2
    Profile --> P3

    subgraph "包列表功能"
        L1[浏览所有包]
        L2[搜索包]
        L3[查看最新版本]
    end

    Packages --> L1
    Packages --> L2
    Packages --> L3

    subgraph "包详情功能"
        D1[查看版本历史]
        D2[查看截图]
        D3[查看下载统计]
        D4[下载包]
    end

    PackageDetail --> D1
    PackageDetail --> D2
    PackageDetail --> D3
    PackageDetail --> D4

    style Start fill:#e1f5ff
    style Home fill:#e8f5e9
    style Profile fill:#f3e5f5
    style Packages fill:#fff4e1
    style PackageDetail fill:#ffebee
```

---

## 管理界面功能

```mermaid
graph LR
    subgraph "管理模块"
        Admin[管理界面]
        
        subgraph "用户管理"
            UM[用户列表]
            UC[创建用户]
            UE[编辑用户]
            UD[删除用户]
            UR[角色分配]
        end

        subgraph "包管理"
            PM[包列表]
            PC[创建包]
            PE[编辑包]
            PD[删除包]
            PA[维护者分配]
        end

        subgraph "版本管理"
            VM[版本列表]
            VC[创建版本]
            VE[编辑版本]
            VD[删除版本]
            VI[图标管理]
        end

        subgraph "构建管理"
            BM[构建列表]
            BC[创建构建]
            BE[编辑构建]
            BD[删除构建]
            BA[激活/停用]
        end

        subgraph "系统管理"
            AM[架构管理]
            FM[固件管理]
            SM[服务管理]
            SC[截图管理]
        end
    end

    Admin --> UM
    Admin --> PM
    Admin --> VM
    Admin --> BM
    Admin --> AM

    UM --> UC
    UM --> UE
    UM --> UD
    UM --> UR

    PM --> PC
    PM --> PE
    PM --> PD
    PM --> PA

    VM --> VC
    VM --> VE
    VM --> VD
    VM --> VI

    BM --> BC
    BM --> BE
    BM --> BD
    BM --> BA

    AM --> FM
    AM --> SM
    AM --> SC

    style Admin fill:#f3e5f5
    style UM fill:#e1bee7
    style PM fill:#fff4e1
    style VM fill:#e8f5e9
    style BM fill:#ffebee
    style AM fill:#e1f5ff
```

---

## 错误处理流程

```mermaid
graph TB
    subgraph "错误类型"
        E400[400 Bad Request]
        E401[401 Unauthorized]
        E403[403 Forbidden]
        E404[404 Not Found]
        E409[409 Conflict]
        E422[422 Unprocessable Entity]
        E500[500 Internal Server Error]
    end

    subgraph "错误原因"
        R1[缺少参数]
        R2[参数格式错误]
        R3[认证失败]
        R4[权限不足]
        R5[资源不存在]
        R6[资源冲突]
        R7[数据验证失败]
        R8[服务器错误]
    end

    E400 --> R1
    E400 --> R2
    E401 --> R3
    E403 --> R4
    E404 --> R5
    E409 --> R6
    E422 --> R7
    E500 --> R8

    subgraph "错误响应格式"
        Format[JSON 格式]
        Message["message: 错误描述"]
        Details["details: 详细信息（可选）"]
    end

    E400 --> Format
    E401 --> Format
    E403 --> Format
    E404 --> Format
    E409 --> Format
    E422 --> Format
    E500 --> Format

    Format --> Message
    Format --> Details

    style E400 fill:#ffebee
    style E401 fill:#fff4e1
    style E403 fill:#f3e5f5
    style E404 fill:#e8f5e9
    style E409 fill:#e1f5ff
    style E422 fill:#fce4ec
    style E500 fill:#d32f2f
```

---

## 部署架构

```mermaid
graph TB
    subgraph "生产环境"
        LB[负载均衡器]
        
        subgraph "应用服务器集群"
            App1[Spkrepo 实例 1]
            App2[Spkrepo 实例 2]
            App3[Spkrepo 实例 N]
        end

        subgraph "缓存层"
            Redis[(Redis 缓存)]
        end

        subgraph "数据库层"
            Master[(PostgreSQL<br/>主库)]
            Slave[(PostgreSQL<br/>从库)]
        end

        subgraph "存储层"
            NFS[NFS/共享存储]
            GPG[GPG 密钥存储]
        end
    end

    LB --> App1
    LB --> App2
    LB --> App3

    App1 --> Redis
    App2 --> Redis
    App3 --> Redis

    App1 --> Master
    App2 --> Master
    App3 --> Master

    Master --> Slave

    App1 --> NFS
    App2 --> NFS
    App3 --> NFS

    App1 --> GPG
    App2 --> GPG
    App3 --> GPG

    style LB fill:#e1f5ff
    style App1 fill:#fff4e1
    style App2 fill:#fff4e1
    style App3 fill:#fff4e1
    style Redis fill:#e8f5e9
    style Master fill:#ffebee
    style Slave fill:#ffebee
    style NFS fill:#f3e5f5
```

---

## 开发环境架构

```mermaid
graph TB
    subgraph "开发环境"
        Dev[开发机器]
        
        subgraph "Docker 容器"
            DB[PostgreSQL 容器]
        end

        subgraph "本地服务"
            Flask[Flask 开发服务器<br/>localhost:5000]
            FS[本地文件系统<br/>./data]
        end
    end

    Dev --> Flask
    Flask --> DB
    Flask --> FS

    subgraph "访问入口"
        Browser[浏览器<br/>http://localhost:5000]
        NAS[模拟 NAS<br/>curl 请求]
        API[API 测试<br/>Postman/curl]
    end

    Browser --> Flask
    NAS --> Flask
    API --> Flask

    style Dev fill:#e1f5ff
    style Flask fill:#fff4e1
    style DB fill:#ffebee
    style FS fill:#f3e5f5
```

---

## 总结

本文档通过 Mermaid 图表展示了 spkrepo 系统的核心架构和工作流程：

1. **系统架构**: 清晰展示了从客户端到存储层的完整架构
2. **用户权限**: 说明了不同角色的权限层级
3. **核心流程**: 详细展示了上传、查询、下载等关键流程
4. **数据模型**: 展示了核心数据实体及其关系
5. **缓存策略**: 说明了缓存的使用方式和策略
6. **错误处理**: 展示了错误类型和处理方式
7. **部署架构**: 展示了生产和开发环境的部署方式

这些图表可以帮助开发者快速理解系统的工作原理，便于后续的开发和维护工作。
