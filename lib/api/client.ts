/**
 * 统一 API 客户端 —— 与后端通信
 *
 * 所有 API 调用通过 nginx 代理到后端 (/api/...)
 * JWT 令牌存储在 localStorage，自动附加到请求头
 *
 * Mock 模式下所有请求走 localStorage，不依赖后端。
 * 开启方式：访问 /login?mock=true
 */

import {
  isMockMode,
  mockLogin,
  getMockUser,
  getMockAgentsWithConfigs,
  createMockAgent,
  updateMockAgent,
  deleteMockAgent,
  getMockDifyConfigs,
  createMockDifyConfig,
  updateMockDifyConfig,
  deleteMockDifyConfig,
  deleteMockConversationBySessionId,
  getMockMessages,
  getMockUserSettings,
  updateMockUserSettings,
  mockDelay,
} from "../mock/config"
import { ApiError, request } from "../http/client"
import {getToken, getClientId, setToken, setCachedUser, setClientId} from "../auth/token"
import { API_BASE_URL } from "../http/routes"
import { DEFAULT_CLIENT_ID, DEFAULT_DIFY_BASE_URL } from "../config"
import getDeviceId from "@/app/utils/fingerprintjs";
import {isLoginSuccess} from "@/lib/auth";
import { deobfuscateSm2PublicKey, encryptPasswordBySm2 } from "../auth/sm2"

export { ApiError } from "../http/client"

/* ───── Auth API ───── */

export interface LoginRequest {
  username: string
  password: string
}

export interface RegisterRequest {
  username: string
  password: string
  email?: string
  display_name?: string
}

export interface UserInfo {
  id: number
  username: string
  display_name: string
  email: string
  is_active: boolean
  roles?: string[]
  created_at: string
}

export interface LoginData {
  token?: string
  access_token?: string
  client_id?: string
  user: UserInfo
}
export interface LoginResponse {
  code?: number | string
  msg?: string
  data: LoginData
}
export interface logoutData {
  code: string
  msg: string
}
export interface LogoutResponse {
  data: logoutData
}

export async function guestLoginApi(data?: LoginRequest): Promise<LoginResponse> {
  if (isMockMode()) {
    await mockDelay()
    const result = mockLogin(data.username, data.password)
    return result
  }
  return request<LoginResponse>("POST", "/h5/auth/autoLogin", {
    ...data,
    "clientId": DEFAULT_CLIENT_ID,
  })
}

export async function guestLoginFunc(): Promise<UserInfo> {
  const res = await guestLoginApi({
    token: getToken(),
    guestId: await getDeviceId(),
  })

  const accessToken = res?.data?.access_token || res?.data?.token
  const nextUser = res?.data?.user

  if (accessToken && nextUser && isLoginSuccess(res?.code)) {
    setToken(accessToken)
    setCachedUser(nextUser)
    if (res?.data?.client_id) {
      setClientId(res.data.client_id)
    }
    return nextUser
  }
  throw new Error((res as { msg?: string })?.msg || "游客登录失败！！！")
}

/**
 * 获取并解混淆 SM2 公钥。
 * 接口约定：code=200 时混淆公钥在 msg（也兼容 data / data.publicKey）
 */
export async function getSm2PublicKey(): Promise<string> {
  const res = await request<{
    code?: number | string
    msg?: string
    data?: string | { publicKey?: string }
  }>("GET", "/auth/getSm2PublicKey")

  if (!isLoginSuccess(res?.code)) {
    throw new Error(
      typeof res?.msg === "string" && res.msg.trim() && res.msg.length < 80
        ? res.msg
        : "获取 SM2 公钥失败",
    )
  }

  let obfuscated = ""
  if (typeof res?.data === "string" && res.data.trim()) {
    obfuscated = res.data.trim()
  } else if (res?.data && typeof res.data === "object" && typeof res.data.publicKey === "string") {
    obfuscated = res.data.publicKey.trim()
  } else if (typeof res?.msg === "string" && res.msg.trim()) {
    obfuscated = res.msg.trim()
  }

  if (!obfuscated) {
    throw new Error("SM2 公钥为空")
  }

  return deobfuscateSm2PublicKey(obfuscated)
}

