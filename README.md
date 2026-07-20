# 🌊 深海智航 — CNOOC AI 智能助手

> 智能助手 - 海上钻井平台安全规程查询、设备故障诊断、智能巡检、生产日报填报

基于 Dify AI 平台构建的多智能体对话系统，支持知识库问答、设备维修诊断、智能巡检排班、生产日报生成等场景。

---

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | Next.js 16 (React + TypeScript) | SPA 静态导出，20 套主题 |
| 后端 | Flask 3.x + SQLAlchemy | REST API，JWT 认证 |
| 数据库 | SQLite (dev) / PostgreSQL (prod) | 用户、智能体、对话、消息 |
| AI 引擎 | Dify Platform | 多 Agent 流式对话，SSE 协议 |
| 反向代理 | Nginx | 统一入口，路由分发 |
| 容器化 | Docker + Docker Compose | 一键部署 |

---

## 项目结构

```
CNOOC-demo/
├── docker-compose.yml          # 一键启动全栈
├── nginx.conf                  # Nginx 路由配置
├── README.md                   # 本文档
│
├── backend/                    # Flask 后端
│   ├── app.py                  # 主入口，蓝图注册
│   ├── config.py               # 配置（DB 地址、JWT 密钥等）
│   ├── models/                 # SQLAlchemy 数据模型
│   │   ├── user.py             # 用户 + 角色
│   │   ├── agent.py            # 智能体定义 + Dify API Key
│   │   └── conversation.py     # 对话 + 消息
│   ├── routes/                 # API 路由
│   │   ├── auth.py             # 登录/注册/获取用户信息
│   │   ├── agents.py           # 智能体列表
│   │   ├── conversations.py    # 对话 CRUD + 消息管理
│   │   └── settings.py         # 用户设置 / Dify 配置
│   ├── utils/auth.py           # JWT 签发与校验
│   ├── scripts/                # CLI 工具脚本
│   │   └── init_admin.py       # 管理员初始化/重置
│   ├── .env.example            # 环境变量模板
│   ├── requirements.txt        # Python 依赖
│   └── Dockerfile
│
├── frontend/                   # Next.js 前端
│   ├── app/                    # 页面路由
│   │   ├── page.tsx            # 主聊天页
│   │   ├── login/page.tsx      # 登录/注册页
│   │   ├── settings/page.tsx   # API/Dify 设置页
│   │   ├── layout.tsx          # 根布局
│   │   └── client-layout.tsx   # AuthProvider + 路由守卫
│   ├── components/             # UI 组件
│   │   ├── sidebar.tsx         # 侧边栏（对话历史）
│   │   ├── chat-area.tsx       # 聊天区域
│   │   ├── agent-section.tsx   # 智能体选择
│   │   ├── input-area.tsx      # 输入框 + 附件
│   │   ├── resource-sidebar.tsx# 右侧边栏（引用来源）
│   │   └── ...
│   ├── lib/
│   │   ├── api-client.ts       # 前端 API 客户端（自动 JWT）
│   │   ├── auth-store.tsx      # React Context 认证状态管理
│   │   ├── dify-api.ts         # Dify 流式调用
│   │   └── mock-api.ts         # Mock 数据（无后端时降级）
│   └── next.config.mjs         # Next.js 配置（含 dev 代理）
│
└── data/                       # SQLite 数据库持久化（运行时生成）
    └── cnooc.db
```

---

## 启动方式

### 方式一：Docker Compose 一键启动（推荐用于部署/集成测试）

```bash
# 在项目根目录
docker compose up -d --build
```

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端 (Nginx) | `9527` | 静态文件 + API 代理 |
| 后端 (Flask) | `5000` | REST API |
| 数据库 (SQLite) | — | 文件持久化在 `data/` 目录 |

浏览器访问 **http://localhost:9527**，首次自动跳转登录页。

修改代码后重建对应服务：
```bash
docker compose up -d --build frontend   # 仅重建前端
docker compose up -d --build backend    # 仅重建后端
```

---

### 初始化管理员账号

首次启动后端前，需要初始化管理员账号和默认智能体：

```bash
cd backend

# 1. 创建 .env 配置文件（根据模板修改）
cp .env.example .env

# 2. 安装依赖
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 3. 运行初始化脚本（创建管理员 + 默认智能体 + 角色）
python scripts/init_admin.py
```

