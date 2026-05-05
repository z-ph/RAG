# Requirements Analysis

## Problem Statement

当前日志系统（`logback-spring.xml`）将所有日志写入 `app.log`、`error.log`、`http.log` 三个平铺文件，缺少按业务层分类的能力。管理员排查问题时需要手动 grep，无法快速定位网络请求、数据库操作、模型调用等不同层面的异常。RAG pipeline 的 `RagService` 有大量 `[TTFT-DETAIL]` 流程日志，但这些日志混在 app.log 里，没有结构化地记录每个节点的输入输出。

## Use Cases

1. **管理员查看 HTTP 请求日志**：打开前端日志页面，选择"网络层"，看到最近请求的方法、路径、状态码、耗时，可按日期筛选。
2. **管理员排查数据库异常**：选择"数据库层"，看到 Repository 调用的 SQL、耗时、是否报错，快速定位慢查询。
3. **管理员追踪模型会话**：选择"模型会话层"，看到一个 RAG 请求从"问题改写 → 向量检索 → BM25 重排 → 模型生成"每个节点的输入、输出和耗时。
4. **管理员查看错误日志**：选择"错误"标签，跨层查看所有 ERROR 级别日志。

## Acceptance Criteria

### AC-1: 按层分文件夹、按日期分文件
- 日志目录结构为 `logs/{layer}/{yyyy-MM-dd}.log`，layer 包含 `network`、`database`、`model-session`、`app`。
- 每个层的 error 日志单独存放：`logs/{layer}/error-{yyyy-MM-dd}.log`。
- 文件保留 30 天自动清理。

### AC-2: 网络层日志
- 增强 `LoggingFilter`（`config/LoggingFilter.java`），记录：请求方法、URI、查询参数、状态码、耗时、请求体摘要（可选）、响应体摘要（可选）。
- 请求/响应体摘要最大 500 字符，超出截断并追加 `...[truncated]`。文件上传请求跳过请求体记录。
- 使用 JSON 格式写入日志，便于解析。
- 排除健康检查路径（`/rag/health`）。

### AC-3: 数据库层日志
- 通过 AOP 切面拦截带 `@Repository` 注解的类，覆盖包：`auth.repository`、`rag.repository`。Pointcut 目标为 Spring Data 生成的代理方法调用。
- 记录：方法名、参数摘要（最大 200 字符）、返回值摘要（最大 200 字符）、耗时、是否异常。
- 敏感字段脱敏：参数名含 `password`、`token`、`secret` 的值替换为 `***`。

### AC-4: 模型会话层日志
- 在 `RagService` 的 RAG pipeline 各节点（问题改写、向量检索、BM25 重排、跨文档检索、模型生成）记录结构化日志。
- 每条日志包含：`conversationId`、`step`（节点名）、`input`（输入摘要，最大 500 字符）、`output`（输出摘要，最大 500 字符）、`elapsedMs`（耗时）、`timestamp`、`error`（异常消息，仅失败时）、`success`（boolean）。
- 使用专用 logger（`model-session`）写入独立文件。
- RAG 用户输入假设为非敏感内容，不额外脱敏。

### AC-5: 日志查询 REST API
- `GET /admin/logs` — 查询日志，参数：`layer`（可选）、`date`（可选，默认今天）、`level`（可选，INFO/ERROR）、`keyword`（可选）、`page`、`size`、`timeFrom`（可选，HH:mm）、`timeTo`（可选，HH:mm）、`sort`（可选，默认 `time:desc`，可选 `time:asc`）。
- 仅管理员可访问（复用现有 RBAC 鉴权）。
- 返回分页结果，包含日志条目列表和总数。
- 文件读取需容错处理：跳过未写完的最后一行（Logback 并发写入场景）。

### AC-6: 前端日志查看页面
- Admin 侧边栏增加"日志管理"菜单项。
- 页面支持：按层切换（网络层/数据库层/模型会话层/全部）、按级别筛选（INFO/ERROR）、按日期筛选、关键词搜索。
- 日志列表展示：时间戳、级别、层、消息内容（JSON 格式化展示）。
- 分页加载。

## Non-functional Requirements

- 日志写入不影响主流程性能（异步 appender）。
- 单个日志文件不超过 100MB（触发滚动）。
- API 响应时间 < 500ms（读取本地文件）。

## Out of Scope

- 实时日志推送（WebSocket/SSE tail）— 后续可扩展。
- 日志聚合到 ELK/Loki 等外部系统。
- 日志导出/下载功能。
- 自动化告警规则。