export async function login(data: LoginRequest): Promise<LoginResponse> {
  if (isMockMode()) {
    await mockDelay()
    const result = mockLogin(data.username, data.password)
    return result
  }

  const publicKey = await getSm2PublicKey()
  const encryptedPassword = encryptPasswordBySm2(data.password, publicKey)

  return request<LoginResponse>("POST", "/h5/auth/login", {
    ...data,
    password: encryptedPassword,
    "clientId": DEFAULT_CLIENT_ID,
    "grantType": "password",
    "tenantId": "000000",
    "uuid": `${new Date().getTime()}`,
  })
}
export async function logout(): Promise<LogoutResponse> {
  return request<LogoutResponse>("POST", "/h5/auth/logout", {})
}

export async function register(data: RegisterRequest): Promise<LoginResponse> {
  if (isMockMode()) {
    await mockDelay()
    // Mock 模式下注册直接返回 admin 用户
    return { token: "mock-jwt-token-admin-1234567890", user: getMockUser() }
  }
  return request<LoginResponse>("POST", "/auth/register", data)
}

export async function getMe(): Promise<{ user: UserInfo }> {
  if (isMockMode()) {
    await mockDelay()
    return { user: getMockUser() }
  }
  const res = await request<any>("GET", "/auth/me")
  // 兼容多种后端返回结构
  const user = res?.user ?? res?.data?.user ?? res?.data
  if (!user || typeof user !== "object") {
    throw new Error("无法解析当前用户信息")
  }
  return { user: user as UserInfo }
}

/* ───── Agents API ───── */

export interface AgentDefApi {
  id: string | number
  agent_id?: string
  label?: string
  appName?: string
  icon?: string
  desc?: string
  appDesc?: string
  appType?: string
  quick_questions?: string[]
  gradient?: string
  sort_order?: number
  is_active?: boolean
  status?: string | number | boolean
  dify_configs?: DifyConfigApi[]
  difyAppId?: string
  appUrl?: string
  visible?: string
  /** "1" 表示展示思考/工作流进度 */
  thinkShow?: string | number
  createTime?: string
}

export interface DifyConfigApi {
  id: number
  agent_id: number
  env_label: string
  dify_api_key: string
  dify_base_url: string
  is_default: boolean
}

export interface AgentsListResponse {
  agents?: AgentDefApi[]
  rows?: AgentDefApi[]
  total?: number
  code?: number
  msg?: string
}

export async function getAgents(): Promise<AgentsListResponse> {
  return request<AgentsListResponse>("POST", "/manage/difyApp/app/list?pageNum=1&pageSize=20")
}

/* ───── Conversations API ───── */

export interface ConversationApi {
  id: number
  messageId: string
  appId: string
  sessionId: string
  localSessionId?: string
  title: string;
  query: string
  type: string
  messageType: string
  answer: string
  agentName: string
  status: string
  totalTokens: number
  createTime: number
}

export interface ConversationsListResponse {
  data?: {
    rows?: ConversationApi[]
    total?: number
  }
  conversations?: ConversationApi[]
  total?: number
  page?: number
  per_page?: number
  pages?: number
}

export interface InputFileItem {
  fileName?: string
  fileUrl?: string
  fileType?: string
  ossId?: string | number
  size?: number
}

export interface MessageApi {
  messageId: string
  role: "user" | "assistant" | "system"
  messageType: string
  query: string
  inputFileList?: InputFileItem[]
  answer: string
  outputFileList?: InputFileItem[]
  queryTokens: number
  answerTokens: number
  totalTokens: number
  status: string
  createTime: string
  retrieverResources: string
  rating?: "like" | "dislike" | null | string
}

export interface MessagesListResponse {
  messages: MessageApi[]
  total: number
  page: number
  has_more: boolean
}

