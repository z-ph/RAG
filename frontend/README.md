# frontend

独立的 RAG 前端子项目，采用 `React + TypeScript + Vite`。

## 技术方案

- UI 设计语言参考 `Ant Design X` 的企业级 AI 控制台风格。
- 模型交互采用原生 `fetch + POST SSE` 流解析，直接适配当前 Spring Boot 后端。
- 本地开发通过 Vite 代理把 `/api` 转发到 `http://localhost:8080`。
- Docker / 生产构建时，`pnpm build` 产物会被复制到 Spring Boot `static/` 并由后端托管。

## 启动

```bash
cd frontend
pnpm install
pnpm dev
```

默认访问地址：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:8080`

如果使用仓库根目录的 Docker 方案，直接访问 `http://localhost:8080` 即可，前端静态资源由后端同源提供。

## 功能

- 文档上传、列表查询、删除
- RAG 流式问答
- 文档检索、思考内容折叠展示与自动收起
- 会话取消与清空
- 来源片段展示
- 消息复制
- 服务健康状态检查
