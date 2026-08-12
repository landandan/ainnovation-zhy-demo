# zhy-ai-chat

> 基于 Dify 的多智能体 AI 对话前端（Next.js 16 + React 19 + TypeScript）

纯前端 SPA，负责与后端服务（经 nginx 统一代理）通信，完成多智能体对话、流式响应（SSE）、
会话管理、文件上传、消息反馈、思考 / 工作流进度展示，以及管理端（智能体 / Dify 配置 / 用户设置）
等功能。**本仓库不包含后端代码**，后端为独立服务，由 nginx 反向代理。

---

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 框架 | Next.js 16（App Router） | React 19 + TypeScript，单页应用（SPA） |
| 样式 | 原生 CSS + 少量 UI 库 | 多主题支持（持久化到 localStorage） |
| AI 引擎 | Dify | 多 Agent 流式对话（SSE） |
| 加密 | sm-crypto | SM2 密码加密 |
| 状态 | React Context / localStorage | 认证态、主题、会话缓存 |

---

## 目录结构

```
zhy-ai-chat/
├── app/                        # 路由与页面
│   ├── layout.tsx              # 根布局
│   ├── client-layout.tsx       # AuthProvider + 路由守卫 + 页面过渡
│   ├── page.tsx               # 主聊天页
│   ├── login/page.tsx          # 登录 / 注册
│   ├── settings/page.tsx       # 管理端：智能体 / Dify 配置 / 用户设置
│   ├── tools/page.tsx          # 工具集入口
│   ├── tools/tools/            # 工具实现（文档转换、中英互译、PDF→Word、语音转写等）
│   └── utils/fingerprintjs.tsx # 设备指纹（guest 登录用）
├── components/                 # UI 组件（侧边栏、聊天区、输入框、资源栏、消息操作等）
├── lib/                        # 前端逻辑层
│   ├── api-client.ts           # API 客户端（认证、智能体、会话、文件、反馈等）
│   ├── dify-api.ts             # Dify 流式调用（SSE）
│   ├── workflow-progress.ts    # 工作流 / 思考进度状态
│   ├── auth-store.tsx          # 认证 Context（useAuth）
│   ├── auth/                   # token 存取、SM2 加密、Provider
│   ├── http/                   # 请求封装（request / ApiError）与 API_BASE_URL
│   ├── settings-store.ts       # 主题存储
│   ├── mock-config.ts          # Mock 模式数据（无后端时降级）
│   └── mock/                   # Mock 实现（会话、消息、Dify 配置）
├── public/                     # 静态资源
├── next.config.mjs
├── tsconfig.json
└── package.json
```

> `lib` 根目录的 `api-client.ts` / `dify-api.ts` / `workflow-progress.ts` / `settings-store.ts` /
> `utils.ts` / `mock-config.ts` 为兼容入口，分别 re-export 对应子目录下的真实实现
> （`api/`、`dify/`、`workflow/`、`storage/`、`ui/`、`mock/`）。详见 [`lib/README.md`](./lib/README.md)。

---

## 本地开发

要求 Node.js 22+。

```bash
npm install    # 安装依赖
npm run dev    # 启动开发服务器（默认 http://localhost:3000）
```

### Mock 模式（无需后端）

访问 `/login?mock=true`（或在登录页启用游客 / Mock 登录）即可进入 Mock 模式：
所有 API 请求走 `localStorage`，不依赖后端，便于纯前端联调与 UI 开发。

> 实际接口经由 nginx 代理到后端服务，主要端点包括 `/h5/auth/*`、`/h5/chat/*`、
> `/manage/difyApp/*`、`/auth/*`、`/settings` 等。后端为独立服务，不在本仓库内。

---

## 构建与部署

```bash
npm run build    # 生产构建
npm run start    # 启动生产服务
npm run lint     # ESLint 检查
```

前端为静态 SPA，构建产物由 nginx 托管，并反向代理到后端服务与 Dify。

---

## 主要特性

- 多智能体对话，支持切换与权限控制（游客 / 登录用户）
- Dify 流式响应（SSE），含思考过程与工作流节点进度展示
- 会话历史、分页加载、重命名、删除
- 文件 / 图片上传，消息赞踩与反馈
- 多主题切换（持久化到 localStorage）
- 管理端：智能体增删改查、Dify 配置、用户设置
- 工具集：文档格式转换、中英互译、PDF→Word、语音转写等
- SM2 密码加密 + JWT 认证（token 存于 localStorage）

---

## License

内部项目。