export async function getConversations(params?: {
  agent_id?: number
  pageNum?: number
  pageSize?: number
  page?: number
  per_page?: number
}): Promise<ConversationsListResponse> {
  const pageNum = params?.pageNum ?? params?.page ?? 1
  const pageSize = params?.pageSize ?? params?.per_page ?? 10
  return request<ConversationsListResponse>(
    "POST",
    `/h5/chat/messages/page?pageNum=${pageNum}&pageSize=${pageSize}`,
  )
}


export async function deleteConversationApi(localSessionId: string): Promise<{ message: string }> {
  if (isMockMode()) {
    await mockDelay()
    return deleteMockConversationBySessionId(localSessionId)
  }
  const res = await request<{
    message?: string
    msg?: string
    code?: number | string
  }>("POST", `/h5/chat/messages/del?localSessionId=${encodeURIComponent(localSessionId)}`)

  const code = res?.code
  if (code != null && String(code) !== "200") {
    throw new Error(
      (typeof res.msg === "string" && res.msg.trim()) ||
        (typeof res.message === "string" && res.message.trim()) ||
        "删除失败",
    )
  }
  return { message: res?.msg || res?.message || "已删除" }
}

/** 重命名会话：POST /h5/chat/messages/rename */
export async function renameConversationApi(
  localSessionId: string,
  title: string,
): Promise<{ message?: string; code?: number | string }> {
  return request("POST", "/h5/chat/messages/rename", { localSessionId, title })
}

/** 从单文件上传响应中提取 ossId */
export function extractOssIdFromUpload(res: unknown): string | number | null {
  if (!res || typeof res !== "object") return null
  const obj = res as Record<string, any>
  const raw = obj?.data?.ossId ?? obj?.ossId ?? obj?.data?.data?.ossId
  if (raw == null || raw === "") return null
  if (typeof raw === "number") return raw
  const asNum = Number(raw)
  if (typeof raw === "string" && Number.isFinite(asNum) && String(asNum) === raw.trim()) {
    return asNum
  }
  return raw as string | number
}

/** 从单文件上传响应中提取可预览/下载的 url */
export function extractUrlFromUpload(res: unknown): string | null {
  if (!res || typeof res !== "object") return null
  const obj = res as Record<string, any>
  const raw =
    obj?.data?.url ??
    obj?.data?.fileUrl ??
    obj?.url ??
    obj?.fileUrl ??
    obj?.data?.data?.url
  if (typeof raw !== "string") return null
  const url = raw.trim()
  return url || null
}

/** 单文件上传：POST /h5/file/upload/single；支持进度回调 */
export async function uploadFileSingle(
  file: File,
  options?: {
    onProgress?: (percent: number) => void
    signal?: AbortSignal
  },
): Promise<any> {
  const token = getToken()
  if (!token) {
    throw new Error("未登录，无法上传文件")
  }

  const formData = new FormData()
  formData.append("file", file)

  const clientid = getClientId() || DEFAULT_CLIENT_ID

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", `${API_BASE_URL}/h5/file/upload/single`)
    xhr.setRequestHeader("Authorization", `Bearer ${token}`)
    xhr.setRequestHeader("clientid", clientid)
    xhr.timeout = 60000

    const onAbort = () => {
      xhr.abort()
    }
    if (options?.signal) {
      if (options.signal.aborted) {
        reject(new Error("上传已取消"))
        return
      }
      options.signal.addEventListener("abort", onAbort, { once: true })
    }

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      const percent = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)))
      options?.onProgress?.(percent)
    }

    xhr.onload = () => {
      options?.signal?.removeEventListener("abort", onAbort)
      if (xhr.status >= 200 && xhr.status < 300) {
        options?.onProgress?.(100)
        const contentType = xhr.getResponseHeader("content-type") || ""
        if (contentType.includes("application/json")) {
          try {
            resolve(JSON.parse(xhr.responseText || "{}"))
          } catch {
            reject(new Error("上传响应解析失败"))
          }
          return
        }
        resolve(xhr.responseText)
        return
      }
      reject(new Error(`上传失败 (${xhr.status}): ${xhr.responseText || xhr.statusText}`))
    }

    xhr.onerror = () => {
      options?.signal?.removeEventListener("abort", onAbort)
      reject(new Error("上传失败"))
    }

    xhr.ontimeout = () => {
      options?.signal?.removeEventListener("abort", onAbort)
      reject(new Error("上传超时，请稍后重试"))
    }

    xhr.onabort = () => {
      options?.signal?.removeEventListener("abort", onAbort)
      reject(new Error("上传已取消"))
    }

    options?.onProgress?.(0)
    xhr.send(formData)
  })
}

