# RAG 管道深度解析

## 模块总览

RAG（检索增强生成）管道是本系统的核心功能，负责接收用户问题、从知识库中检索相关文档片段、构建上下文、调用大语言模型生成答案。

**核心类：**
- `com.mark.knowledge.rag.service.RagService` — 管道编排主服务（约1300行）
- `com.mark.knowledge.rag.app.RagController` — REST 控制器
- `com.mark.knowledge.rag.service.EmbeddingService` — 文本向量化
- `com.mark.knowledge.rag.service.Bm25Scorer` — BM25 文本评分
- `com.mark.knowledge.rag.service.ConversationMemoryService` — 会话记忆管理
- `com.mark.knowledge.rag.service.PromptService` — 系统 Prompt 管理
- `com.mark.knowledge.rag.store.QdrantEmbeddingStoreFactory` — 向量存储工厂

---

## 完整请求流程

### 同步问答流程 (`POST /rag/ask`)

```
用户问题 → RagController.ask()
  → RagService.ask()
    → 1. 会话ID规范化 + 取消已有流式生成
    → 2. 获取对话历史 (ConversationMemoryService)
    → 3. 问题改写 (rewriteQuestion)
    → 4. 查询向量化 (EmbeddingModel.embed)
    → 5. 向量检索 (QdrantEmbeddingStore.search)
    → 6. BM25 混合重排 (Bm25Scorer + rerankMatches)
    → 7. 跨文档关联检索 (enrichWithCrossDocumentResults)
    → 8. 最低分数过滤 (filterMatchesByMinScore)
    → 9. 去重上下文构建 (buildNewContext)
    → 10. 消息列表组装 (buildMessagesToSend)
    → 11. LLM 生成答案 (ChatModel.chat)
    → 12. 会话记忆更新
  → RagResponse (答案 + 思考过程 + 来源引用)
```

### 流式问答流程 (`POST /rag/ask/stream`)

```
用户问题 → RagController.askStream()
  → RagService.askStream()
    → 创建 SseEmitter (超时: streamTimeoutMs)
    → 创建 InFlightGeneration 跟踪对象
    → 异步提交 processStreamTask
      → 流程与同步相同 (步骤2-8)
      → SSE 事件发送: start → sources → thinking_delta* → delta* → thinking_end → complete
    → 返回 SseEmitter
```

---

## RagController

**包路径：** `com.mark.knowledge.rag.app`

### `POST /rag/ask`

同步 RAG 问答。

```java
public ResponseEntity<?> ask(@RequestBody RagRequest request)
```

**请求体 `RagRequest`：**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `question` | String | 是 | 用户问题 |
| `conversationId` | String | 否 | 会话ID，为空则不使用对话记忆 |
| `maxResults` | Integer | 否 | 最大检索结果数，默认5 |
| `minScore` | Double | 否 | 最低语义相似度阈值，默认0.5 |

**响应体 `RagResponse`：**
| 字段 | 类型 | 说明 |
|------|------|------|
| `answer` | String | LLM 生成的答案 |
| `thinking` | String | 模型思考过程（如有） |
| `conversationId` | String | 会话ID |
| `sources` | List\<SourceReference\> | 来源引用列表 |

**行为：**
1. 校验 `question` 非空
2. 调用 `ragService.ask(request)`
3. 成功返回 200 + `RagResponse`；异常返回 500 + `ErrorResponse`

### `POST /rag/ask/stream`

流式 RAG 问答（SSE）。

```java
public ResponseEntity<?> askStream(@RequestBody RagRequest request)
```

**SSE 事件类型：**
| 事件名 | 数据 | 说明 |
|--------|------|------|
| `start` | `{conversationId}` | 管道启动 |
| `sources` | `List<SourceReference>` | 检索到的文档来源 |
| `thinking_delta` | String | 模型思考过程增量 |
| `thinking_end` | `{conversationId, thinkingEnded, reason}` | 思考结束 |
| `delta` | String | 答案文本增量 |
| `complete` | `{conversationId, cancelled, content, thinking}` | 生成完成 |
| `error` | `{message}` | 错误信息 |
| `cancelled` | `{conversationId, reason}` | 已取消 |

### `POST /rag/conversations/{conversationId}/cancel`

取消指定会话的进行中生成任务。

```java
public ResponseEntity<?> cancelConversationGeneration(@PathVariable String conversationId)
```

成功返回 200 + 文本消息；无进行中任务返回 404。

### `DELETE /rag/conversations/{conversationId}`

