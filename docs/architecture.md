# 架构概述

## 项目简介

RAG（检索增强生成）知识库应用，基于 Spring Boot 4 构建。支持文档上传、解析、向量化存储，提供智能问答、多模态图片问答、流式响应等核心功能，并内置完整的 JWT + RBAC 认证授权体系。

---

## 技术栈

| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 运行时 | Java | 21 | 基础运行环境 |
| 框架 | Spring Boot | 4.0.2 | Web + 安全 + JPA |
| 安全 | Spring Security + jjwt | 0.12.6 | JWT 无状态认证 + RBAC |
| ORM | Spring Data JPA / Hibernate | - | MySQL 数据访问，DDL auto=update |
| 向量数据库 | Qdrant | gRPC 6334 / HTTP 6333 | 768 维向量存储与检索 |
| 关系数据库 | MySQL | Docker | 主数据库，schema `knowledge_rag` |
| LLM 编排 | LangChain4j | 1.12.2 | ChatModel / StreamingChatModel / EmbeddingModel |
| 聊天模型 | vLLM → Qwen2.5-7B-Instruct | OpenAI 兼容协议 | 文本生成 |
| 嵌入模型 | vLLM → BAAI/bge-base-zh-v1.5 | 768 维 | 中文文本向量化 |
| 文档解析 | Apache PDFBox | 3.0.3 | PDF 文本提取 |
| 文档解析 | Apache POI | 5.3.0 | DOCX/DOC 文本和图片提取 |
| 工具 | Lombok | 1.18.42 | 样板代码精简 |
| 构建 | Maven | - | spring-boot-maven-plugin |
| 容器 | Docker Compose | 3 services | app + mysql + qdrant |

---

## 模块划分

```
com.mark.knowledge
├── rag/                          # RAG 核心模块
│   ├── app/                      # REST 控制器层
│   │   ├── RagController         # RAG 问答接口
│   │   ├── DocumentController    # 文档上传/管理
│   │   ├── AdminDocumentController # 管理员文档操作
│   │   ├── PromptController      # 系统 Prompt 管理
│   │   └── PublicDocumentImageController # 公开文档/图片
│   ├── service/                  # 业务逻辑层
│   │   ├── RagService            # RAG 管道编排（1300行）
│   │   ├── DocumentService       # 文档解析与分块（1189行）
│   │   ├── EmbeddingService      # 向量化与 Qdrant 存储
│   │   ├── Bm25Scorer            # BM25 文本评分
│   │   ├── ConversationMemoryService # 会话记忆管理
│   │   ├── PromptService         # 系统 Prompt CRUD
│   │   ├── DocumentAdminService  # 管理员文档操作
│   │   ├── SegmentAdminService   # 段落 CRUD
│   │   ├── FileStorageService    # 原始文件本地存储
│   │   ├── ImageStorageService   # 图片本地存储
│   │   ├── LlmImageSupport       # LLM 图片格式转换
│   │   └── QdrantStoreUtils      # Qdrant 资源管理
│   ├── service/parsers/          # 文档解析器
│   │   ├── DocxParser            # DOCX 解析 + 图片提取
│   │   └── DocParser             # DOC 解析 + 图片提取
│   ├── store/                    # 向量存储
│   │   └── QdrantEmbeddingStoreFactory # Qdrant 存储工厂
│   ├── dto/                      # 数据传输对象
│   ├── entity/                   # JPA 实体
│   └── repository/               # Spring Data JPA 仓库
├── auth/                         # 认证授权模块
│   ├── app/                      # 控制器
│   │   ├── AuthController        # 认证接口（登录/注册/刷新）
│   │   └── AdminController       # 管理接口（用户/角色管理）
│   ├── service/                  # 业务逻辑
│   │   ├── AuthService           # 认证流程
│   │   ├── UserAccountService    # 用户账号管理
│   │   ├── RbacService           # RBAC 权限管理
│   │   ├── JwtUtil               # JWT 工具
│   │   └── RegistrationCodeService # 邀请码管理
│   ├── config/                   # 安全配置
│   │   ├── SecurityConfig        # 过滤器链 + URL 权限
│   │   ├── JwtAuthenticationFilter # JWT 请求过滤器
│   │   ├── JwtProperties         # JWT 配置属性
│   │   ├── AuthBootstrapInitializer # 管理员引导
│   │   └── RbacBootstrapInitializer # 权限引导
│   ├── entity/                   # 认证实体
│   ├── repository/               # 数据仓库
│   └── dto/                      # 数据传输对象
├── config/                       # 全局配置
│   ├── QdrantInitializer         # Qdrant 集合自动创建
│   ├── RateLimitFilter           # 令牌桶限流
│   ├── LoggingFilter             # 请求日志
│   ├── EnvFileEnvironmentPostProcessor # .env 文件加载
│   └── structuredlogging/        # 结构化日志
│       ├── PipelineLogger        # 管道日志工具
│       ├── LogService            # 日志持久化
│       ├── LogController         # 日志查询 API
│       ├── RepositoryLoggingAspect # AOP 仓库日志
│       └── StructuredLog         # 日志注解
├── chat/                         # 聊天模型配置
│   └── config/
│       └── ChatConfig            # ChatModel / StreamingChatModel Bean
└── KnowledgeApplication          # Spring Boot 启动类
```

---

## 请求处理流程

