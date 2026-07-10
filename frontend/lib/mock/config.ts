/**
 * Mock 模式配置中心
 *
 * 通过 URL 参数 ?mock=true 开启 mock 模式，无需后端即可使用完整功能。
 * 所有 agent / dify config / conversation / message 数据持久化到 localStorage，
 * 刷新页面不丢失；正常登录后会自动清除所有 mock 残留数据。
 *
 * Mock 默认账号：admin / admin123
 */

import type {
  UserInfo,
  AgentDefApi,
  DifyConfigApi,
  ConversationApi,
  MessageApi,
  CreateAgentRequest,
  CreateDifyConfigRequest,
  UpdateDifyConfigRequest,
  UpdateAgentRequest,
} from "../api/client"

/* ───── 开关控制（基于 sessionStorage） ───── */

const MOCK_FLAG_KEY = "cnooc-mock-mode"

export function isMockMode(): boolean {
  if (typeof window === "undefined") return false
  return sessionStorage.getItem(MOCK_FLAG_KEY) === "true"
}

export function enableMockMode(): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(MOCK_FLAG_KEY, "true")
}

export function disableMockMode(): void {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(MOCK_FLAG_KEY)
}

/* ───── Mock 默认用户 ───── */

const MOCK_TOKEN = "mock-jwt-token-admin-1234567890"

export function getMockToken(): string {
  return MOCK_TOKEN
}

export function getMockUser(): UserInfo {
  return {
    id: 0,
    username: "admin",
    display_name: "管理员 (Mock)",
    email: "admin@mock.local",
    is_active: true,
    roles: ["admin"],
    created_at: new Date().toISOString(),
  }
}

/** Mock 登录校验：admin / admin123 */
export function mockLogin(username: string, password: string): { token: string; user: UserInfo } {
  if (username === "admin" && password === "admin123") {
    return { token: MOCK_TOKEN, user: getMockUser() }
  }
  throw new Error("Mock 模式：用户名或密码错误（默认 admin / admin123）")
}

/* ───── localStorage 键名 ───── */

const LS_AGENTS = "cnooc-mock-agents"
const LS_DIFY_CONFIGS = "cnooc-mock-dify-configs"
const LS_CONVERSATIONS = "cnooc-mock-conversations"
const LS_MESSAGES_PREFIX = "cnooc-mock-messages-" // + conversationId
const LS_SETTINGS = "cnooc-mock-settings"

/* ───── Mock Agent CRUD ───── */

function readAgents(): AgentDefApi[] {
  if (typeof window === "undefined") return []
  const mock = [{
    "id": 111,
    "agent_id": "oa",
    "label": "oa助手",
    "icon": "🤖",
    "desc": "自定义应用",
    "quick_questions": [],
    "gradient": "var(--gradient-1)",
    "sort_order": 0,
    "is_active": true,
    "dify_configs": []
  }]
  try {
    const raw = localStorage.getItem(LS_AGENTS)
    //return raw ? JSON.parse(raw) : []
    return raw ? [...mock, ...JSON.parse(raw)] : mock
  } catch {
    return []
  }
}

