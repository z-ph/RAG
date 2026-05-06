# 文档管理模块详解

## 模块总览

文档管理模块负责文档的上传、解析、分块、向量化、存储、删除和公开浏览的全生命周期管理。

**核心类：**
- `com.mark.knowledge.rag.service.DocumentService` — 文档解析与分块（约1189行）
- `com.mark.knowledge.rag.service.EmbeddingService` — 向量化与存储（约380行）
- `com.mark.knowledge.rag.service.FileStorageService` — 原始文件本地存储
- `com.mark.knowledge.rag.service.ImageStorageService` — 图片本地存储
- `com.mark.knowledge.rag.service.DocumentAdminService` — 管理员文档操作
- `com.mark.knowledge.rag.service.SegmentAdminService` — 段落CRUD操作
- `com.mark.knowledge.rag.service.parsers.DocxParser` — DOCX 解析器
- `com.mark.knowledge.rag.service.parsers.DocParser` — DOC 解析器
- `com.mark.knowledge.rag.app.DocumentController` — 用户端控制器
- `com.mark.knowledge.rag.app.AdminDocumentController` — 管理端控制器
- `com.mark.knowledge.rag.app.PublicDocumentImageController` — 公开图片访问

---

## 完整上传流程

### 同步上传 (`POST /documents/upload`)

```
文件上传 → DocumentController.upload()
  → 1. 文件校验（格式、大小）
  → 2. DocumentService.processDocument(inputStream, filename)
       → 解析文档（PDF/DOCX/DOC/TXT/MD）
       → 清洗文本
       → 提取元数据（标题、分类、时间、关键词）
       → 分块（切分 + 去重 + 合并短块）
       → 增强（添加标题、关键词前缀）
  → 3. EmbeddingService.storeSegments(segments)
       → 批量生成嵌入向量
       → 分批写入 Qdrant（含重试）
  → 4. FileStorageService 保存原始文件
  → 返回 DocumentResponse
```

### 流式上传 (`POST /documents/upload/stream`)

流程与同步上传相同，但通过 SSE 实时推送进度事件：

| 事件 | 说明 |
|------|------|
| `start` | 上传开始（文件名） |
| `parse_complete` | 解析完成（字符数） |
| `segment_complete` | 分块完成（块数） |
| `embedding_generate_start` | 向量生成开始 |
| `embedding_generate_progress` | 向量生成进度 |
| `embedding_generate_complete` | 向量生成完成 |
| `embedding_store_start` | 向量存储开始 |
| `embedding_store_progress` | 向量存储进度 |
| `embedding_store_complete` | 向量存储完成 |
| `file_saved` | 原始文件保存完成 |
| `complete` | 全部完成 |

---

## DocumentService 核心方法

### `processDocument(InputStream, String filename, String fixedDocumentId, DocumentProgressCallback)`

```java
public ProcessedDocument processDocument(
    InputStream inputStream, String filename,
    String fixedDocumentId, DocumentProgressCallback callback)
```

文档处理主入口，返回 `ProcessedDocument(documentId, filename, segments)`。

**处理步骤：**

#### 步骤1：文档解析

根据文件扩展名选择解析器：

| 格式 | 解析器 | 说明 |
|------|--------|------|
| `.pdf` | PDFBox 3.x (`Loader.loadPDF`) | 逐页提取文本，`setSortByPosition(true)` |
| `.docx` | `DocxParser.parseWithImages` | 提取文本 + 图片引用 |
| `.doc` | `DocParser.parseWithImages` | 提取文本 + 图片引用 |
| `.txt` / `.md` 等 | `parseText` | 自动检测编码（UTF-8/UTF-16/GB18030） |

**编码检测策略（文本文档）：**
1. 检测 BOM：UTF-8 (EF BB BF)、UTF-16LE (FF FE)、UTF-16BE (FE FF)
2. UTF-16 特征检测：统计奇偶位置零字节比例
3. 尝试 UTF-8 严格解码
4. 回退 GB18030

#### 步骤2：文本清洗 (`cleanText`)

- 移除 BOM、零宽字符、不可见字符
- 统一换行符为 `\n`
- 移除控制字符（保留 `\n` 和 `\t`）
- 过滤噪声行（页码、纯标点行）
- 合并连续空行为单空行
- 单换行转空格（段落内合并）

#### 步骤3：元数据提取 (`buildDocumentProfile`)

从清洗后的文本中提取：

**标题推断：**
1. 取第一段文本
2. 判断是否为标题：长度 4-40 字符、无句号等标点、无日期
3. 是标题则使用，否则从文件名推导

**时间提取 (`extractDocumentTime`)：**
- 正则匹配：`YYYY年MM月DD日`、`YYYY/MM/DD`、`YYYY-MM-DD`、`YYYY.MM.DD`
- 优先从文本提取，回退到文件名，最终使用当前日期

**分类推断 (`inferCategory`)：**
基于关键词匹配的简单分类器，支持：技术、产品、财经、教育、医疗、法律、生活

**关键词提取 (`extractKeywords`)：**
- 拉丁词：正则 `[A-Za-z][A-Za-z0-9_-]{2,30}` 匹配，标题加权 ×5
- 中文词：2-4 字 bigram，标题加权 +3，停用词过滤
- 按 score 降序取 top N（默认6个）

