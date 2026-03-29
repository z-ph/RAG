# 当前存储结构说明

当前项目同时使用 MySQL、Qdrant 和内存会话三种存储。

- MySQL：登录账号、管理员生成的一次性注册码
- Qdrant：文档向量和文档 metadata
- 内存：RAG 会话上下文

## 存储总览

### 1. MySQL（关系型持久化）

用于保存：

- 用户账号
- 注册码

相关代码：

- [src/main/java/com/mark/knowledge/auth/entity/UserAccount.java](../src/main/java/com/mark/knowledge/auth/entity/UserAccount.java)
- [src/main/java/com/mark/knowledge/auth/entity/RegistrationCode.java](../src/main/java/com/mark/knowledge/auth/entity/RegistrationCode.java)
- [src/main/java/com/mark/knowledge/auth/repository/UserAccountRepository.java](../src/main/java/com/mark/knowledge/auth/repository/UserAccountRepository.java)
- [src/main/java/com/mark/knowledge/auth/repository/RegistrationCodeRepository.java](../src/main/java/com/mark/knowledge/auth/repository/RegistrationCodeRepository.java)
- [src/main/java/com/mark/knowledge/auth/service/UserAccountService.java](../src/main/java/com/mark/knowledge/auth/service/UserAccountService.java)
- [src/main/java/com/mark/knowledge/auth/service/RegistrationCodeService.java](../src/main/java/com/mark/knowledge/auth/service/RegistrationCodeService.java)

### 2. Qdrant（向量持久化）

用于保存：

- 文档分块后的文本片段
- 对应的 embedding 向量
- 文档 metadata

相关代码：

- [src/main/java/com/mark/knowledge/config/QdrantInitializer.java](../src/main/java/com/mark/knowledge/config/QdrantInitializer.java)
- [src/main/java/com/mark/knowledge/rag/store/QdrantEmbeddingStoreFactory.java](../src/main/java/com/mark/knowledge/rag/store/QdrantEmbeddingStoreFactory.java)
- [src/main/java/com/mark/knowledge/rag/service/EmbeddingService.java](../src/main/java/com/mark/knowledge/rag/service/EmbeddingService.java)
- [src/main/java/com/mark/knowledge/rag/service/DocumentAdminService.java](../src/main/java/com/mark/knowledge/rag/service/DocumentAdminService.java)

### 3. 内存会话（非持久化）

用于保存：

- 最近若干轮用户消息
- 最近若干轮助手消息
- 会话最近访问时间

相关代码：

- [src/main/java/com/mark/knowledge/rag/service/ConversationMemoryService.java](../src/main/java/com/mark/knowledge/rag/service/ConversationMemoryService.java)

应用重启后，这部分数据会丢失。

## MySQL 配置与自动建表

当前有效配置：

```yaml
spring:
  datasource:
    url: ${MYSQL_URL:jdbc:mysql://localhost:3306/knowledge_rag?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Shanghai&characterEncoding=utf8}
    username: ${MYSQL_USERNAME:root}
    password: ${MYSQL_PASSWORD:}
  jpa:
    hibernate:
      ddl-auto: ${SPRING_JPA_HIBERNATE_DDL_AUTO:update}
```

说明：

- `ddl-auto=update` 会在启动时自动创建或更新关系表
- 不需要手动执行建表 SQL
- 测试环境通过 `src/test/resources/application.yaml` 使用 H2 内存数据库

## MySQL 表结构概览

### `user_accounts`

用于保存系统登录账号。

核心字段：

- `id`
- `username`
- `password_hash`
- `role`
- `enabled`
- `created_at`
- `updated_at`

角色说明：

- `ADMIN`：可以登录文档模块，并管理注册码
- `USER`：可以登录文档模块，但不能管理注册码

启动逻辑：

- `AuthBootstrapInitializer` 会在系统中还没有管理员账号时，自动创建一个初始管理员

### `registration_codes`

用于保存管理员创建的一次性注册码。

核心字段：

