# Solution Trade-offs

## Approaches

### Option A: Logback 分层 + AOP + 文件读取 API（推荐）

- **How it works:**
  1. 改造 `logback-spring.xml`，为每层定义独立 logger + rolling file appender，按 `logs/{layer}/{date}.log` 和 `logs/{layer}/error-{date}.log` 组织文件。
  2. 网络层：增强现有 `LoggingFilter`，以 JSON 格式写入 `network` logger。
  3. 数据库层：新增 `@Aspect` 切面拦截 `repository` 包方法，记录调用日志到 `database` logger。
  4. 模型会话层：在 `RagService` 各 pipeline 节点插入结构化日志调用 `model-session` logger。
  5. 新增 `LogController` + `LogService`，读取本地日志文件，解析 JSON 行，支持分页/筛选/搜索。
  6. 前端新增 `LogViewer` 页面，接入 admin API。
- **Pros:** 与现有 Logback 基础设施完全兼容；AOP 无侵入；文件存储简单可靠；实现复杂度适中。
- **Cons:** 文件读取在日志量大时可能有性能瓶颈；日志搜索为线性扫描。
- **Effort estimate:** M

### Option B: 内存环形缓冲区 + API 查询

- **How it works:** 日志不写文件（或写文件的同时）保存在内存中的 RingBuffer（如 CyclicBuffer 或 Disruptor），API 直接查内存。
- **Pros:** 查询速度快（内存操作）；不需要解析文件。
- **Cons:** 重启丢失；内存占用大；缓冲区大小有限，历史数据有限；不适合按日期查询的需求。
- **Effort estimate:** M

### Option C: 引入专业日志框架（如 Loki + Grafana）

- **How it works:** 将日志推送到 Loki，通过 Grafana 查看。
- **Pros:** 功能强大，支持全文搜索、聚合、告警。
- **Cons:** 运维成本高（需要部署 Loki + Grafana）；偏离项目轻量化架构；需求过度工程化。
- **Effort estimate:** L

## Comparison

| Criterion       | Option A (Logback + AOP) | Option B (RingBuffer) | Option C (Loki+Grafana) |
|-----------------|--------------------------|-----------------------|-------------------------|
| 实现复杂度      | 中                       | 中                    | 高                      |
| 查询性能        | 良（文件读取+解析）       | 优（内存）             | 优（专用引擎）           |
| 数据持久性      | 有（文件）                | 无（重启丢失）          | 有                      |
| 运维成本        | 低                       | 低                    | 高                      |
| 与现有架构兼容性 | 完全兼容                  | 需额外组件             | 需外部服务               |
| 按日期查询      | 原生支持                  | 不支持                 | 原生支持                 |

## Recommendation

**Option A（Logback 分层 + AOP + 文件读取 API）**。

理由：项目已有 Logback 基础设施和 `LoggingFilter`，Option A 改动最小、与现有架构完全兼容。文件按日期组织是 Logback 原生能力，不需要额外组件。文件读取 API 对于日志量不大的场景（单机部署）性能足够。Option B 不满足按日期查看历史日志的需求。Option C 运维成本与项目轻量化定位不符。

### 架构草图

```
logs/
├── network/
│   ├── 2026-05-05.log          # INFO+ HTTP 请求日志
│   └── error-2026-05-05.log    # ERROR 级别
├── database/
│   ├── 2026-05-05.log          # INFO+ 数据库操作日志
│   └── error-2026-05-05.log
├── model-session/
│   ├── 2026-05-05.log          # INFO+ RAG pipeline 节点日志
│   └── error-2026-05-05.log
└── app/
    ├── 2026-05-05.log          # 通用应用日志
    └── error-2026-05-05.log
```

日志格式（JSON 单行，含版本号）：
```json
{"ver":1,"timestamp":"2026-05-05T14:30:00.123","level":"INFO","layer":"network","method":"GET","uri":"/documents","status":200,"elapsedMs":45}
```

```json
{"ver":1,"timestamp":"2026-05-05T14:30:01.456","level":"INFO","layer":"model-session","conversationId":"rag-abc123","step":"vector_search","input":"问题向量(dim=1024)","output":"召回5条候选","elapsedMs":120,"success":true}
```

```json
{"ver":1,"timestamp":"2026-05-05T14:30:02.789","level":"ERROR","layer":"model-session","conversationId":"rag-abc123","step":"vector_search","input":"...","error":"Qdrant timeout after 30s","elapsedMs":30042,"success":false}
```

API 端点：
- `GET /admin/logs?layer=network&date=2026-05-05&level=ERROR&page=1&size=50&keyword=timeout&timeFrom=09:00&timeTo=18:00&sort=time:desc`
- 返回 `{"items": [...], "total": 123, "page": 1, "size": 50}`
- 文件读取容错：跳过解析失败的行（如 Logback 正在写入的未完成行）

### 性能阈值与降级策略

- **预期日志量**：单层单日 < 50MB（单机 RAG 应用典型量级）。
- **阈值**：若单文件 > 100MB，API 从文件尾部倒序读取（`RandomAccessFile` seek to end），避免全文扫描。
- **降级**：超出阈值时 API 返回提示"日志量过大，建议缩小时间范围"，不做全文索引。

### 旧日志迁移

- 新的 `network/` 层完全替代旧的 `http.log`（废弃 `http` logger）。
- 旧的 `app.log` 和 `error.log` 内容迁移到 `app/` 层。
- 迁移方式：修改 `logback-spring.xml` 后旧日志文件自然过期删除（30 天），无需手动迁移历史文件。

前端组件：
- `AdminLayout` 侧边栏增加"日志管理"菜单（`FileSearchOutlined` 图标）
- 新增 `LogViewer.tsx` 页面，使用 Ant Design Table + Select + DatePicker