#### 步骤4：文本分块 (`splitText`)

**分块策略：**

1. **保护图片 Markdown** — `protectImageMarkdown`：将 `![...](...)` 替换为占位符，防止图片链接被分块切断
2. **段落切分** — 按双换行 `\n\n+` 分段
3. **长段落拆分** — 超过 `chunkMaxSize` 的段落按句号等标点拆分
4. **超长文本切片** — 单句超过 `chunkMaxSize` 时按固定大小切片（含重叠）
5. **单元去重** — `deduplicateUnits`：归一化后去除重复单元
6. **组装分块** — `assembleChunks`：将短单元合并到 `chunkMaxSize` 以内
7. **合并短块** — `mergeShortChunks`：将小于 `chunkMinSize` 的块与相邻块合并

**分块配置：**
| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `rag.chunk-size` | 320 | 目标分块大小（字符） |
| `rag.chunk-min-size` | 250 | 最小分块大小 |
| `rag.chunk-max-size` | 350 | 最大分块大小 |
| `rag.chunk-overlap` | 40 | 重叠字符数 |
| `rag.min-text-length` | 80 | 最短有效文本长度 |
| `rag.keyword-count` | 6 | 每块关键词数 |

**分块增强 (`buildEnhancedText`)：**
```
【标题：{title}】
{原始文本}
关键词：{keyword1}, {keyword2}, ...
```

**TextSegment 元数据字段：**
| 字段 | 说明 |
|------|------|
| `filename` | 原始文件名 |
| `documentId` | 文档唯一ID |
| `chunkIndex` | 块序号 |
| `chunkSize` | 增强后文本长度 |
| `rawChunkSize` | 原始文本长度 |
| `chunkHash` | 归一化文本哈希（用于去重） |
| `title` | 文档标题 |
| `category` | 文档分类 |
| `documentTime` | 文档时间 |
| `ingestedAt` | 入库时间 |
| `keywords` | 块级关键词 |
| `documentKeywords` | 文档级关键词 |
| `imageIds` | 关联的图片ID列表 |

### `processDocument(InputStream, String filename)`

无回调的兼容方法，委托给四参数版本。

### 内部记录类型

```java
public record ProcessedDocument(String documentId, String filename, List<TextSegment> segments)
private record ChunkSettings(int minSize, int targetSize, int maxSize)
private record ChunkBuildResult(List<TextSegment> segments, int filteredShortCount, int filteredDuplicateCount)
private record ProtectedImageMarkdown(String protectedText, List<String> placeholders)
private record DeduplicationResult(List<String> units, int filteredDuplicateCount)
private record DocumentProfile(String bodyText, String title, String category, String documentTime, String ingestedAt, List<String> keywords)
```

---

## EmbeddingService 核心方法

详见 [RAG 管道文档](rag-pipeline.md#embeddingservice)。

关键流程：
1. 按 `embeddingRequestBatchSize`（默认10）分批生成嵌入向量
2. 按 `embeddingStoreBatchSize`（默认32）分批写入 Qdrant
3. 可重试异常自动重试，指数退避

---

## 文件存储

### FileStorageService

本地文件系统存储原始文档文件。存储路径基于配置的 `rag.file-storage-path`。

### ImageStorageService

本地文件系统存储从 DOCX/DOC 中提取的图片。按 `documentId/imageId.ext` 组织目录结构。

**关键方法：**
- `saveImage(documentId, imageId, extension, data)` — 保存图片
- `readImage(documentId, imageName)` — 读取图片字节
- `deleteImages(documentId)` — 删除文档关联的所有图片

---

## 文档删除流程

```
DELETE /admin/documents/{id}
  → DocumentAdminService.deleteDocument(documentId)
    → 1. 从 Qdrant 删除所有关联向量点
    → 2. 删除数据库中的段落记录
    → 3. 删除 FileStorageService 中的原始文件
    → 4. 删除 ImageStorageService 中的图片
    → 5. 删除数据库中的文档记录
```

级联删除确保向量、段落、文件、图片全部清理。

---

## 文档重新索引 (`POST /admin/documents/{id}/reindex`)

重新解析并嵌入已有文档：
1. 读取原始文件
2. 使用固定的 `documentId` 重新走 `processDocument` 流程
3. 删除旧的向量点
4. 写入新的向量点

---

## 段落管理

通过 `SegmentAdminService` 和 `AdminDocumentController` 提供段落级 CRUD：

| 操作 | 端点 | 说明 |
|------|------|------|
| 列出段落 | `GET /admin/documents/{id}/segments` | 获取文档所有段落 |
| 更新段落 | `PUT /admin/documents/{id}/segments/{segmentId}` | 更新段落文本并重新嵌入 |
| 删除段落 | `DELETE /admin/documents/{id}/segments/{segmentId}` | 删除段落及其向量 |

---

## 公开文档浏览

无需认证即可访问的文档浏览接口：

| 端点 | 说明 |
|------|------|
| `GET /documents/public` | 公开文档列表 |
| `GET /documents/public/{id}` | 文档详情 |
| `GET /documents/public/{id}/download` | 文件下载 |
| `GET /documents/images/{documentId}/{imageName}` | 图片访问 |

**限流：** `/documents/public` 端点受 `RateLimitFilter` 令牌桶限流保护。