- `id`
- `code`
- `note`
- `created_by`
- `created_at`
- `expires_at`
- `used_by`
- `used_at`
- `disabled_at`
- `updated_at`

状态规则：

- `AVAILABLE`：未使用、未禁用、未过期
- `USED`：已被注册使用，一次性失效
- `DISABLED`：管理员手动禁用
- `EXPIRED`：超过 `expires_at`

并发控制：

- `RegistrationCodeRepository.findByCodeForUpdate(...)` 使用悲观锁，避免同一注册码被并发重复消费

## Qdrant 配置

当前有效配置：

```yaml
qdrant:
  host: ${QDRANT_HOST:localhost}
  port: ${QDRANT_PORT:6334}
  http-port: ${QDRANT_HTTP_PORT:6333}
  collection-name: ${QDRANT_COLLECTION_NAME:knowledge-base}
  vector-size: ${QDRANT_VECTOR_SIZE:768}
  create-collection-if-not-exists: ${QDRANT_CREATE_COLLECTION_IF_NOT_EXISTS:true}
```

端口职责：

- `qdrant.port`：gRPC，LangChain4j store 读写向量时使用
- `qdrant.http-port`：HTTP，collection 初始化、文档列表、文档删除时使用

## 启动时的 collection 行为

应用启动后，`QdrantInitializer` 会：

1. 检查 `collection-name` 是否存在
2. 如果不存在且 `create-collection-if-not-exists=true`，则自动创建
3. 如果已存在但 `vector-size` 不匹配，则删除并重建
4. 如果已存在且维度一致，则直接复用

这意味着切换 embedding 模型时，必须同步检查 `QDRANT_VECTOR_SIZE`。

## 文档片段在 Qdrant 中的 metadata

每个文本片段在构造 `TextSegment` 时会写入以下 metadata：

- `filename`
- `documentId`
- `chunkIndex`
- `chunkSize`
- `rawChunkSize`
- `chunkHash`
- `title`
- `category`
- `documentTime`
- `ingestedAt`
- `keywords`
- `documentKeywords`

这些字段来自 [src/main/java/com/mark/knowledge/rag/service/DocumentService.java](../src/main/java/com/mark/knowledge/rag/service/DocumentService.java) 中的 `createSegment(...)`。

## 文档列表和删除是怎么实现的

当前并没有单独的“文档主表”。

后端通过 `DocumentAdminService`：

1. 调用 Qdrant HTTP `scroll` 接口遍历当前 collection
2. 从 payload 中读取 `documentId` 和 `filename`
3. 按 `documentId` 聚合，得到文档列表和分段数
4. 删除文档时，先找出同一 `documentId` 的全部 point id，再批量删除

因此：

- “文档列表”是从 Qdrant 现算出来的
- “删除文档”会删除对应向量片段
- 不存在独立的文档业务表

## 会话上下文的实际结构

`ConversationMemoryService` 使用 `ConcurrentHashMap<String, ConversationSession>` 保存会话。

每个会话包含：

- `messages`
- `lastAccessTime`

每条消息包含：

- `role`
- `content`
- `timestamp`

相关行为：

- 按 `rag.memory-window` 保留最近若干轮 user/assistant 消息
- 按 `rag.session-ttl-seconds` 过期
- 按 `rag.memory-cleanup-interval-ms` 定时清理

## 哪些操作会影响存储

### 登录 / 注册

- 登录成功后建立 Session Cookie
- 注册时消费一次性注册码并创建 `user_accounts` 记录

### 创建 / 禁用 / 删除注册码

- 在 `registration_codes` 中新增、更新或删除记录

### 上传文档

- 解析文件
- 分块
- 生成 embedding
- 写入 Qdrant

### 删除文档

- 删除 Qdrant 中该 `documentId` 对应的所有 point

### 清空会话

- 只清空内存中的会话上下文
- 不删除任何文档向量

### 重启应用

- MySQL 中的用户和注册码保留
- Qdrant 中的数据保留
- 内存会话全部丢失
