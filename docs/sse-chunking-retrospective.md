# SSE 流式事件成块拥塞问题复盘

> 日期：2026-04-28
> 涉及模块：`RagService.java` / `RagController.java` / `sse.ts`
> 状态：已提交修复代码，根因待部署后确认

---

## 1. 问题现象

浏览器 DevTools Network 面板观察 SSE 流式接口 `POST /api/rag/ask/stream` 的响应，发现所有 `thinking_delta` 和 `delta` 事件**成块到达**——几十个事件共享同一个毫秒级时间戳，块与块之间间隔数秒。用户感知为：文本"一顿一顿"地出现，而非平滑的逐 token 流式渲染。

curl 直接请求同样出现分块拥塞，排除了浏览器端问题的可能。

---

## 2. 排查过程

### 2.1 第一轮：curl 时间戳验证

编写 `scripts/test-sse-timestamp.sh`，用 curl 请求 SSE 端点，通过 perl 为每个事件添加毫秒级时间戳：

```bash
curl -sS -N -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Cookie: $SESSION_COOKIE" \
  -d '{"question":"后端学习路线"}' \
  | perl -MTime::HiRes=time -MPOSIX=strftime -pe '...'
```

**结果**：curl 侧同样出现大量事件挤在同一毫秒、块间间隔 2-4 秒的现象。**确认问题出在服务端或中间层，而非浏览器。**

### 2.2 第二轮：Playwright 浏览器端验证

编写两个 Playwright E2E 测试：

| 测试文件 | 验证目标 |
|---|---|
| `sse-timing.spec.ts` | 通过 fetch 拦截记录每个 chunk 的到达时间戳 |
| `sse-render.spec.ts` | 通过 MutationObserver 记录文本增长曲线 |

**sse-render.spec.ts 结果**：`growthSteps` 只有 1-3 步（一次性出现），而非预期的 ≥10 步渐进增长。

**sse-timing.spec.ts 挑战**：在本地 Vite dev server 环境下，`page.evaluate()` 注入的 fetch 覆盖未能成功拦截 SSE 请求（可能原因：Vite HMR 模块系统干扰、fetch 引用缓存）。最终在远程部署环境通过 `context.addInitScript()` 成功捕获了 4 个 chunk，证实了分块模式。

### 2.3 第三轮：逐层排除

从 LLM 推理引擎 → 后端服务 → 反向代理 → 前端渲染，逐层排除：

| 假设 | 验证方法 | 结论 |
|---|---|---|
| vLLM 推理引擎 batching | 直接 curl vLLM API | **排除** — 每个 token 是独立 SSE 事件 |
| Nginx 反向代理缓冲 | 已设置 `X-Accel-Buffering: no` | **排除** — curl 直连容器端口也有问题 |
| React 自动批处理 | 改用 `setTimeout(0)` 让出主线程 | **仅治标** — 解决了前端渲染批处理，但未解决网络层成块 |
| Tomcat/SseEmitter 输出缓冲 | 阅读 Spring 源码 | **可能** — 已提交 `flushBuffer()` 修复 |
| Docker 容器网络 TCP 缓冲 | 未隔离测试 | **未排除** — 需容器内 curl 验证 |

### 2.4 第四轮：直接验证 vLLM

```bash
curl http://222.200.112.60/vllm/v1/chat/completions \
  -H "Authorization: Bearer sk-shiliuziyyds" \
  -d '{"model":"glm-4.6v-flash","messages":[{"role":"user","content":"你好"}],"stream":true}'
```

**结果**：每个 token 是独立的 `data: {"choices":[{"delta":{"content":"..."}}]}` 事件，时间戳均匀分布。**vLLM 不是瓶颈。**

---

## 3. 根因分析（待确认）

> **注意**：目前仅基于代码分析推测了最可能的原因，尚未通过容器内隔离测试确认。部署架构中存在多层缓冲，需逐层验证才能确定根因。

### 3.1 部署架构

Java 应用部署在 Docker 容器内，完整网络链路：

```
vLLM (宿主机)
  → Java Spring Boot (Docker 容器 :8080)
    → Docker bridge/NAT (映射到宿主机 :8081)
      → Nginx 反向代理 (宿主机 :80)
        → 浏览器/curl
```

每一层都可能引入输出缓冲：

| 层级 | 缓冲机制 | 是否可刷新 |
|---|---|---|
| Tomcat `SseEmitter` | 内部 output buffer (~8KB) | `response.flushBuffer()` |
| Docker bridge 网络 | TCP 发送缓冲区 + Nagle 算法 | TCP_NODELAY |
| Nginx 反向代理 | `proxy_buffering` 默认开启 | `X-Accel-Buffering: no` / `proxy_buffering off` |

### 3.2 可能的根因（按可能性排序）

**假设 A：Tomcat SseEmitter 输出缓冲**（当前修复方案针对此项）

`SseEmitter.send()` 将数据写入 Tomcat 内部 output buffer，不立即刷新到 TCP。每个 SSE 事件仅几十字节，需积攒到 buffer 满（~8KB）或连接空闲时才批量发出。

支持证据：
- curl 直连容器端口 `8081` 同样出现分块（排除了 Nginx）
- Spring 官方文档未明确提及需要手动 flush
- `response.flushBuffer()` 是 Spring 社区中 SSE 流式场景的常见修复手段

**假设 B：Docker 容器网络 TCP 缓冲**

Java 应用运行在 Docker 容器内，通过 bridge 网络的 NAT 映射到宿主机端口。Linux 内核的 TCP 发送缓冲区（`tcp_wmem`）和 Nagle 算法可能在小包场景下引入延迟。