清空指定会话上下文。先取消进行中任务，再清除会话记忆。

```java
public ResponseEntity<String> clearConversation(@PathVariable String conversationId)
```

### `POST /rag/ask/with-image`

多模态图片问答。将图片 + 问题直接发送给 LLM（不经过 RAG 检索）。

```java
public ResponseEntity<?> askWithImage(
    @RequestParam("image") MultipartFile image,
    @RequestParam("question") String question,
    @RequestParam(value = "conversationId", required = false) String conversationId,
    @RequestParam(value = "maxResults", required = false) Integer maxResults,
    @RequestParam(value = "minScore", required = false) Double minScore)
```

**流程：**
1. 校验图片非空、问题非空
2. 将图片转为 PNG data URI（`LlmImageSupport.toPngDataUri`）
3. 构建 `UserMessage`（文本 + 图片）
4. 直接调用 `ChatModel.chat()`，不经过向量检索
5. 返回 `RagResponse`（sources 为空列表）

### `GET/POST /rag/health`

健康检查接口。

---

## RagService 核心方法

### `ask(RagRequest)`

```java
public RagResponse ask(RagRequest request)
```

同步 RAG 问答主入口。

**详细流程：**

1. **会话ID规范化** — `normalizeConversationId` 去除空白
2. **取消已有流式生成** — 同一会话的同步请求会取消正在进行的流式生成
3. **获取对话历史** — `conversationMemoryService.getMessages(conversationId)`
4. **问题改写** — `rewriteQuestion(question, history)`
   - 有历史时，使用 `rag_rewrite` Prompt 模板让 LLM 改写问题
   - 无历史时直接使用原问题
5. **查询向量化** — `embeddingModel.embed(rewrittenQuestion).content()`
6. **向量检索** — 构建 `EmbeddingSearchRequest`，调用 `searchEmbeddingStore`
   - 候选结果数 = `requestedMaxResults × rerankCandidateMultiplier`（默认4倍）
   - 最低分数阈值 = `minScore`（默认0.5）
7. **BM25 混合重排** — `rerankMatches(query, vectorMatches, requestedMaxResults)`
8. **跨文档关联检索** — `enrichWithCrossDocumentResults`
9. **最低分数过滤** — `filterMatchesByMinScore`
10. **去重上下文构建** — `buildNewContext`（基于 chunkHash 去重）
11. **消息组装** — `buildMessagesToSend(history, newContext, question)`
12. **LLM 生成** — `generateAnswer(messages)`
13. **记忆更新** — 追加用户消息和 AI 回复

**配置参数：**
| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `rag.max-results` | 5 | 默认最大检索结果数 |
| `rag.stream-timeout-ms` | 300000 | 流式超时（毫秒） |
| `rag.rerank.candidate-multiplier` | 4 | 重排候选倍数 |
| `rag.rerank.vector-weight` | 0.6 | 向量分数权重 |
| `rag.rerank.bm25-weight` | 0.4 | BM25 分数权重 |
| `rag.chunk-dedup-enabled` | true | 启用分块去重 |
| `rag.image-to-llm-enabled` | true | 启用图片注入 LLM |
| `rag.image-max-per-request` | 5 | 单次请求最大图片数 |

### `askStream(RagRequest)`

```java
public SseEmitter askStream(RagRequest request)
```

流式 RAG 问答。创建 `SseEmitter` 和 `InFlightGeneration`，异步执行 `processStreamRequest`。

**关键行为：**
- 同会话新请求自动取消旧请求
- SSE 连接超时/错误/完成时自动清理
- 通过 `InFlightGeneration` 跟踪生成状态

### `rerankMatches(String query, List<EmbeddingMatch<TextSegment>> candidates, int limit)`

混合重排核心算法。

**算法：**
1. 对候选文本计算 BM25 分数（`bm25Scorer.score`）
2. 归一化向量分数和 BM25 分数到 [0, 1]（min-max 归一化）
3. 加权融合：`finalScore = normalizedVector × vectorWeight + normalizedBm25 × bm25Weight`
4. 按 finalScore 降序排序，取 top `limit`

**归一化公式：** `normalizedScore = (score - min) / (max - min)`

**排序优先级：** finalScore 降序 → semanticScore 降序 → bm25Score 降序

### `enrichWithCrossDocumentResults(RagRequest, List<HybridMatch>, int, double)`

跨文档关联检索。检测检索结果中的文档引用（如"见《XX管理办法》"），对引用的文档名进行二次检索，合并去重。

