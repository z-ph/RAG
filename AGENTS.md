# Repository Guidelines

## 项目结构与模块组织
后端代码位于 `src/main/java/com/mark/knowledge`，按功能拆分为 `rag`、`chat` 和公共 `config` 等模块；后端测试位于 `src/test/java`。前端位于独立的 `frontend/` 子项目中，其中 `frontend/src/components` 放界面组件，`frontend/src/hooks` 放状态与交互逻辑，`frontend/src/lib` 放 API 与 SSE 工具。接口契约和补充文档集中在 `docs/`，包括 `docs/openapi.yaml`。`uploads/` 属于运行期数据，`target/` 属于构建产物，不应作为业务源码修改。

## 构建、测试与开发命令
后端统一使用 Maven Wrapper：

- `./mvnw spring-boot:run`：启动 Spring Boot 服务，默认地址 `http://localhost:8080`。
- `./mvnw test`：运行后端 JUnit 5 测试。

前端统一使用 PNPM：

- `cd frontend && pnpm install`：安装前端依赖。
- `cd frontend && pnpm dev`：启动 Vite 开发服务器，默认地址 `http://localhost:5173`，并代理 `/api` 到后端。
- `cd frontend && pnpm build`：执行 `tsc -b` 和生产构建。

## 代码风格与命名约定
遵循仓库现有风格，不额外引入新的格式化体系。Java 使用 4 空格缩进，类名使用 `PascalCase`，方法和字段使用 `camelCase`，包名全小写并按功能归类。TypeScript/React 使用 2 空格缩进，组件名使用 `PascalCase`，Hook 使用 `useXxx` 命名，如 `useRagConversation`。DTO、Service、Controller 保持显式后缀，例如 `RagRequest`、`DocumentService`、`RagController`。

## 开发注意事项
- 每次修改代码都要同步检查 `README.md`、`docs/`、`docs/openapi.yaml` 等文档，保证行为和文档描述一致。
- 前端样式统一优先使用 Tailwind CSS，不要再书写自定义的CSS类，不要混入新的样式体系。
- 优先复用现有组件和 Ant Design 组件，不要重复造轮子。
- 避免使用蓝紫渐变，视觉方向保持当前偏暖、克制的风格。
- 不要做无意义的代码嵌套、包装层或抽象。
- 不要做无意义的卡片套卡片，只有在信息层级确实需要时才允许嵌套。

## 测试要求
后端测试基于 JUnit 5，文件放在 `src/test/java` 对应包路径下，命名以 `*Test` 结尾。修改后端服务、检索流程或控制器行为时，应补充或更新对应测试。

前端已配置 Playwright E2E 测试，位于 `frontend/e2e/tests/`，覆盖认证、问答、文档、管理后台四大模块的交互。修改前端关键交互行为时，应同步更新对应 E2E 测试。运行方式：

- `cd frontend && pnpm exec playwright test`：运行全部 E2E 测试（需先启动测试容器）。
- `cd frontend && pnpm exec playwright test --ui`：以 UI 模式调试。
- `./scripts/e2e.sh start && ./scripts/e2e.sh test`：一键启动真实容器环境并执行测试（详见 `docs/e2e-testing.md`）。

前端改动至少要通过 `pnpm build`。仓库目前没有强制覆盖率门槛。

## 提交与 Pull Request 规范
提交历史采用带作用域的 Conventional Commits，例如 `feat(frontend): ...`、`refactor(frontend): ...`。提交说明应使用祈使句，并准确标明范围，如 `frontend`、`rag`、`build`。发起 PR 时请附上变更摘要、测试说明、关联问题；涉及界面改动时补充截图。

## 配置与安全提示
本地配置从 `.env.example` 和 `frontend/.env.example` 复制，不要提交真实密钥或本地私有配置。联调前先确认模型服务和 Qdrant 可用。不要提交 `uploads/` 中的运行数据，也不要提交 `target/` 下的构建产物。


用户的需求优先考虑多subagent并行加速