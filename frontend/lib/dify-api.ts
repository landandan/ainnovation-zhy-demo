/**
 * Dify API 类型定义 & 后端代理调用
 *
 * ⚠️ 所有 Dify 调用现由 Flask 后端代理，API Key 不再暴露到浏览器。
 * 前端只需传入 agent_id，后端从数据库读取 Dify 配置并转发请求。
 *
 * Mock 模式下直接走 createMockStream，不依赖后端。
 */

import { isMockMode } from "./mock-config"
import { createMockStream } from "./mock-api"

/* ───── 请求体（前端 → 后端代理） ───── */

export interface DifyChatProxyRequest {
  agent_id: string
  query: string
  conversation_id?: string | null
  inputs?: Record<string, unknown>
  files?: Array<{
    type: string
    transfer_method: string
    url?: string
    upload_file_id?: string
  }>
}

/* ───── 流式响应事件（Dify 原始 SSE 格式） ───── */

export interface DifyStreamEvent {
  event: "message" | "message_end" | "error" | "agent_thought" | "agent_message" | "workflow_started" | "workflow_finished" | "node_started" | "node_finished" | "tts_message" | "tts_message_end" | "message_file" | "message_replace"
  message_id?: string
  conversation_id?: string
  answer?: string
  created_at?: number
  message?: string
  status?: number
  code?: string
  thought?: string
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

/* ───── 文件上传响应 ───── */

export interface DifyFileUploadResponse {
  id: string
  name: string
  size: number
  extension: string
  mime_type: string
  created_by: string
  created_at: number
}

/* ───── 获取 Dify 配置（已废弃，由后端管理） ───── */

/**
 * @deprecated 前端不再管理 Dify API Key，由后端代理处理。
 * 仅保留用于向后兼容的类型导出。
 */
export function getDifyConfig(_agentId?: string): { apiUrl: string; apiKey: string } {
  return { apiUrl: "", apiKey: "" }
}

/* ───── 根据 agent id 获取 inputs ───── */

/** 最小化 Agent 定义（page.tsx 和 api-client.ts 都兼容） */
interface MinimalAgentDef {
  id?: string
  agent_id?: string
  label: string
}

export function getAgentInputs(agentId: string, agentDefs: MinimalAgentDef[]): Record<string, unknown> {
  const def = agentDefs.find((d) => (d.agent_id || d.id) === agentId)
  if (!def) return {}
  return {
    agent_type: agentId,
    agent_label: def.label,
  }
}

/* ───── 调用后端 Dify 代理（流式） ───── */

export async function callDifyChatStream(params: {
  query: string
  user: string
  conversationId?: string | null
  inputs?: Record<string, unknown>
  agentId?: string
  signal?: AbortSignal
  files?: Array<{
    type: string
    transfer_method: string
    upload_file_id: string
  }>
}): Promise<Response> {
  const { query, user, conversationId, inputs, agentId, signal, files } = params

  if (!agentId) {
    throw new Error("agent_id 未指定")
  }

  // Mock 模式：直接返回 createMockStream 包装的 Response
  if (isMockMode()) {
    const stream = createMockStream(agentId, query, conversationId)
    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  }

  const body: DifyChatProxyRequest = {
    agent_id: agentId,
    query,
    inputs: inputs || {},
  }

  if (conversationId) {
    body.conversation_id = conversationId
  }

  if (files && files.length > 0) {
    body.files = files
  }

  const token = getToken()
  if (!token) {
    throw new Error("未登录，无法调用 AI")
  }

  const response = await fetch("/api/dify/chat-messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API 错误 (${response.status}): ${errorText}`)
  }

  return response
}

/* ───── 上传文件到 Dify（通过后端代理） ───── */

export async function uploadFileToDify(
  file: File,
  user: string,
  agentId?: string,
): Promise<DifyFileUploadResponse> {
  if (!agentId) {
    throw new Error("agent_id 未指定")
  }

  const token = getToken()
  if (!token) {
    throw new Error("未登录，无法上传文件")
  }

  const formData = new FormData()
  formData.append("file", file)
  formData.append("agent_id", agentId)
  formData.append("user", user)

  const response = await fetch("/api/dify/files/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`文件上传失败 (${response.status}): ${errorText}`)
  }

  return response.json()
}

/* ───── 批量上传文件到 Dify（通过后端代理） ───── */

export interface UploadedFileRef {
  file: File
  type: "image" | "document"
  upload_file_id: string
}

/**
 * 批量上传文件到 Dify，返回每个文件的 upload_file_id。
 * 图片类型自动判定为 "image"，其余为 "document"。
 */
export async function uploadFilesToDify(
  files: File[],
  user: string,
  agentId: string,
): Promise<UploadedFileRef[]> {
  const results: UploadedFileRef[] = []

  for (const file of files) {
    const resp = await uploadFileToDify(file, user, agentId)
    const fileType = file.type.startsWith("image/") ? "image" : "document"
    results.push({
      file,
      type: fileType,
      upload_file_id: resp.id,
    })
  }

  return results
}

/* ───── 工具：从 localStorage 获取 token ───── */

function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("cnooc-auth-token")
}