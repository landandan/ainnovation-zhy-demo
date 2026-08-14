/**
 * 集中管理项目运行期配置。
 *
 * - 客户端可访问的配置统一使用 `NEXT_PUBLIC_` 前缀（Next.js 会在构建时内联到前端包）。
 * - 本文件中的默认值与改造前 src 中硬编码的取值保持一致，保证行为不变。
 * - 实际取值来自项目根目录的 `.env`，模板见 `.env.example`。
 */

const isDev = process.env.NODE_ENV !== "production"

/** 读取环境变量，空值回退到默认值 */
function readEnv(key: string, fallback: string): string {
  const value = process.env[key]
  return value && value.length > 0 ? value : fallback
}

/* ───────────────────────── 后端服务地址 ───────────────────────── */

/** 开发模式主后端 API 地址（前端直连，不走 nginx 代理） */
export const DEV_API_BASE_URL = readEnv(
  "NEXT_PUBLIC_DEV_API_BASE_URL",
  "http://192.168.10.168:26039",
)

/** 开发模式文件服务地址（Flask 后端，用于附件上传/下载直连） */
export const DEV_FILE_API_BASE_URL = readEnv(
  "NEXT_PUBLIC_DEV_FILE_API_BASE_URL",
  "http://localhost:5000/api",
)

/** 生产模式 API 前缀（由部署环境的 nginx/网关转发） */
export const PROD_API_BASE_URL = "/api"

/* ───────────── 对外导出的 API 基址（按环境切换） ───────────── */

export const API_BASE_URL = isDev ? DEV_API_BASE_URL : PROD_API_BASE_URL
export const DIFY_FILE_UPLOAD_BASE_URL = isDev
  ? DEV_FILE_API_BASE_URL
  : PROD_API_BASE_URL
export const DIFY_STOP_PROXY_BASE_URL = PROD_API_BASE_URL

/* ───────────── Dify / 鉴权相关默认值 ───────────── */

/** Mock / 设置页默认 Dify base url */
export const DEFAULT_DIFY_BASE_URL = readEnv(
  "NEXT_PUBLIC_DEFAULT_DIFY_BASE_URL",
  "https://api.dify.ai/v1",
)

/** Dify 客户端默认 userId（用户未传入时使用） */
export const DIFY_DEFAULT_USER_ID = readEnv(
  "NEXT_PUBLIC_DIFY_DEFAULT_USER_ID",
  "192.168.11.30",
)

/** 未登录/游客请求携带的默认 clientId */
export const DEFAULT_CLIENT_ID = readEnv(
  "NEXT_PUBLIC_DEFAULT_CLIENT_ID",
  "0d4c873ff6146ecd7f38e2e45526ab1b",
)