export async function submitMessageFeedback(data: {
  agentId: string
  messageId: string
  userId: number
  rating?: "like" | "dislike" | null
  /** 选中的理由标签，逗号拼接，如 "回答不准确,完成任务能力强" */
  tags?: string
  /** 用户自由输入的反馈文案 */
  content?: string
}): Promise<{ code?: number; msg?: string }> {
  if (isMockMode()) {
    await mockDelay()
    return { code: 200, msg: "操作成功" }
  }
  return request<{ code?: number; msg?: string }>("POST", "/h5/chat/feedback", data)
}

export async function getMessages(
  localSessionId: string,
): Promise<MessagesListResponse> {
  return request<MessagesListResponse>(
    "POST",
    `/h5/chat/messages?localSessionId=${encodeURIComponent(localSessionId)}`,
  )
}


/* ───── Settings API ───── */

export async function getUserSettings(): Promise<{ settings: Record<string, unknown> }> {
  if (isMockMode()) {
    await mockDelay()
    return getMockUserSettings()
  }
  return request<{ settings: Record<string, unknown> }>("GET", "/settings")
}

export async function updateUserSettings(data: Record<string, unknown>): Promise<{ settings: Record<string, unknown> }> {
  if (isMockMode()) {
    await mockDelay()
    return updateMockUserSettings(data)
  }
  return request<{ settings: Record<string, unknown> }>("PUT", "/settings", data)
}

/* ───── Agent CRUD（管理员用） ───── */

export interface CreateAgentRequest {
  agent_id: string
  label: string
  icon?: string
  desc?: string
  quick_questions?: string[]
  gradient?: string
  sort_order?: number
  is_active?: boolean
  dify_config?: {
    env_label?: string
    dify_api_key: string
    dify_base_url?: string
  }
}

export interface UpdateAgentRequest {
  label?: string
  icon?: string
  desc?: string
  quick_questions?: string[]
  gradient?: string
  sort_order?: number
  is_active?: boolean
  dify_config?: {
    env_label?: string
    dify_api_key?: string
    dify_base_url?: string
  }
}

export async function createAgent(data: CreateAgentRequest): Promise<{ agent: AgentDefApi }> {
  if (isMockMode()) {
    await mockDelay()
    return createMockAgent(data)
  }
  return request<{ agent: AgentDefApi }>("POST", "/agents", data)
}

export async function updateAgent(agentId: number, data: UpdateAgentRequest): Promise<{ agent: AgentDefApi }> {
  if (isMockMode()) {
    await mockDelay()
    return updateMockAgent(agentId, data)
  }
  return request<{ agent: AgentDefApi }>("PUT", `/agents/${agentId}`, data)
}

export async function deleteAgent(agentId: number): Promise<{ message: string }> {
  if (isMockMode()) {
    await mockDelay()
    return deleteMockAgent(agentId)
  }
  return request<{ message: string }>("DELETE", `/agents/${agentId}`)
}

export async function reorderAgents(agentIds: number[]): Promise<{ message: string }> {
  if (isMockMode()) {
    await mockDelay()
    // Mock 模式下暂不实现复杂的排序逻辑，仅返回成功
    return { message: "排序更新成功" }
  }
  return request<{ message: string }>("PUT", `/agents/reorder`, { agent_ids: agentIds })
}