> 默认管理员账号: `admin` / `admin123`（可通过 `.env` 中的 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 修改）

**脚本选项：**

| 选项 | 说明 |
|------|------|
| `--force` | 强制重置管理员密码和显示名称 |
| `--no-default-agents` | 跳过默认智能体的创建 |
| `--help` | 查看完整帮助 |

脚本执行是**幂等**的：重复运行不会产生重复数据。使用 `--force` 可重置管理员密码。

---

### 方式二：本地开发模式（推荐用于日常开发，支持热重载）

> 需要本地安装 Node.js 22+ 和 Python 3.12+

**步骤 1：启动 Flask 后端**

```bash
cd backend
// 创建并激活虚拟环境
python3 -m venv venv
// 安装依赖
pip install -r requirements.txt
// 复制环境变量模板
cp .env.example .env
// 注意： windows 环境需要将 `DATABASE_URL` 从 `../data/cnooc.db` 改为 `../../data/cnooc.db`
# 示例：  
DATABASE_URL=sqlite:///../../data/cnooc.db

cd ..
mkdir -p data
// 初始化数据库
python scripts/init_admin.py --force

# 启动 Flask（debug 模式，代码修改自动 reload）
python app.py
```

后端运行在 **http://localhost:5000**，Flask debug 会输出请求日志。

**步骤 2：启动 Next.js 前端**

```bash
# 新开一个终端
cd frontend

# 安装依赖（首次）
npm install

# 启动开发服务器（热重载）
npm run dev
```

前端运行在 **http://localhost:3000**。

> ⚠️ **重要**：开发模式下，`next.config.mjs` 已配置 `rewrites`，前端 `/api/*` 请求会自动代理到 `localhost:5000`，**无需启动 nginx 或 Dify 即可开发联调**。

浏览器访问 **http://localhost:3000**。

---

### 方式三：仅后端调试（用 curl 或 Postman 测试 API）

```bash
cd backend
source venv/bin/activate
python app.py
```

```bash
# 测试注册
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123","display_name":"管理员"}'

# 测试登录
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 测试获取智能体列表（需要 Bearer Token）
curl http://localhost:5000/api/agents \
  -H "Authorization: Bearer <token>"
```

---

### 方式四：连接本地 Dify 服务

如果本地运行了 Dify：

```bash
# 假设 Dify 的 nginx 在 80 端口
docker compose -f /path/to/dify/docker-compose.yml up -d
```

前端 `next.config.mjs` 已配置 `/v1/*` 代理到 `localhost:80`，开发模式下可直接调用本地 Dify API。

---

## 快速验证

| 修改范围 | 验证方式 |
|---------|---------|
| 前端 UI/组件 | `npm run dev` 自动热重载，刷新浏览器即可 |
| 前端 API 调用 | 浏览器 DevTools → Network 面板，观察 `/api/*` 请求 |
| 后端 Python 代码 | Flask debug 自动 reload，改完立即生效 |
| 后端数据模型 | 删掉 `data/cnooc.db`，运行 `python scripts/init_admin.py` 重建 |
| 重置管理员 | `python scripts/init_admin.py --force` |
| Dify 对接 | 设置页配置 API Key，发送消息查看流式返回 |

---

## 环境变量

配置文件 `backend/.env.example` 包含所有可配置项，使用时复制为 `.env`：

```bash
cp backend/.env.example backend/.env
```

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DATABASE_URL` | `sqlite:///../data/cnooc.db` | 数据库连接串 |
| `SECRET_KEY` | `change-me-to-a-random-secret` | JWT 签名密钥，生产环境必须修改 |
| `JWT_EXPIRATION_HOURS` | `72` | Token 有效期（小时） |
| `AUTH_PROVIDER` | `local` | 认证方式（local / dify） |
| `ADMIN_USERNAME` | `admin` | 管理员用户名 |
| `ADMIN_PASSWORD` | `admin123` | 管理员密码 |
| `ADMIN_EMAIL` | — | 管理员邮箱 |
| `ADMIN_DISPLAY_NAME` | `系统管理员` | 管理员显示名称 |

可通过环境变量覆盖；Docker 部署时在 `docker-compose.yml` 中配置。

---

## License

内部项目 — 创新奇智


cd d:\myProject\CNOOC-demo\frontend; npm run dev
cd d:\myProject\CNOOC-demo\backend; python app.py
