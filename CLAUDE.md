# RAG 知识库项目

用户的所有要求，优先想办法使用并行subagent加速

## 技术栈

**后端：** Java 21 / Spring Boot 4.0.2 / LangChain4j 1.12.2 / Qdrant (768维) / MySQL / JWT + RBAC / Maven / Docker Compose
**前端：** React 19 + antd 6 (`frontend/`) | Vue 3 + ant-design-vue 4 (`front-vue/`)，共享 Tailwind CSS 4 + TypeScript 6 + Vite 8 + pnpm

## 模块结构

```
com.mark.knowledge
├── rag/          # RAG核心：问答管道、文档管理、嵌入、BM25、对话记忆
├── auth/         # 认证授权：JWT、RBAC、邀请码注册
├── config/       # 基础设施：Qdrant初始化、限流、日志、.env加载
├── chat/         # LLM模型Bean配置
└── KnowledgeApplication  # 启动类
```

## 核心服务

| 服务 | 行数 | 职责 |
|------|------|------|
| `rag.service.RagService` | 1300 | RAG管道编排：检索→重排→跨文档→LLM生成（同步/SSE流式） |
| `rag.service.DocumentService` | 1189 | 文档解析（PDF/DOCX/DOC/TXT）、清洗、分块、元数据提取 |
| `rag.service.EmbeddingService` | 380 | 批量向量化 + Qdrant分批写入（含重试） |
| `rag.service.Bm25Scorer` | 180 | BM25文本评分（k1=1.5, b=0.75, CJK bigram分词） |
| `rag.service.ConversationMemoryService` | 150 | 内存会话记忆（滑动窗口6条、TTL 30分钟） |
| `auth.service.AuthService` | 140 | JWT认证：登录/注册/刷新/RefreshToken Rotation |
| `auth.config.SecurityConfig` | 127 | Spring Security：无状态、URL权限、CORS、异常处理 |

## 关键配置

- 混合检索权重：向量 0.6 + BM25 0.4，候选倍数4x
- 分块：320字符目标，250~350范围，40字符重叠
- 嵌入批次：请求10条/批，存储32条/批，重试3次
- LLM：vLLM + Qwen2.5-7B-Instruct（OpenAI兼容协议）
- 嵌入：vLLM + bge-base-zh-v1.5（768维中文）

## 详细文档

| 文档 | 内容 |
|------|------|
| [架构概述](docs/architecture.md) | 技术栈全景、模块依赖、请求流程、数据存储 |
| [RAG管道详解](docs/rag-pipeline.md) | 完整管道流程、方法签名、SSE事件、BM25算法、流式ThinkTag解析 |
| [文档管理](docs/document-management.md) | 上传/解析/分块/向量化/删除/重索引全流程 |
| [认证授权](docs/auth-rbac.md) | JWT流程、SecurityConfig权限规则、RBAC模型、引导初始化 |
| [API参考](docs/api-reference.md) | 所有REST端点：路径、方法、请求/响应格式、认证要求 |
| [配置与基础设施](docs/config-infrastructure.md) | Qdrant初始化、限流、日志、LLM Bean、CORS、Docker |
| [开发部署指南](docs/dev-deploy-guide.md) | 环境要求、快速启动、配置项、环境变量、Docker部署、排查 |
| [前端应用](docs/frontend.md) | React/Vue双版本前端：组件结构、Hooks、路由、API交互 |

## 公开端点（无需认证）

`/rag/**`, `/documents/public/**`, `/documents/images/**`, `/auth/login`, `/auth/register`, `/auth/refresh`

## 测试

```bash
mvn test    # 12个测试类：RagController, DocumentService, RagService等
```