### 通用请求流

```
HTTP 请求
  → Spring Security Filter Chain
    → CorsFilter（CORS 预检）
    → JwtAuthenticationFilter（Token 解析 → SecurityContext）
    → RateLimitFilter（限流检查）
  → LoggingFilter（请求日志）
  → DispatcherServlet → Controller
  → @PreAuthorize 检查（方法级权限）
  → Service 层业务逻辑
  → MySQL (JPA) / Qdrant (gRPC) / vLLM (HTTP)
  → 响应返回
```

### RAG 问答流

```
POST /rag/ask 或 /rag/ask/stream
  → RagController
  → RagService.ask / askStream
    → ConversationMemoryService.getMessages（对话历史）
    → PromptService + ChatModel（问题改写）
    → EmbeddingModel.embed（查询向量化）
    → QdrantEmbeddingStore.search（向量检索）
    → Bm25Scorer.score（BM25 评分）
    → rerankMatches（混合重排：向量 0.6 + BM25 0.4）
    → enrichWithCrossDocumentResults（跨文档二次检索）
    → buildNewContext（去重上下文构建）
    → buildMessagesToSend（消息组装，含图片注入）
    → ChatModel.chat / StreamingChatModel.chat（LLM 生成）
    → ConversationMemoryService.append*（记忆更新）
  → RagResponse / SSE 事件流
```

### 文档上传流

```
POST /documents/upload 或 /documents/upload/stream
  → DocumentController
  → DocumentService.processDocument
    → 解析：PDFBox / POI DocxParser / DocParser / 文本
    → 清洗：去噪、编码统一、空白归一化
    → 元数据：标题推断、分类、时间提取、关键词提取
    → 分块：段落切分 → 去重 → 合并短块 → 增强
  → EmbeddingService.storeSegments
    → EmbeddingModel.embedAll（批量向量化）
    → QdrantEmbeddingStore.addAll（分批写入，含重试）
  → FileStorageService（保存原始文件）
  → ImageStorageService（保存提取的图片）
```

### 认证流

```
POST /auth/login
  → AuthController
  → AuthService.login
    → AuthenticationManager.authenticate（凭证验证）
    → JwtUtil.generateAccessToken + generateRefreshToken
    → 存储 Refresh Token jti 到用户记录
  → TokenResponse { accessToken, refreshToken }

后续请求：
  Authorization: Bearer {accessToken}
  → JwtAuthenticationFilter 解析 → SecurityContext
  → @PreAuthorize 或 URL 规则检查权限
```

---

## 核心依赖关系

```
RagService ──依赖──→ EmbeddingModel（向量化）
         ├──依赖──→ QdrantEmbeddingStoreFactory（向量存储）
         ├──依赖──→ Bm25Scorer（文本评分）
         ├──依赖──→ ConversationMemoryService（会话记忆）
         ├──依赖──→ PromptService（Prompt 模板）
         ├──依赖──→ ChatModel / StreamingChatModel（LLM）
         └──依赖──→ ImageStorageService（图片读取）

DocumentService ──依赖──→ ImageStorageService（图片保存）
                └──使用──→ DocxParser / DocParser（文档解析）

EmbeddingService ──依赖──→ EmbeddingModel（向量化）
                └──依赖──→ QdrantEmbeddingStoreFactory（向量存储）

AuthService ──依赖──→ AuthenticationManager（凭证验证）
           ├──依赖──→ UserAccountService（用户管理）
           ├──依赖──→ RegistrationCodeService（邀请码）
           ├──依赖──→ JwtUtil（Token 生成）
           └──依赖──→ RoleRepository（角色查询）
```

---

## 数据存储

### MySQL（关系数据）

| 表 | 对应实体 | 说明 |
|-----|---------|------|
| `user_account` | UserAccount | 用户账号 |
| `role` | Role | 角色 |
| `permission` | Permission | 权限 |
| `user_role` | UserRole | 用户-角色关联 |
| `registration_code` | RegistrationCode | 注册邀请码 |
| `system_prompt` | SystemPrompt | 系统提示词 |

**DDL 策略：** `spring.jpa.hibernate.ddl-auto=update`（自动更新表结构）

### Qdrant（向量数据）

| 集合 | 维度 | 说明 |
|------|------|------|
| `knowledge_rag` | 768 | 文档片段嵌入向量 |

**每个向量点的元数据（Payload）：**
`filename`, `documentId`, `chunkIndex`, `chunkSize`, `rawChunkSize`, `chunkHash`, `title`, `category`, `documentTime`, `ingestedAt`, `keywords`, `documentKeywords`, `imageIds`

### 本地文件系统

| 路径模式 | 内容 |
|----------|------|
| `{file-storage-path}/{documentId}/{filename}` | 原始文档文件 |
| `{image-storage-path}/{documentId}/{imageId}.{ext}` | 提取的文档图片 |

---

## Docker 部署架构

```
docker-compose.yml
├── app          # Spring Boot 应用（多阶段 Docker 构建）
├── mysql        # MySQL 8.x（持久化卷）
└── qdrant       # Qdrant 向量数据库（持久化卷）
```

**网络：** 所有服务在同一 Docker 网络内通过服务名互访。

**端口映射：**
- app: 8080（外部访问）
- mysql: 3306
- qdrant: 6333 (HTTP) + 6334 (gRPC)
