# TDD Development Checkpoints

## Checkpoint 1: Logback 按层按日期分文件配置

**What:** 改造 `logback-spring.xml`，建立按层分文件夹、按日期分文件的日志目录结构。

**Test first:** 验证应用启动后 `logs/network/`、`logs/database/`、`logs/model-session/`、`logs/app/` 目录存在，且各层 logger 写入正确文件。
**Acceptance:** 发送 HTTP 请求后 `logs/network/{date}.log` 出现对应日志行；通用日志写入 `logs/app/{date}.log`；error 日志写入各层 `error-{date}.log`。
**Hash:** ``

---

## Checkpoint 2: 网络层 JSON 日志增强

**What:** 增强 `LoggingFilter`，以 JSON 格式记录 HTTP 请求（方法、URI、状态码、耗时），使用 `network` logger 写入。

**Test first:** 发送 `GET /api/documents`，验证 `logs/network/{date}.log` 包含 JSON 行含 `ver:1`、`layer:"network"`、`method:"GET"`、`uri`、`status`、`elapsedMs` 字段。
**Acceptance:** 健康检查路径不产生日志；请求体/响应体摘要不超过 500 字符；JSON 格式合法可解析。
**Hash:** ``

---

## Checkpoint 3: 数据库层 AOP 切面

**What:** 新增 `RepositoryLoggingAspect`，拦截 `@Repository` 注解类的方法调用，记录方法名、参数摘要、耗时、异常信息到 `database` logger。

**Test first:** 调用任意 Repository 方法（如 `UserAccountRepository.findAll()`），验证 `logs/database/{date}.log` 包含 JSON 行含 `layer:"database"`、`method`、`elapsedMs`、`success` 字段。
**Acceptance:** 敏感字段（password/token/secret）脱敏为 `***`；参数和返回值摘要不超过 200 字符；异常时记录 `error` 字段且 `success:false`。
**Hash:** ``

---

## Checkpoint 4: 模型会话层 RAG Pipeline 日志

**What:** 在 `RagService` 各 pipeline 节点（问题改写、向量检索、BM25 重排、跨文档检索、模型生成）插入结构化日志，记录输入/输出/耗时/成功状态到 `model-session` logger。

**Test first:** 发送 RAG 问询请求，验证 `logs/model-session/{date}.log` 包含多个 JSON 行，覆盖 `step:"question_rewrite"`、`step:"vector_search"`、`step:"bm25_rerank"`、`step:"model_generate"` 等节点，每条含 `conversationId`、`input`、`output`、`elapsedMs`、`success`。
**Acceptance:** 各节点日志按 pipeline 顺序出现；失败节点含 `error` 字段且 `success:false`；输入输出摘要不超过 500 字符。
**Hash:** ``

---

## Checkpoint 5: 日志查询 REST API

**What:** 新增 `LogController`（`GET /admin/logs`）和 `LogService`，读取本地日志文件，解析 JSON 行，支持分页和筛选（layer/level/date/keyword/timeFrom/timeTo/sort）。

**Test first:** 验证 `GET /admin/logs?layer=network&date={today}` 返回 200 和分页 JSON `{"items":[...],"total":N,"page":1,"size":50}`；无权限用户返回 403。
**Acceptance:** 所有筛选参数（layer、level、date、keyword、timeFrom、timeTo、sort）工作正常；分页正确；解析失败的行被跳过不报错；仅管理员可访问。
**Hash:** ``

---

## Checkpoint 6: 前端日志查看页面

**What:** 前端 Admin 侧边栏增加"日志管理"菜单，新增 `LogViewer.tsx` 页面，支持按层切换、按级别/日期筛选、关键词搜索、分页浏览。

**Test first:** 管理员登录后点击"日志管理"，页面加载并展示日志列表；切换层/级别/日期后列表更新；关键词搜索返回匹配结果。
**Acceptance:** 日志列表显示时间戳、级别（带颜色标签）、层名、消息内容（JSON 展开查看）；分页控件工作正常；非管理员无法访问。
**Hash:** ``

---

## Progress

- [ ] Checkpoint 1: Logback 按层按日期分文件配置
- [ ] Checkpoint 2: 网络层 JSON 日志增强
- [ ] Checkpoint 3: 数据库层 AOP 切面
- [ ] Checkpoint 4: 模型会话层 RAG Pipeline 日志
- [ ] Checkpoint 5: 日志查询 REST API
- [ ] Checkpoint 6: 前端日志查看页面