function writeAgents(agents: AgentDefApi[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(LS_AGENTS, JSON.stringify(agents))
}

export function getMockAgents(): { agents: AgentDefApi[] } {
  return { agents: readAgents() }
}

/** 返回 agent 列表，并合并对应的 dify_configs */
export function getMockAgentsWithConfigs(): { agents: AgentDefApi[] } {
  const agents = readAgents()
  const allConfigs = readDifyConfigs()

  const agentsWithConfigs = agents.map((a) => ({
    ...a,
    dify_configs: allConfigs.filter((c) => c.agent_id === a.id),
  }))

  return { agents: agentsWithConfigs }
}

export function createMockAgent(data: CreateAgentRequest): { agent: AgentDefApi } {
  const agents = readAgents()
  const newId = agents.length > 0 ? Math.max(...agents.map((a) => a.id)) + 1 : 1

  const newAgent: AgentDefApi = {
    id: newId,
    agent_id: data.agent_id,
    label: data.label,
    icon: data.icon || "🤖",
    desc: data.desc || "",
    quick_questions: data.quick_questions || [],
    gradient: data.gradient || "var(--gradient-1)",
    sort_order: data.sort_order ?? agents.length,
    is_active: data.is_active ?? true,
    dify_configs: [],
  }
  agents.push(newAgent)
  writeAgents(agents)
  return { agent: newAgent }
}

export function updateMockAgent(agentId: number, data: UpdateAgentRequest): { agent: AgentDefApi } {
  const agents = readAgents()
  const idx = agents.findIndex((a) => a.id === agentId)
  if (idx === -1) throw new Error("Mock: Agent 不存在")

  agents[idx] = {
    ...agents[idx],
    label: data.label ?? agents[idx].label,
    icon: data.icon ?? agents[idx].icon,
    desc: data.desc ?? agents[idx].desc,
    quick_questions: data.quick_questions ?? agents[idx].quick_questions,
    gradient: data.gradient ?? agents[idx].gradient,
    sort_order: data.sort_order ?? agents[idx].sort_order,
    is_active: data.is_active ?? agents[idx].is_active,
  }
  writeAgents(agents)
  return { agent: agents[idx] }
}

export function deleteMockAgent(agentId: number): { message: string } {
  const agents = readAgents().filter((a) => a.id !== agentId)
  writeAgents(agents)

  // 同步删除该 agent 的 dify 配置
  const configs = readDifyConfigs().filter((c) => c.agent_id !== agentId)
  writeDifyConfigs(configs)

  // 同步删除该 agent 的对话和消息
  const conversations = readConversations().filter((c) => c.agent_id !== agentId)
  writeConversations(conversations)

  return { message: "已删除" }
}

/* ───── Mock Dify Config CRUD ───── */

function readDifyConfigs(): DifyConfigApi[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(LS_DIFY_CONFIGS)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeDifyConfigs(configs: DifyConfigApi[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(LS_DIFY_CONFIGS, JSON.stringify(configs))
}

export function getMockDifyConfigs(agentId: number): { dify_configs: DifyConfigApi[] } {
  const configs = readDifyConfigs().filter((c) => c.agent_id === agentId)
  return { dify_configs: configs }
}

export function createMockDifyConfig(
  agentId: number,
  data: CreateDifyConfigRequest,
): { dify_config: DifyConfigApi } {
  const configs = readDifyConfigs()
  const newId = configs.length > 0 ? Math.max(...configs.map((c) => c.id)) + 1 : 1

  // 如果设为默认，取消该 agent 其他默认配置
  let finalConfigs = configs
  if (data.is_default) {
    finalConfigs = configs.map((c) => (c.agent_id === agentId ? { ...c, is_default: false } : c))
  }

  const newConfig: DifyConfigApi = {
    id: newId,
    agent_id: agentId,
    env_label: data.env_label || "默认",
    dify_api_key: data.dify_api_key,
    dify_base_url: data.dify_base_url || "https://api.dify.ai/v1",
    is_default: data.is_default ?? true,
  }

  finalConfigs.push(newConfig)
  writeDifyConfigs(finalConfigs)
  return { dify_config: newConfig }
}

export function updateMockDifyConfig(
  configId: number,
  data: UpdateDifyConfigRequest,
): { dify_config: DifyConfigApi } {
  const configs = readDifyConfigs()
  const idx = configs.findIndex((c) => c.id === configId)
  if (idx === -1) throw new Error("Mock: Dify 配置不存在")

  // 如果设为默认，取消同 agent 其他默认配置
  if (data.is_default) {
    const agentId = configs[idx].agent_id
    configs.forEach((c, i) => {
      if (c.agent_id === agentId && i !== idx) {
        configs[i] = { ...c, is_default: false }
      }
    })
  }

  configs[idx] = {
    ...configs[idx],
    env_label: data.env_label ?? configs[idx].env_label,
    dify_api_key: data.dify_api_key ?? configs[idx].dify_api_key,
    dify_base_url: data.dify_base_url ?? configs[idx].dify_base_url,
    is_default: data.is_default ?? configs[idx].is_default,
  }

  writeDifyConfigs(configs)
  return { dify_config: configs[idx] }
}

export function deleteMockDifyConfig(configId: number): { message: string } {
  const configs = readDifyConfigs().filter((c) => c.id !== configId)
  writeDifyConfigs(configs)
  return { message: "已删除" }
}

/* ───── Mock Conversation CRUD ───── */

function readConversations(): ConversationApi[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(LS_CONVERSATIONS)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeConversations(conversations: ConversationApi[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(LS_CONVERSATIONS, JSON.stringify(conversations))
}

export function getMockConversations(params?: {
  agent_id?: number
  page?: number
  per_page?: number
}): {
  conversations: ConversationApi[]
  total: number
  page: number
  per_page: number
  pages: number
} {
  let conversations = readConversations()
  if (params?.agent_id) {
    conversations = conversations.filter((c) => c.agent_id === params.agent_id)
  }
  // 按 last_message_at 倒序
  conversations.sort(
    (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime(),
  )

  return {
    conversations,
    total: conversations.length,
    page: 1,
    per_page: 100,
    pages: 1,
  }
}

export function createMockConversation(data: {
  agent_id: number
  title?: string
}): { conversation: ConversationApi } {
  const conversations = readConversations()
  const now = new Date().toISOString()
  const newId = conversations.length > 0 ? Math.max(...conversations.map((c) => c.id)) + 1 : 1

  // 查找 agent_id_str
  const agents = readAgents()
  const agent = agents.find((a) => a.id === data.agent_id)
  const agentIdStr = agent?.agent_id || `agent-${data.agent_id}`

  const newConv: ConversationApi = {
    id: newId,
    user_id: 0,
    agent_id: data.agent_id,
    agent_id_str: agentIdStr,
    title: data.title || "新对话",
    dify_conversation_id: `mock-dify-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    is_pinned: false,
    is_archived: false,
    last_message_at: now,
    created_at: now,
    message_count: 0,
    sessionId: '',
  }

  conversations.push(newConv)
  writeConversations(conversations)
  return { conversation: newConv }
}

export function updateMockConversation(
  convId: number,
  data: { title?: string; is_pinned?: boolean; is_archived?: boolean },
): { conversation: ConversationApi } {
  const conversations = readConversations()
  const idx = conversations.findIndex((c) => c.id === convId)
  if (idx === -1) throw new Error("Mock: 对话不存在")

  conversations[idx] = {
    ...conversations[idx],
    title: data.title ?? conversations[idx].title,
    is_pinned: data.is_pinned ?? conversations[idx].is_pinned,
    is_archived: data.is_archived ?? conversations[idx].is_archived,
  }
  writeConversations(conversations)
  return { conversation: conversations[idx] }
}

export function deleteMockConversation(convId: number): { message: string } {
  const conversations = readConversations().filter((c) => c.id !== convId)
  writeConversations(conversations)

  // 同步删除消息
  if (typeof window !== "undefined") {
    localStorage.removeItem(LS_MESSAGES_PREFIX + convId)
  }
  return { message: "已删除" }
}

/* ───── Mock Message CRUD ───── */

function readMessages(convId: number): MessageApi[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(LS_MESSAGES_PREFIX + convId)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeMessages(convId: number, messages: MessageApi[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(LS_MESSAGES_PREFIX + convId, JSON.stringify(messages))
}

export function getMockMessages(convId: number): {
  messages: MessageApi[]
  total: number
  page: number
  has_more: boolean
} {
  const messages = readMessages(convId)
  // 按时间正序返回
  messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  return {
    messages,
    total: messages.length,
    page: 1,
    has_more: false,
  }
}

export function addMockMessage(
  convId: number,
  data: {
    role: string
    content: string
    attachments?: string
    metadata?: string
    dify_message_id?: string
    is_error?: boolean
  },
): { message: MessageApi } {
  const messages = readMessages(convId)
  const newId = messages.length > 0 ? Math.max(...messages.map((m) => m.id)) + 1 : 1

  const newMsg: MessageApi = {
    id: newId,
    conversation_id: convId,
    role: data.role as "user" | "assistant" | "system",
    content: data.content,
    attachments: data.attachments ? JSON.parse(data.attachments) : [],
    metadata: data.metadata ? JSON.parse(data.metadata) : {},
    dify_message_id: data.dify_message_id || `mock-dify-msg-${Date.now()}`,
    is_error: data.is_error ?? false,
    created_at: new Date().toISOString(),
  }

  messages.push(newMsg)
  writeMessages(convId, messages)

  // 更新对话的 last_message_at 和 message_count
  const conversations = readConversations()
  const convIdx = conversations.findIndex((c) => c.id === convId)
  if (convIdx !== -1) {
    conversations[convIdx] = {
      ...conversations[convIdx],
      last_message_at: newMsg.created_at,
      message_count: messages.length,
    }
    writeConversations(conversations)
  }

  return { message: newMsg }
}

/* ───── Mock Settings ───── */

export function getMockUserSettings(): { settings: Record<string, unknown> } {
  if (typeof window === "undefined") return { settings: {} }
  try {
    const raw = localStorage.getItem(LS_SETTINGS)
    return { settings: raw ? JSON.parse(raw) : {} }
  } catch {
    return { settings: {} }
  }
}

export function updateMockUserSettings(
  data: Record<string, unknown>,
): { settings: Record<string, unknown> } {
  if (typeof window === "undefined") return { settings: {} }
  const current = getMockUserSettings().settings
  const updated = { ...current, ...data }
  localStorage.setItem(LS_SETTINGS, JSON.stringify(updated))
  return { settings: updated }
}

/* ───── 清理所有 Mock 数据 ───── */

export function clearMockData(): void {
  if (typeof window === "undefined") return

  // 清除 mock 相关的 localStorage 数据
  localStorage.removeItem(LS_AGENTS)
  localStorage.removeItem(LS_DIFY_CONFIGS)
  localStorage.removeItem(LS_CONVERSATIONS)
  localStorage.removeItem(LS_SETTINGS)

  // 清除所有 mock 消息
  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(LS_MESSAGES_PREFIX)) {
      keysToRemove.push(key)
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key))

  // 关闭 mock 模式标志
  disableMockMode()
}

/** 模拟网络延迟 */
export function mockDelay(ms = 150): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/* ───── Mock 模式下获取 Dify API 配置（直连） ───── */

/**
 * Mock 模式下，根据 agent_id 字符串查找该 agent 的默认 Dify 配置。
 * 用于文件上传等需要直连 Dify 的场景（不走后端代理）。
 *
 * @param agentIdStr agent_id 字符串（如 "knowledge"）
 * @returns { dify_base_url, dify_api_key }
 * @throws 若 agent 或配置不存在
 */
export function getMockDifyApiConfigForAgent(agentIdStr: string): {
  dify_base_url: string
  dify_api_key: string
} {
  if (typeof window === "undefined") {
    throw new Error("Mock: 无法在服务端获取 Dify 配置")
  }

  const agents = readAgents()
  const agent = agents.find((a) => a.agent_id === agentIdStr)
  if (!agent) {
    throw new Error(`Mock: 找不到 agent_id="${agentIdStr}" 的记录，请先在设置页配置`)
  }

  const configs = readDifyConfigs().filter((c) => c.agent_id === agent.id)
  const defaultConfig = configs.find((c) => c.is_default) || configs[0]
  if (!defaultConfig) {
    throw new Error(`Mock: agent "${agentIdStr}" 未配置 Dify 连接，请先在设置页添加`)
  }

  return {
    dify_base_url: defaultConfig.dify_base_url || "https://api.dify.ai/v1",
    dify_api_key: defaultConfig.dify_api_key,
  }
}

/* ───── 生成 Mock SSE 数据流 ───── */

/**
 * 生成 Mock 的 SSE 响应流，模拟打字效果
 */
export function generateMockStream(text: string, retriever_resources: any, signal?: AbortSignal): ReadableStream<Uint8Array> {
  console.log("[DEBUG] generateMockStream 被调用，输入 text:", text.slice(0, 200), "...")
  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const chunkSize = 5 // 每次发送的字符数，模拟打字效果

      // 从文本中提取思考内容
      const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/)
      const thinkContent = thinkMatch ? thinkMatch[1] : null
      const mainText = text.replace(/<think>[\s\S]*?<\/think>/, '').trim()
      console.log("[DEBUG] 解析结果: thinkContent=", !!thinkContent, thinkContent?.slice(0, 100), "mainText=", mainText.slice(0, 100))

      // 如果有思考内容，先发送 agent_thought
      if (thinkContent) {
        // 逐字发送思考过程，模拟打字效果
        let j = 0
        while (j < thinkContent.length) {
          if (signal?.aborted) {
            controller.close()
            return
          }

          const chunk = thinkContent.slice(j, j + chunkSize)
          const thoughtEvent = {
            event: "agent_thought",
            thought: chunk,
            created_at: Math.floor(Date.now() / 1000),
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(thoughtEvent)}\n\n`))
          j += chunkSize

          await new Promise(resolve => setTimeout(resolve, 20))
        }
        // 思考完成后，延迟一小段时间，让用户看到"思考结束"的状态展示一下
        await new Promise(resolve => setTimeout(resolve, 500))
      } else {
        // 如果没有思考内容，发送一个默认的
        const thoughtEvent = {
          event: "agent_thought",
          thought: "思考中...",
          created_at: Math.floor(Date.now() / 1000),
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(thoughtEvent)}\n\n`))
        await new Promise(resolve => setTimeout(resolve, 600))
      }

      // 逐字发送主文本
      let i = 0
      while (i < mainText.length) {
        if (signal?.aborted) {
          controller.close()
          return
        }

        const chunk = mainText.slice(i, i + chunkSize)
        const event = {
          event: "message",
          answer: chunk,
          retriever_resources,
          created_at: Math.floor(Date.now() / 1000),
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        i += chunkSize

        // 模拟打字延迟
        await new Promise(resolve => setTimeout(resolve, 15))
      }

      // 发送结束事件
      const endEvent = {
        event: "message_end",
        created_at: Math.floor(Date.now() / 1000),
        metadata: {
          usage: {
            prompt_tokens: 0,
            completion_tokens: mainText.length,
            total_tokens: mainText.length,
          },
        },
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(endEvent)}\n\n`))
      controller.close()
    },
  })
}
