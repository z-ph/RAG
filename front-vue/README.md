# front-vue

独立的 RAG 前端 Vue 子项目，采用 `Vue 3 + TypeScript + Vite`，功能与现有 `frontend/` 保持等价。

## 技术方案

- 使用 `Ant Design Vue + Tailwind CSS` 延续当前暖色、克制的控制台风格。
- 模型交互沿用原生 `fetch + POST SSE` 流解析，直接适配当前 Spring Boot 后端。
- 本地开发通过 Vite 代理把 `/api` 转发到 `http://localhost:8080`。

## 启动

```bash
cd front-vue
pnpm install
pnpm dev
```

默认访问地址：

- 前端 Vue 版：`http://localhost:5174`
- 后端：`http://localhost:8080`

## 功能

- 文档上传、列表查询、删除
- RAG 流式问答
- 文档检索与思考态读秒反馈
- 会话取消与清空
- 来源片段展示
- 消息复制
- 服务健康状态检查
