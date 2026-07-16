/**
 * 统一 API 客户端 —— 与 Flask 后端通信
 *
 * 所有 API 调用通过 nginx 代理到 Flask 后端 (/api/...)
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
  // getMockConversations,
  // createMockConversation,
  // updateMockConversation,
  // deleteMockConversation,
  deleteMockConversationBySessionId,
  getMockMessages,
  // addMockMessage,
  getMockUserSettings,
  updateMockUserSettings,
  mockDelay,
} from "../mock/config"
import { ApiError, request } from "../http/client"
import { getToken, getClientId } from "../auth/token"
import { API_BASE_URL } from "../http/routes"

export { ApiError } from "../http/client"
export { getToken, setToken, removeToken, isAuthenticated } from "../auth/token"

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

export async function guestLoginApi(data: LoginRequest): Promise<LoginResponse> {
    console.log("🚀 ~ guestLoginApi ~ data: ", data);
  if (isMockMode()) {
    await mockDelay()
    const result = mockLogin(data.username, data.password)
    return result
  }
  return request<LoginResponse>("POST", "/h5/auth/autoLogin", {
    ...data,
    "clientId": "0d4c873ff6146ecd7f38e2e45526ab1b",
  })
}

export async function login(data: LoginRequest): Promise<LoginResponse> {
  if (isMockMode()) {
    await mockDelay()
    const result = mockLogin(data.username, data.password)
    return result
  }
  return request<LoginResponse>("POST", "/auth/login", {
    ...data,
    "clientId": "0d4c873ff6146ecd7f38e2e45526ab1b",
    "grantType": "password",
    "tenantId": "000000",
    "uuid": `${new Date().getTime()}`,
  })
}
export async function logout(): Promise<LogoutResponse> {
  // if (isMockMode()) {
  //   await mockDelay()
  //   // Mock 模式下注册直接返回 admin 用户
  //   return { token: "mock-jwt-token-admin-1234567890", user: getMockUser() }
  // }
  return request<LogoutResponse>("POST", "/auth/logout", {})
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
  // if (isMockMode()) {
  //   await mockDelay()
  //   return getMockAgentsWithConfigs()
  // }
  return request<AgentsListResponse>("POST", "/manage/difyApp/app/list?pageNum=1&pageSize=20")
}

/* ───── Conversations API ───── */

export interface ConversationApi {
  // id: number
  // user_id: number
  // agent_id: number
  // agent_id_str: string
  // title: string
  // dify_conversation_id: string
  // is_pinned: boolean
  // is_archived: boolean
  // last_message_at: string
  // created_at: string
  // message_count: number
  // messages?: MessageApi[]
  id: number
  messageId: string
  appId: string
  sessionId: string
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
// {
//     "messageId": "123456",
//     "appId": "6c744963-3485-409c-971c-29ea1efe842e",
//     "sessionId": "123456789",
//     "title": "test",
//     "query": "测试问题",
//     "type": "分类",
//     "messageType": "text",
//     "answer": "测试回答返回内容",
//     "agentName": "会议助手-会话记忆",
//     "status": "1",
//     "totalTokens": 1200,
//     "createTime": 1783481971000
// }

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
  // if (isMockMode()) {
  //   await mockDelay()
  //   return getMockConversations(params)
  // }
  const pageNum = params?.pageNum ?? params?.page ?? 1
  const pageSize = params?.pageSize ?? params?.per_page ?? 10
  return request<ConversationsListResponse>(
    "POST",
    `/h5/chat/messages/page?pageNum=${pageNum}&pageSize=${pageSize}`,
  )
}

// 已废弃：旧 /conversations 接口不再使用（会话由 /h5/chat/* 管理）
// export async function createConversation(data: {
//   agent_id: number
//   title?: string
// }): Promise<{ conversation: ConversationApi }> {
//   if (isMockMode()) {
//     await mockDelay()
//     return createMockConversation(data)
//   }
//   return request<{ conversation: ConversationApi }>("POST", "/conversations", data)
// }

// export async function getConversation(
//   convId: number,
// ): Promise<{ conversation: ConversationApi }> {
//   if (isMockMode()) {
//     await mockDelay()
//     const res = getMockConversations()
//     const conv = res.conversations.find((c) => c.id === convId)
//     if (!conv) throw new ApiError("Mock: 对话不存在", 404)
//     return { conversation: conv }
//   }
//   return request<{ conversation: ConversationApi }>("GET", `/conversations/${convId}`)
// }

// export async function updateConversation(
//   convId: number,
//   data: { title?: string; is_pinned?: boolean; is_archived?: boolean },
// ): Promise<{ conversation: ConversationApi }> {
//   if (isMockMode()) {
//     await mockDelay()
//     return updateMockConversation(convId, data)
//   }
//   return request<{ conversation: ConversationApi }>("PUT", `/conversations/${convId}`, data)
// }

export async function deleteConversationApi(sessionId: string): Promise<{ message: string }> {
  if (isMockMode()) {
    await mockDelay()
    return deleteMockConversationBySessionId(sessionId)
  }
  return request<{ message: string }>("POST", `/h5/chat/messages/del?sessionId=${encodeURIComponent(sessionId)}`)
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

/** 单文件上传：POST /h5/file/upload/single，form field = files */
export async function uploadFileSingle(file: File): Promise<any> {
  const token = getToken()
  if (!token) {
    throw new Error("未登录，无法上传文件")
  }

  const formData = new FormData()
  formData.append("file", file)

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    clientid: getClientId() || "0d4c873ff6146ecd7f38e2e45526ab1b",
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60000)

  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}/h5/file/upload/single`, {
      method: "POST",
      headers,
      body: formData,
      signal: controller.signal,
    })
  } catch (err: unknown) {
    clearTimeout(timeoutId)
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("上传超时，请稍后重试")
    }
    throw new Error(err instanceof Error ? err.message : "上传失败")
  }
  clearTimeout(timeoutId)

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText)
    throw new Error(`上传失败 (${res.status}): ${errText}`)
  }

  const contentType = res.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    return res.json()
  }
  return res.text()
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
  sessionId: string,
): Promise<MessagesListResponse> {
  // if (isMockMode()) {
  //   await mockDelay()
  //   return getMockMessages(sessionId)
  // }
  // const qs = new URLSearchParams()
  // if (params?.page) qs.set("page", String(params.page))
  // if (params?.per_page) qs.set("per_page", String(params.per_page))
  // if (params?.before_id) qs.set("before_id", String(params.before_id))
  // const query = qs.toString()
  return request<MessagesListResponse>("POST", `/h5/chat/messages?sessionId=${sessionId}`)
}

// 已废弃：旧 /conversations/:id/messages 接口不再使用
// export async function addMessage(
//   convId: number,
//   data: {
//     role: string
//     content: string
//     attachments?: string
//     metadata?: string
//     dify_message_id?: string
//     is_error?: boolean
//   },
// ): Promise<{ message: MessageApi }> {
//   if (isMockMode()) {
//     await mockDelay()
//     return addMockMessage(convId, data)
//   }
//   return request<{ message: MessageApi }>("POST", `/conversations/${convId}/messages`, data)
// }

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
  if (!url) return "https://api.dify.ai/v1"
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