/* ───── Dify Config CRUD（管理用） ───── */

export interface CreateDifyConfigRequest {
  env_label?: string
  dify_api_key: string
  dify_base_url?: string
  is_default?: boolean
}

export interface UpdateDifyConfigRequest {
  env_label?: string
  dify_api_key?: string
  dify_base_url?: string
  is_default?: boolean
}

export async function getDifyConfigs(agentId: number): Promise<{ dify_configs: DifyConfigApi[] }> {
  if (isMockMode()) {
    await mockDelay()
    return getMockDifyConfigs(agentId)
  }
  return request<{ dify_configs: DifyConfigApi[] }>("GET", `/agents/${agentId}/dify-configs`)
}

export async function createDifyConfig(agentId: number, data: CreateDifyConfigRequest): Promise<{ dify_config: DifyConfigApi }> {
  if (isMockMode()) {
    await mockDelay()
    return createMockDifyConfig(agentId, data)
  }
  return request<{ dify_config: DifyConfigApi }>("POST", `/agents/${agentId}/dify-configs`, data)
}

export async function updateDifyConfig(configId: number, data: UpdateDifyConfigRequest): Promise<{ dify_config: DifyConfigApi }> {
  if (isMockMode()) {
    await mockDelay()
    return updateMockDifyConfig(configId, data)
  }
  return request<{ dify_config: DifyConfigApi }>("PUT", `/agents/dify-configs/${configId}`, data)
}

export async function deleteDifyConfig(configId: number): Promise<{ message: string }> {
  if (isMockMode()) {
    await mockDelay()
    return deleteMockDifyConfig(configId)
  }
  return request<{ message: string }>("DELETE", `/agents/dify-configs/${configId}`)
}

/* ───── Dify 连通性校验 ───── */

export interface TestConnectionResult {
  ok: boolean
  error?: string
}

/** 规范化 Dify Base URL，自动补全 /v1 */
function normalizeDifyBaseUrl(baseUrl?: string): string {
  let url = (baseUrl || "").trim()
  if (!url) return DEFAULT_DIFY_BASE_URL
  url = url.replace(/\/+$/, "")
  if (!url.endsWith("/v1")) {
    if (url.includes("/v1")) {
      url = url.slice(0, url.indexOf("/v1") + 3)
    } else {
      url += "/v1"
    }
  }
  return url
}

/**
 * Mock 模式下直接从浏览器请求 Dify `/v1/parameters` 校验连通性
 * 不经过后端，API Key 仅在本次校验中临时使用
 */
async function directTestDifyConnection(data: {
  dify_api_key: string
  dify_base_url?: string
}): Promise<TestConnectionResult> {
  const apiKey = data.dify_api_key.trim()
  if (!apiKey) return { ok: false, error: "缺少 API Key" }
  if (apiKey.includes("****")) return { ok: false, error: "请重新填写 API Key（当前为脱敏值）" }

  const baseUrl = normalizeDifyBaseUrl(data.dify_base_url)
  const testUrl = `${baseUrl}/parameters`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const resp = await fetch(testUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    })
    if (resp.ok) return { ok: true }

    let errMsg = `HTTP ${resp.status}`
    try {
      const errData = await resp.json()
      errMsg = errData.message || errData.error || errMsg
    } catch {
      const text = await resp.text().catch(() => "")
      if (text) errMsg = text.slice(0, 200)
    }
    return { ok: false, error: errMsg }
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, error: "请求 Dify 超时" }
    }
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `连接失败: ${msg}` }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 测试 Dify API Key + Base URL 是否可用
 * - Mock 模式：浏览器直连 Dify
 * - 普通模式：通过后端代理校验
 */
export async function testDifyConnection(data: {
  dify_api_key: string
  dify_base_url?: string
}): Promise<TestConnectionResult> {
  if (isMockMode()) {
    return directTestDifyConnection(data)
  }
  return request<TestConnectionResult>("POST", "/agents/dify-configs/test-connection", data)
}
