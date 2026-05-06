# REST API 参考

本文档列出所有 REST API 端点，按模块分组。

## 认证要求标记

- **公开** — 无需认证
- **需登录** — 需在 `Authorization` 头携带有效 Access Token
- **需 ADMIN** — 需具有 ADMIN 或 SUPER_ADMIN 角色

---

## RAG 问答接口

### POST /rag/ask

同步 RAG 问答。

- **认证：** 公开
- **Content-Type：** `application/json`

**请求体：**
```json
{
  "question": "什么是RAG？",
  "conversationId": "rag-abc123",
  "maxResults": 5,
  "minScore": 0.5
}
```

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `question` | String | 是 | - | 用户问题 |
| `conversationId` | String | 否 | null | 会话ID，为空则不使用对话记忆 |
| `maxResults` | Integer | 否 | 5 | 最大检索结果数 |
| `minScore` | Double | 否 | 0.5 | 最低语义相似度阈值 [0.0, 1.0] |

**响应 200：**
```json
{
  "answer": "RAG是检索增强生成的缩写...",
  "thinking": "让我分析一下这个问题...",
  "conversationId": "rag-abc123",
  "sources": [
    {
      "filename": "技术白皮书.pdf",
      "text": "RAG（检索增强生成）是一种...",
      "score": 0.87,
      "images": []
    }
  ]
}
```

**响应 400：** `{"error":"无效请求","message":"问题不能为空"}`
**响应 500：** `{"error":"请求失败","message":"..."}`

---

### POST /rag/ask/stream

流式 RAG 问答（SSE）。

- **认证：** 公开
- **Content-Type：** `application/json`
- **Accept：** `text/event-stream`

**请求体：** 同 `/rag/ask`

**SSE 事件序列：**
```
event: start       → {conversationId}
event: sources     → [{filename, text, score, images}, ...]
event: thinking_delta → "思考文本增量"（零到多次）
event: thinking_end → {conversationId, thinkingEnded: true, reason}
event: delta       → "答案文本增量"（多次）
event: complete    → {conversationId, cancelled, content, thinking}
event: error       → {message}（出错时）
event: cancelled   → {conversationId, reason}（被取消时）
```

---

### POST /rag/ask/with-image

多模态图片问答（不经过 RAG 检索，直接发给 LLM）。

- **认证：** 公开
- **Content-Type：** `multipart/form-data`

**参数：**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `image` | MultipartFile | 是 | 图片文件（PNG/JPG/GIF/BMP/WEBP） |
| `question` | String | 是 | 问题文本 |
| `conversationId` | String | 否 | 会话ID |
| `maxResults` | Integer | 否 | 保留参数 |
| `minScore` | Double | 否 | 保留参数 |

**响应 200：** 同 `/rag/ask` 响应格式（`sources` 为空数组）

---

### POST /rag/conversations/{conversationId}/cancel

取消进行中的流式生成。

- **认证：** 公开

**响应 200：** `"已取消该会话的进行中生成任务"`
**响应 404：** `{"error":"未找到任务","message":"..."}`

---

### DELETE /rag/conversations/{conversationId}

清空会话上下文。

- **认证：** 公开

**响应 200：** `"会话上下文已清空"`

---

### GET /rag/health

健康检查。

- **认证：** 公开

**响应 200：** `"RAG 服务运行正常"`

---

### POST /rag/health

健康检查（POST）。

- **认证：** 公开

**请求体（可选）：**
```json
{"echo": "test"}
```

**响应 200：**
```json
{"status": "UP", "message": "RAG 服务运行正常", "echo": "test"}
```

---

## 文档管理接口

### POST /documents/upload

同步文档上传。

- **认证：** 需登录
- **Content-Type：** `multipart/form-data`

**参数：**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `file` | MultipartFile | 是 | 文档文件（PDF/DOCX/DOC/TXT/MD） |

**响应 200：** 文档处理结果（含 documentId, 段落数等）

