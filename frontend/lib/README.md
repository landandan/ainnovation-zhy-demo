# lib 目录约定

`lib` 根目录只保留兼容入口，业务实现按职责放到子目录中：

- `api/`: 后端业务接口定义与调用。
- `auth/`: 登录态 Provider 与 token 存取。
- `dify/`: Dify 流式会话、上传、停止任务等代理调用。
- `http/`: 通用请求封装、超时、401/403 处理和后端路由常量。
- `mock/`: Mock 模式配置和模拟响应。
- `storage/`: 浏览器本地缓存。
- `workflow/`: 工作流进度状态模型与事件处理。
- `ui/`: UI 通用工具。

旧路径如 `@/lib/api-client`、`@/lib/dify-api`、`@/lib/auth-store` 会继续 re-export
新实现，避免页面层一次性大规模改 import。

