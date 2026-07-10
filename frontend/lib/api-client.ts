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
  getMockConversations,
  createMockConversation,
  updateMockConversation,
  deleteMockConversation,
  getMockMessages,
  addMockMessage,
  getMockUserSettings,
  updateMockUserSettings,
  mockDelay,
} from "./mock-config"

/* ───── Token 管理 ───── */

const TOKEN_KEY = "cnooc-auth-token"

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(TOKEN_KEY, token)
}

export function removeToken(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(TOKEN_KEY)
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

/* ───── 基础请求封装 ───── */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

/** 全局标志：防止多个并行请求同时触发 401 跳转 */
let authRedirectInProgress = false

// 在开发环境下，直接请求后端 5000 端口以绕过 Next.js 代理的缓冲问题
const API_BASE_URL = process.env.NODE_ENV === 'development' ? 'http://192.168.11.95:6039' : '/api'//? 'http://localhost:5000/api' : '/api'

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: { suppressErrors?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  const token = getToken()
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  // 为每个 REST 请求添加 15 秒超时，防止后端不可达时无限挂起
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch (err: unknown) {
    clearTimeout(timeoutId)
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError("请求超时（15秒），请检查网络或后端服务是否正常", 408)
    }
    throw new ApiError(err instanceof Error ? err.message : "网络请求失败", 0)
  }
  clearTimeout(timeoutId)

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: res.statusText }))
    // 401/403 → token 失效，清除登录态并跳转登录页
    // 使用全局标志防止多个并行请求重复跳转
    if (res.status === 401 || res.status === 403) {
      removeToken()
      if (typeof window !== "undefined" && !authRedirectInProgress) {
        authRedirectInProgress = true
        // 短暂延迟确保跳转不被其他后续代码中断
        setTimeout(() => {
          window.location.href = "/login"
        }, 100)
      }
    }
    if (!options.suppressErrors) {
      throw new ApiError(errData.error || "请求失败", res.status, errData)
    }
    return null as T
  }

  return res.json() as Promise<T>
}

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
  // user: UserInfo
  access_token: string
  client_id: string
  user: UserInfo
}
export interface LoginResponse {
  data: LoginData
}
export interface logoutData {
  code: string
  msg: string
}
export interface LogoutResponse {
  data: logoutData
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
  return request<{ user: UserInfo }>("GET", "/auth/me")
}

/* ───── Agents API ───── */

export interface AgentDefApi {
  id: number
  agent_id: string
  label: string
  icon: string
  desc: string
  quick_questions: string[]
  gradient: string
  sort_order: number
  is_active: boolean
  dify_configs?: DifyConfigApi[]
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
  agents: AgentDefApi[]
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
  conversations: ConversationApi[]
  total: number
  page: number
  per_page: number
  pages: number
}

export interface MessageApi {
  messageId: string
  role: "user" | "assistant" | "system"
  messageType: string
  query: string
  inputFileList: unknown[]
  answer: string
  outputFileList: unknown[]
  queryTokens: number
  answerTokens: number
  totalTokens: number
  status: string
  createTime: string
  // id: number
  // conversation_id: number
  // role: "user" | "assistant" | "system"
  // content: string
  // attachments: unknown[]
  // metadata: Record<string, unknown>
  // dify_message_id: string
  // is_error: boolean
  // created_at: string
}

export interface MessagesListResponse {
  messages: MessageApi[]
  total: number
  page: number
  has_more: boolean
}

export async function getConversations(params?: {
  agent_id?: number
  page?: number
  per_page?: number
}): Promise<ConversationsListResponse> {
  if (isMockMode()) {
    await mockDelay()
    return getMockConversations(params)
  }
  const qs = new URLSearchParams()
  if (params?.agent_id) qs.set("agent_id", String(params.agent_id))
  if (params?.page) qs.set("page", String(params.page))
  if (params?.per_page) qs.set("per_page", String(params.per_page))
  const query = qs.toString()
  return request<ConversationsListResponse>("POST", `/h5/chat/messages/page?pageNum=1&pageSize=10`)
  // return request<ConversationsListResponse>("GET", `/conversations${query ? `?${query}` : ""}`)
}

export async function createConversation(data: {
  agent_id: number
  title?: string
}): Promise<{ conversation: ConversationApi }> {
  if (isMockMode()) {
    await mockDelay()
    return createMockConversation(data)
  }
  return request<{ conversation: ConversationApi }>("POST", "/conversations", data)
}

export async function getConversation(
  convId: number,
): Promise<{ conversation: ConversationApi }> {
  if (isMockMode()) {
    await mockDelay()
    const res = getMockConversations()
    const conv = res.conversations.find((c) => c.id === convId)
    if (!conv) throw new ApiError("Mock: 对话不存在", 404)
    return { conversation: conv }
  }
  return request<{ conversation: ConversationApi }>("GET", `/conversations/${convId}`)
}

export async function updateConversation(
  convId: number,
  data: { title?: string; is_pinned?: boolean; is_archived?: boolean },
): Promise<{ conversation: ConversationApi }> {
  if (isMockMode()) {
    await mockDelay()
    return updateMockConversation(convId, data)
  }
  return request<{ conversation: ConversationApi }>("PUT", `/conversations/${convId}`, data)
}

export async function deleteConversationApi(convId: number): Promise<{ message: string }> {
  if (isMockMode()) {
    await mockDelay()
    return deleteMockConversation(convId)
  }
  return request<{ message: string }>("DELETE", `/conversations/${convId}`)
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

export async function addMessage(
  convId: number,
  data: {
    role: string
    content: string
    attachments?: string
    metadata?: string
    dify_message_id?: string
    is_error?: boolean
  },
): Promise<{ message: MessageApi }> {
  if (isMockMode()) {
    await mockDelay()
    return addMockMessage(convId, data)
  }
  return request<{ message: MessageApi }>("POST", `/conversations/${convId}/messages`, data)
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