**引用检测模式：**
- `见《...》` / `见〈...〉`
- `参见...办法/规定/制度/细则`
- `详见...办法/规定/制度/细则`
- `按照《...》`

**二次检索：**
- 增强查询 = 原问题 + 引用文档名
- 最低分数放宽为原阈值的 80%
- 合并时基于 chunkHash 去重

### `buildNewContext(String conversationId, List<HybridMatch>)`

构建去重后的新增上下文。基于会话中已使用的 chunkHash 集合，过滤已发送过的文档片段，仅保留新内容。

### `rewriteQuestion(String question, List<ChatMessage> history)`

问题改写。有历史时使用 LLM 将当前问题结合上下文改写为独立问题，无历史时直接返回原问题。

### `buildMessagesToSend(List<ChatMessage> history, String newContext, String question)`

组装发送给 LLM 的消息列表：
1. SystemMessage（`rag_system` Prompt）
2. 历史消息（去除 thinking 内容）
3. 新增文档上下文（如启用图片注入，附加图片 data URI）
4. 用户当前问题

### `cancelGeneration(String conversationId)`

取消指定会话的进行中流式生成。设置取消标志、取消 StreamingHandle、发送 cancelled 事件。

---

## InFlightGeneration 内部类

流式生成任务的状态跟踪对象。

**字段：**
| 字段 | 类型 | 说明 |
|------|------|------|
| `requestId` | String | 唯一请求ID |
| `conversationId` | String | 会话ID |
| `question` | String | 原始问题 |
| `emitter` | SseEmitter | SSE 连接 |
| `handleRef` | AtomicReference\<StreamingHandle\> | 流式句柄引用 |
| `cancelled` | AtomicBoolean | 是否已取消 |
| `completed` | AtomicBoolean | 是否已完成 |
| `thinkingEnded` | AtomicBoolean | 思考过程是否结束 |
| `answerBuilder` | StringBuilder | 答案文本累积器 |
| `thinkingBuilder` | StringBuilder | 思考过程累积器 |
| `insideThinkTag` | boolean | 是否在 `<think...>` 标签内 |
| `tagBuffer` | StringBuilder | 跨 chunk 的标签缓冲 |

**关键方法：**
- `markCancelled()` / `markCompleted()` — CAS 原子状态转换
- `captureHandle(StreamingHandle)` — 捕获流式句柄，自动取消旧句柄
- `appendAnswer(String)` / `appendThinking(String)` — 线程安全追加内容

---

## RagStreamingResponseHandler 内部类

处理 LLM 流式响应的回调处理器。

**关键行为：**
- `onPartialResponse(String)` — 处理文本 token，解析 `<think...>...</think...>` 标签
- `onPartialResponse(PartialResponse, PartialResponseContext)` — 捕获 StreamingHandle
- `onPartialThinking(PartialThinking, PartialThinkingContext)` — 处理思考过程 token
- `onCompleteResponse(ChatResponse)` — 完成时同步最终答案、更新记忆
- `onError(Throwable)` — 错误处理，区分取消和真实错误

**`<think...>` 标签解析：**
某些模型（如 glm-4.6v-flash）将思考内容放在 `<think...>...</think...>` 标签中混在 content 里。处理器维护 `insideThinkTag` 状态和 `tagBuffer` 缓冲来正确路由内容：
- 在标签内 → 路由到 `thinking_delta` 事件
- 在标签外 → 路由到 `delta` 事件
- 跨 chunk 边界时使用 `tagBuffer` 保留最多 7-8 个字符防止标签被截断

---

## Bm25Scorer

**包路径：** `com.mark.knowledge.rag.service.Bm25Scorer`

### `score(String query, List<String> documents) → List<Double>`

计算查询与每个文档的 BM25 相关性分数。

**BM25 参数：** k1=1.5, b=0.75

**BM25 公式：**

```
score(D, Q) = Σ IDF(qi) × (tf(qi, D) × (k1 + 1)) / (tf(qi, D) + k1 × (1 - b + b × |D| / avgdl))

IDF(qi) = ln((N - df(qi) + 0.5) / (df(qi) + 0.5) + 1)
```

其中：
- `tf(qi, D)` — 词 qi 在文档 D 中的频率
- `df(qi)` — 包含词 qi 的文档数
- `N` — 文档总数
- `|D|` — 文档 D 的长度（token数）
- `avgdl` — 平均文档长度

### `tokenize(String text) → List<String>`

分词器，同时处理拉丁文本和 CJK 文本：

