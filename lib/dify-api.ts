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

/* ───── 智能体类型 → 默认 Inputs ───── */

import type { AgentType } from "@/app/page"

export const AGENT_INPUTS: Record<AgentType, Record<string, unknown>> = {
  knowledge: { agent_type: "knowledge", module: "安全规程查询" },
  inspection: { agent_type: "inspection", module: "无纸化巡检" },
  repair: { agent_type: "repair", module: "设备故障诊断" },
  report: { agent_type: "report", module: "生产日报填报" },
}

/* ───── 获取 API 配置（优先从 localStorage 读取） ───── */

export function getDifyConfig(): { apiUrl: string; apiKey: string } {
  // 仅在浏览器端可用
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("dify-settings")
      if (stored) {
        const parsed = JSON.parse(stored)
        return {
          apiUrl: parsed.apiUrl || process.env.NEXT_PUBLIC_DIFY_API_URL || "https://api.dify.ai/v1",
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
 * 返回 ReadableStream 可被 fetch 直接消费
 */
export async function callDifyChatStream(params: {
  query: string
  user: string
  conversationId?: string | null
  inputs?: Record<string, unknown>
  apiUrl?: string
  apiKey?: string
}): Promise<Response> {
  const { query, user, conversationId, inputs, apiUrl, apiKey } = params
  const config = apiUrl && apiKey ? { apiUrl, apiKey } : getDifyConfig()

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
}): Promise<DifyBlockingResponse> {
  const { query, user, conversationId, inputs, apiUrl, apiKey } = params
  const config = apiUrl && apiKey ? { apiUrl, apiKey } : getDifyConfig()

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
  apiUrl?: string,
  apiKey?: string,
): Promise<DifyFileUploadResponse> {
  const config = apiUrl && apiKey ? { apiUrl, apiKey } : getDifyConfig()

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