支持证据：
- 小包（几十字节）容易触发 Nagle 算法的 200ms 延迟
- Docker bridge 网络经过 iptables NAT，增加了一层内核网络栈
- 当前未做容器内隔离测试，无法排除

**假设 C：多层缓冲叠加**

Tomcat buffer + Docker TCP buffer + Nginx proxy_buffering 三层叠加，每层各自引入少量延迟，最终表现为明显的分块。

### 3.3 确认根因的隔离测试方案

部署修复后，按以下步骤逐层隔离：

```bash
# 测试 1：容器内部直接请求（绕过 Docker 网络和 Nginx）
docker exec knowledge-rag-app curl -sS -N \
  -X POST http://localhost:8080/api/rag/ask/stream \
  -H "Content-Type: application/json" \
  -d '{"question":"后端学习路线"}' \
  | perl -MTime::HiRes=time -MPOSIX=strftime -pe '...'

# 测试 2：宿主机直连容器端口（经过 Docker NAT，绕过 Nginx）
curl -sS -N http://222.200.112.60:8081/api/rag/ask/stream ...

# 测试 3：通过 Nginx 请求（完整链路）
curl -sS -N http://222.200.112.60/rag-back/api/rag/ask/stream ...
```

- 若测试 1 已逐 token 到达 → 根因是 Tomcat buffer，`flushBuffer()` 修复有效
- 若测试 1 仍分块但测试 2 正常 → 根因是 Docker 网络层
- 若测试 2 仍分块但测试 3 正常 → 根因是 Nginx 缓冲

### 3.4 为什么不容易发现

- `SseEmitter` 的 Javadoc 和 Spring 官方文档均未明确提及需要手动 flush
- 本地开发环境（低延迟 localhost）现象不明显，部署到生产环境（Docker + Nginx）后才暴露
- 浏览器 DevTools 的 Network 面板显示的是 chunk 到达时间，看起来像是"网络问题"
- Docker 容器网络对 SSE 这类"大量小包"场景的缓冲行为不直观

---

## 4. 修复方案

### 4.1 后端：每次 send 后强制 flush

**文件**：`RagService.java`

```java
// InFlightGeneration 新增字段和方法
private final HttpServletResponse response;

private InFlightGeneration(..., HttpServletResponse response) {
    ...
    this.response = response;
}

private void flush() {
    try {
        response.flushBuffer();
    } catch (IOException ignored) {}
}
```

```java
// sendEvent 末尾调用 flush
private void sendEvent(InFlightGeneration generation, String eventName, Object data) {
    if (generation.isCompleted()) return;
    try {
        generation.emitter().send(SseEmitter.event().name(eventName).data(data));
        generation.flush();  // 强制刷新 Tomcat 输出缓冲
    } catch (IOException e) { ... }
}
```

**文件**：`RagController.java` — 将 `HttpServletResponse` 传递给 service

```java
return ragService.askStream(request, response);
```

### 4.2 前端：逐事件让出主线程（辅助修复）

**文件**：`frontend/src/lib/sse.ts` 和 `front-vue/src/lib/sse.ts`

将同步 `while` 循环中立即调用 `onEvent()` 改为先收集 `pending` 数组，再逐个派发并在 `delta`/`thinking_delta` 事件后 `await setTimeout(0)` 让出主线程，避免 React/Vue 批处理合并多次状态更新。

---

## 5. 错误诊断回顾

排查过程中走了不少弯路，记录关键错误判断：

| # | 错误判断 | 实际情况 | 反思 |
|---|---|---|---|
| 1 | 先读代码分析，后复现问题 | 应先复现 | 复现优先于理论分析 |
| 2 | DevTools 时间戳 ≈ React 渲染时间 | DevTools 显示的是网络层 chunk 到达时间 | 区分网络层和应用层时间 |
| 3 | 前端 `setTimeout(0)` 是完整修复 | 只解决了 React 批处理，未解决网络层成块 | 治标不等于治本 |
| 4 | 怀疑 LLM batching | vLLM 每个 token 独立输出 | 应先验证最底层的输出 |
| 5 | Playwright `page.evaluate()` 注入 fetch 覆盖 | 导航后 JS 上下文重置，覆盖丢失 | `evaluate` 在 `goto` 之后、用户操作之前注入 |

---

## 6. 经验教训

1. **复现优先**：遇到性能/时序问题，先用最小工具（curl）复现，再逐层排查
2. **自底向上验证**：从 LLM → 后端 → 代理 → 前端，逐层确认每层的输出是否符合预期
3. **隔离测试**：在 Docker 容器部署场景下，不能只从外部测试，必须在容器内部验证以排除网络层缓冲
4. **SseEmitter 需要手动 flush**：Spring 的 `SseEmitter.send()` 不保证立即发送，`response.flushBuffer()` 是合理的防御性措施
5. **前端 setTimeout(0) 是补充而非替代**：后端 flush 解决网络层问题，前端让出主线程解决渲染层问题，两者互补

---

## 7. 待验证

- [ ] 部署 flush 修复后，用 `scripts/test-sse-timestamp.sh` 验证 curl 侧事件是否逐个到达
- [ ] 用 `sse-render.spec.ts` 验证浏览器端文本是否渐进渲染（`growthSteps ≥ 10`）
- [ ] 容器内 curl 测试（隔离 Docker 网络层），确认根因是 Tomcat 还是 Docker 网络
- [ ] 确认 `flushBuffer()` 在高并发下无性能回退（每次 send 都 flush 会增加系统调用次数）