- **拉丁文本**：按连续字母数字提取 token
- **CJK 文本**：bigram 分词（每两个相邻字符组成一个 token）
- **单字符 CJK**：保留为独立 token
- 所有 token 转小写

**支持的 CJK 文字：** 中文（HAN）、平假名（HIRAGANA）、片假名（KATAKANA）、韩文（HANGUL）

---

## ConversationMemoryService

**包路径：** `com.mark.knowledge.rag.service.ConversationMemoryService`

基于内存的会话上下文管理。

### 核心方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `getMessages` | `getMessages(String conversationId) → List<ChatMessage>` | 获取会话消息快照 |
| `appendUserMessage` | `appendUserMessage(String conversationId, String content)` | 追加用户消息 |
| `appendAiMessage` | `appendAiMessage(String conversationId, String content)` | 追加 AI 消息（无思考） |
| `appendAiMessage` | `appendAiMessage(String conversationId, String content, String thinking)` | 追加 AI 消息（含思考） |
| `clear` | `clear(String conversationId)` | 清空会话 |
| `getUsedChunkHashes` | `getUsedChunkHashes(String conversationId) → Set<String>` | 获取已使用的分块哈希 |
| `recordUsedChunkHashes` | `recordUsedChunkHashes(String conversationId, Set<String>)` | 记录已使用的分块哈希 |
| `cleanupExpiredSessions` | `cleanupExpiredSessions()` | 定时清理过期会话 |

### 配置参数

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `rag.memory-window` | 6 | 对话记忆窗口大小（消息对数） |
| `rag.session-ttl-seconds` | 1800 | 会话超时时间（秒） |
| `rag.memory-cleanup-interval-ms` | 300000 | 清理间隔（毫秒） |

### 内部实现

- **存储：** `ConcurrentHashMap<String, ConversationSession>`
- **滑动窗口：** 每个会话最多保留 `memoryWindow × 2` 条消息
- **TTL 清理：** 每 5 分钟执行一次，移除超过 `sessionTtlSeconds` 未访问的会话
- **分块去重：** 每个会话维护 `usedChunkHashes` 集合，避免重复发送相同文档片段
- **线程安全：** `ConversationSession` 内部方法均 `synchronized`

---

## EmbeddingService

**包路径：** `com.mark.knowledge.rag.service.EmbeddingService`

### `storeSegments(List<TextSegment> segments, DocumentProgressCallback callback) → int`

为文本块生成嵌入向量并存储到 Qdrant。

**流程：**
1. **生成嵌入向量** — 按 `embeddingRequestBatchSize`（默认10）分批调用 `embeddingModel.embedAll()`
2. **存储到 Qdrant** — 按 `embeddingStoreBatchSize`（默认32）分批写入
3. **重试机制** — 可重试的异常（UNAVAILABLE, DEADLINE_EXCEEDED, RESOURCE_EXHAUSTED, INTERNAL, 连接重置等）最多重试 `embeddingStoreMaxRetries`（默认3）次，指数退避

**配置参数：**
| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `rag.embedding-request.batch-size` | 10 | 嵌入请求批次大小 |
| `rag.embedding-store.batch-size` | 32 | Qdrant 写入批次大小 |
| `rag.embedding-store.max-retries` | 3 | 最大重试次数 |
| `rag.embedding-store.retry-backoff-ms` | 1000 | 重试退避基数（毫秒） |

### `updateSegment(String pointId, String newText)`

更新单个片段的文本和嵌入向量。重新嵌入新文本，通过 gRPC upsert 更新 Qdrant。

---

## HybridMatch 内部记录

```java
private record HybridMatch(
    TextSegment segment,    // 文档片段
    double semanticScore,   // 语义相似度分数（原始向量分数）
    double bm25Score,       // BM25 文本匹配分数
    double finalScore       // 加权融合后的最终分数
)
```

---

## SSE 事件流示例

```
event: start
data: {"conversationId":"rag-abc123"}

event: sources
data: [{"filename":"管理办法.pdf","text":"...","score":0.87,"images":[]}]

event: thinking_delta
data: 让我分析一下这个问题...

event: thinking_delta
data: 需要参考管理办法的相关条款。

event: thinking_end
data: {"conversationId":"rag-abc123","thinkingEnded":true,"reason":"answer_started"}

event: delta
data: 根据《管理办法》

event: delta
data: 第三条的规定，

event: complete
data: {"conversationId":"rag-abc123","cancelled":false,"content":"根据《管理办法》第三条的规定，...","thinking":"让我分析一下..."}
```