---

### POST /documents/upload/stream

流式文档上传（SSE 进度）。

- **认证：** 需登录
- **Content-Type：** `multipart/form-data`
- **Accept：** `text/event-stream`

**参数：** 同 `/documents/upload`

**SSE 事件：** `start` → `parse_complete` → `segment_complete` → `embedding_generate_*` → `embedding_store_*` → `file_saved` → `complete`

---

### GET /documents

文档列表。

- **认证：** 需登录

---

### DELETE /documents/{id}

删除文档（级联删除段落、文件、图片、向量）。

- **认证：** 需登录

---

## 公开文档接口

### GET /documents/public

公开文档列表（无需认证，受限流保护）。

- **认证：** 公开

---

### GET /documents/public/{id}

公开文档详情。

- **认证：** 公开

---

### GET /documents/public/{id}/download

文件下载。

- **认证：** 公开

---

### GET /documents/images/{documentId}/{imageName}

文档图片访问。

- **认证：** 公开

---

## 管理员文档接口

### POST /admin/documents/{id}/reindex

重新索引文档（重新解析、分块、向量化）。

- **认证：** 需 ADMIN

---

### GET /admin/documents/{id}/segments

列出文档所有段落。

- **认证：** 需 ADMIN

---

### PUT /admin/documents/{id}/segments/{segmentId}

更新段落文本并重新嵌入。

- **认证：** 需 ADMIN

---

### DELETE /admin/documents/{id}/segments/{segmentId}

删除段落及其向量。

- **认证：** 需 ADMIN

---

## Prompt 管理接口

### GET /admin/prompts

列出所有系统 Prompt。

- **认证：** 需 ADMIN

---

### PUT /admin/prompts/{key}

更新指定 Prompt。

- **认证：** 需 ADMIN

---

### POST /admin/prompts/reset

重置所有 Prompt 为默认值。

- **认证：** 需 ADMIN

---

## 认证接口

### POST /auth/login

用户登录。

- **认证：** 公开

**请求体：**
```json
{"username": "admin", "password": "password123"}
```

**响应 200：**
```json
{"accessToken": "eyJ...", "refreshToken": "eyJ..."}
```

---

### POST /auth/register

用户注册（需邀请码）。

- **认证：** 公开

**请求体：**
```json
{"username": "newuser", "password": "password123", "registrationCode": "ABC123"}
```

**响应 200：** 同登录响应

---

### POST /auth/refresh

刷新 Token。

- **认证：** 公开

**请求体：**
```json
{"refreshToken": "eyJ..."}
```

**响应 200：** 新的 Token 对

---

### POST /auth/logout

登出（服务端无操作，前端清除 Token）。

- **认证：** 公开

---

### GET /auth/me

获取当前用户信息。

- **认证：** 需登录

**响应 200：**
```json
{"authenticated": true, "user": {"username": "admin", "role": "ADMIN"}}
```

---

### POST /auth/change-password

修改密码。

- **认证：** 需登录

---

## 管理员接口

### GET /admin/users

用户列表。

- **认证：** 需 ADMIN

---

### POST /admin/users

创建用户。

- **认证：** 需 ADMIN

---

### PUT /admin/users/{id}

更新用户信息（含角色分配）。

- **认证：** 需 ADMIN

---

### DELETE /admin/users/{id}

删除用户。

- **认证：** 需 ADMIN

---

### GET /admin/roles

角色列表。

- **认证：** 需 ADMIN

---

### POST /admin/roles

创建角色。

- **认证：** 需 ADMIN

---

### PUT /admin/roles/{id}

更新角色（含权限分配）。

- **认证：** 需 ADMIN

---

### GET /admin/permissions

权限列表。

- **认证：** 需 ADMIN

---

### POST /auth/registration-codes

生成注册邀请码。

- **认证：** 需 ADMIN

---

### GET /auth/registration-codes

邀请码列表。

- **认证：** 需 ADMIN
