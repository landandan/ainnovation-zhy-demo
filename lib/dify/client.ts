/**
 * Dify API 类型定义 & 后端代理调用
 *
 * ⚠️ 非 Mock 模式下所有 Dify 调用由 后端代理，API Key 不暴露到浏览器。
 * Mock 模式下直连 Dify 标准 API（不依赖后端），API Key 从 localStorage 读取。
 */

import { getToken, getClientId } from "../auth/token"
import { handleAuthExpired } from "../http/client"
import {
  API_BASE_URL,
} from "../http/routes"
import { isMockMode, getMockDifyApiConfigForAgent, generateMockStream } from "../mock/config"
import { getMockResponse } from "../mock/api"

/* ───── 请求体（前端 → 后端代理） ───── */

export interface DifyChatProxyRequest {
  userId: string
  agentId: string
  sessionId: string
  /** 新对话由前端生成 uuid；延续对话用流式返回的 localSessionId */
  localSessionId?: string
  query: string
  conversation_id?: string | null
  inputs?: Record<string, unknown>
  /** 本地上传接口返回的 ossId 列表 */
  inputFiles?: Array<{ ossId: string | number }>
}

/* ───── 流式响应事件（Dify 原始 SSE 格式） ───── */

export interface DifyStreamEvent {
  event: "message" | "message_end" | "error" | "agent_thought" | "agent_message" | "workflow_started" | "workflow_finished" | "node_started" | "node_finished" | "tts_message" | "tts_message_end" | "message_file" | "message_replace"
  task_id?: string
  id?: string
  message_id?: string
  // conversation_id?: string
  answer?: string
  created_at?: number
  message?: string
  status?: number
  code?: string
  thought?: string
  type?: string
  belongs_to?: string
  url?: string
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

/* ───── 调用 Dify Chat（流式 SSE） ───── */

export async function callDifyChatStream(params: {
  query: string
  user: string
  userId: string
  conversationId?: string | null
  inputs?: Record<string, unknown>
  agentId?: string
  signal?: AbortSignal
  sessionId?: string
  /** 新对话 uuid；延续对话用上次流式返回值 */
  localSessionId?: string
  inputFiles?: Array<{ ossId: string | number }>
}): Promise<Response> {
  const {
    query,
    userId,
    user,
    conversationId,
    inputs,
    agentId,
    signal,
    sessionId,
    localSessionId,
    inputFiles,
  } = params


  if (!agentId) {
    throw new Error("agent_id 未指定")
  }


  // 非 Mock 模式：走后端代理
  const body: DifyChatProxyRequest = {
    userId: userId || '192.168.11.30',
    agentId: agentId,
    sessionId: sessionId || conversationId || '',
    query,
    inputs: inputs || {},
  }
  if (localSessionId) {
    body.localSessionId = localSessionId
  }

  if (inputFiles && inputFiles.length > 0) {
    body.inputFiles = inputFiles
  }

  const token = getToken()
  if (!token) {
    throw new Error("未登录，无法调用 AI")
  }

  const clientid = getClientId() || ""
  const headers: Record<string, string> = {
    "Content-Type": "application/json;charset=UTF-8",
    Authorization: `Bearer ${token}`,
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    Accept: "text/event-stream",
  }
  if (clientid) {
    headers.clientid = clientid
  }

  // /manage/dify/chat/streaming    /h5/chat/stream
  const response = await fetch(`${API_BASE_URL}/h5/chat/stream`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      handleAuthExpired()
    }
    const errorText = await response.text()
    throw new Error(`API 错误 (${response.status}): ${errorText}`)
  }

  return response
}

/* ───── 停止 Dify 任务 ───── */

/**
 * 停止正在生成的流式对话。
 * 非 Mock 模式：POST /h5/chat/stop
 * Mock 模式：直连 Dify 停止端点
 * 即使请求失败也不抛错（best-effort）。
 */
export async function stopDifyTask(params: {
  agentId: string
  taskId?: string
  userId?: number
  user?: string
  isWorkflow?: boolean
  /** 流中最后一条带 answer 的分片字段 */
  answer?: string
  localMessageId?: string
  messageId?: string
  sessionId?: string
}): Promise<void> {
  const {
    agentId,
    taskId,
    userId,
    user = "anonymous",
    isWorkflow = false,
    answer,
    localMessageId,
    messageId,
    sessionId,
  } = params

  try {
    if (isMockMode()) {
      if (!taskId) return
      const { dify_base_url, dify_api_key } = getMockDifyApiConfigForAgent(agentId)
      const stopPath = isWorkflow
        ? `/workflows/run/${taskId}/stop`
        : `/chat-messages/${taskId}/stop`
      await fetch(`${dify_base_url}${stopPath}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${dify_api_key}`,
        },
        body: JSON.stringify({ user }),
      })
      return
    }

    if (!userId) return

    const token = getToken()
    if (!token) return

    const clientid = getClientId() || "0d4c873ff6146ecd7f38e2e45526ab1b"
    await fetch(`${API_BASE_URL}/h5/chat/stop`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        clientid,
      },
      body: JSON.stringify({
        agentId,
        ...(taskId ? { taskId } : {}),
        userId,
        answer: answer ?? "",
        localMessageId: localMessageId ?? "",
        messageId: messageId ?? "",
        sessionId: sessionId ?? "",
      }),
    })
  } catch (err) {
    console.warn("停止对话失败:", err)
  }
}
