# 当前存储结构说明

这个文件沿用旧文件名，但当前项目已经没有关系型数据库表结构。

当前实现不包含：

- SQLite
- JPA Entity
- Repository
- 用户表
- 聊天消息表
- 领域文档表

如果你是从旧版本文档进入这个仓库，应该把这里理解为“当前数据如何存放”，而不是“建表 SQL”。

## 存储总览

当前项目只有两类数据存储：

### 1. 持久化存储：Qdrant

用于保存：

- 文档分块后的文本片段
- 对应的 embedding 向量
- 文档 metadata

相关代码：

- [src/main/java/com/mark/knowledge/config/QdrantInitializer.java](../src/main/java/com/mark/knowledge/config/QdrantInitializer.java)
- [src/main/java/com/mark/knowledge/rag/store/QdrantEmbeddingStoreFactory.java](../src/main/java/com/mark/knowledge/rag/store/QdrantEmbeddingStoreFactory.java)
- [src/main/java/com/mark/knowledge/rag/service/EmbeddingService.java](../src/main/java/com/mark/knowledge/rag/service/EmbeddingService.java)
- [src/main/java/com/mark/knowledge/rag/service/DocumentAdminService.java](../src/main/java/com/mark/knowledge/rag/service/DocumentAdminService.java)

### 2. 非持久化存储：内存会话

用于保存：

- 最近若干轮用户消息
- 最近若干轮助手消息
- 会话最近访问时间

相关代码：

- [src/main/java/com/mark/knowledge/rag/service/ConversationMemoryService.java](../src/main/java/com/mark/knowledge/rag/service/ConversationMemoryService.java)

应用重启后，这部分数据会丢失。

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

当前并没有单独的“文档表”。

后端通过 `DocumentAdminService`：

1. 调用 Qdrant HTTP `scroll` 接口遍历当前 collection
2. 从 payload 中读取 `documentId` 和 `filename`
3. 按 `documentId` 聚合，得到文档列表和分段数
4. 删除文档时，先找出同一 `documentId` 的全部 point id，再批量删除

因此：

- “文档列表”是从 Qdrant 现算出来的
- “删除文档”会删除对应向量片段
- 不存在独立的文档主表

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

- Qdrant 中的数据保留
- 内存会话全部丢失

## 与旧版本的差异

当前项目已经没有以下概念：

- `users`
- `chat_messages`
- `domain_documents`
- `spring.jpa.hibernate.ddl-auto`
- 默认登录账号
- 手动建表 SQL

如果你需要长期保存聊天历史，当前代码需要新增真正的持久化层；仓库里现在还没有这部分实现。
