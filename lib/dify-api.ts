/**
 * Dify API 类型定义 & 配置
 * API 文档：https://docs.dify.ai/api
 */

/* ───── 请求体 ───── */

export interface DifyChatRequest {
  /** 用户输入文本 */
  query: string
  /** 用户标识 */
  user: string
  /** 会话 ID（多轮对话时传入，首次为空） */
  conversation_id?: string
  /** 可选：传入工作流中定义的变量 */
  inputs?: Record<string, unknown>
  /** 响应模式：streaming | blocking */
  response_mode: "streaming" | "blocking"
  /** 文件附件（需先上传到 Dify） */
  files?: Array<{
    type: string
    transfer_method: string
    url?: string
    upload_file_id?: string
  }>
}

/* ───── 流式响应事件 ───── */

export interface DifyStreamEvent {
  event: "message" | "message_end" | "error" | "agent_thought" | "agent_message" | "workflow_started" | "workflow_finished" | "node_started" | "node_finished" | "tts_message" | "tts_message_end" | "message_file" | "message_replace"
  /** 消息 ID */
  message_id?: string
  /** 会话 ID */
  conversation_id?: string
  /** 增量文本块（event=message） */
  answer?: string
  /** 创建时间戳 */
  created_at?: number
  /** 错误信息（event=error） */
  message?: string
  status?: number
  code?: string
  /** 完整元数据（event=message_end） */
  metadata?: {
    usage?: {
      prompt_tokens: number
      completion_tokens: number
      total_tokens: number
    }
    retriever_resources?: Array<{
      position: number
      dataset_id: string
      dataset_name: string
      document_id: string
      document_name: string
      segment_id: string
      score: number
      content: string
    }>
  }
}

/* ───── 阻塞式响应 ───── */

export interface DifyBlockingResponse {
  event: "message"
  message_id: string
  conversation_id: string
  mode: "chat"
  answer: string
  created_at: number
  metadata?: {
    usage?: {
      prompt_tokens: number
      completion_tokens: number
      total_tokens: number
    }
  }
}

/* ───── 上传文件响应 ───── */

export interface DifyFileUploadResponse {
  id: string
  name: string
  size: number
  extension: string
  mime_type: string
  created_by: string
  created_at: number
}

/* ───── 根据 agent id 获取对应的 inputs ───── */

import type { AgentDef } from "@/lib/settings-store"

export function getAgentInputs(agentId: string, agentDefs: AgentDef[]): Record<string, unknown> {
  const def = agentDefs.find((d) => d.id === agentId)
  if (!def) return {}
  return {
    agent_type: agentId,
    agent_label: def.label,
  }
}

/* ───── 获取 API 配置（优先从 localStorage 读取，支持按 Agent 独立 Key） ───── */

export function getDifyConfig(agentId?: string): { apiUrl: string; apiKey: string } {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("dify-settings")
      if (stored) {
        const parsed = JSON.parse(stored)
        const globalUrl = parsed.apiUrl || process.env.NEXT_PUBLIC_DIFY_API_URL || "https://api.dify.ai/v1"

        // 按 Agent 查找独立配置
        if (parsed.agents && agentId && parsed.agents[agentId]) {
          const agentCfg = parsed.agents[agentId] as { apiKey?: string; apiUrl?: string }
          return {
            apiUrl: agentCfg.apiUrl || globalUrl,
            apiKey: agentCfg.apiKey || "",
          }
        }

        // 有 agents 对象但未找到该 agentId
        if (parsed.agents) {
          return { apiUrl: globalUrl, apiKey: "" }
        }

        // 旧格式（向后兼容）
        return {
          apiUrl: globalUrl,
          apiKey: parsed.apiKey || process.env.NEXT_PUBLIC_DIFY_API_KEY || "",
        }
      }
    } catch {
      // ignore
    }
  }
  return {
    apiUrl: process.env.NEXT_PUBLIC_DIFY_API_URL || "https://api.dify.ai/v1",
    apiKey: process.env.NEXT_PUBLIC_DIFY_API_KEY || "",
  }
}

/**
 * 调用 Dify Chat API（流式）
 */
export async function callDifyChatStream(params: {
  query: string
  user: string
  conversationId?: string | null
  inputs?: Record<string, unknown>
  apiUrl?: string
  apiKey?: string
  agentId?: string
}): Promise<Response> {
  const { query, user, conversationId, inputs, apiUrl, apiKey, agentId } = params
  const config = apiUrl && apiKey ? { apiUrl, apiKey } : getDifyConfig(agentId)

  if (!config.apiKey) {
    throw new Error("Dify API Key 未配置，请在侧边栏设置中填写")
  }

  const body: DifyChatRequest = {
    query,
    user,
    response_mode: "streaming",
    inputs: inputs || {},
  }

  if (conversationId) {
    body.conversation_id = conversationId
  }

  const response = await fetch(`${config.apiUrl}/chat-messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Dify API 错误 (${response.status}): ${errorText}`)
  }

  return response
}

/**
 * 调用 Dify Chat API（阻塞式）
 */
export async function callDifyChatBlocking(params: {
  query: string
  user: string
  conversationId?: string | null
  inputs?: Record<string, unknown>
  apiUrl?: string
  apiKey?: string
  agentId?: string
}): Promise<DifyBlockingResponse> {
  const { query, user, conversationId, inputs, apiUrl, apiKey, agentId } = params
  const config = apiUrl && apiKey ? { apiUrl, apiKey } : getDifyConfig(agentId)

  if (!config.apiKey) {
    throw new Error("Dify API Key 未配置，请在侧边栏设置中填写")
  }

  const body: DifyChatRequest = {
    query,
    user,
    response_mode: "blocking",
    inputs: inputs || {},
  }

  if (conversationId) {
    body.conversation_id = conversationId
  }

  const response = await fetch(`${config.apiUrl}/chat-messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Dify API 错误 (${response.status}): ${errorText}`)
  }

  return response.json()
}

/**
 * 上传文件到 Dify
 */
export async function uploadFileToDify(
  file: File,
  user: string,
  agentId?: string,
  apiUrl?: string,
  apiKey?: string,
): Promise<DifyFileUploadResponse> {
  const config = apiUrl && apiKey ? { apiUrl, apiKey } : getDifyConfig(agentId)

  if (!config.apiKey) {
    throw new Error("Dify API Key 未配置，请在侧边栏设置中填写")
  }

  const formData = new FormData()
  formData.append("file", file)
  formData.append("user", user)

  const response = await fetch(`${config.apiUrl}/files/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Dify 文件上传失败 (${response.status}): ${errorText}`)
  }

  return response.json()
}