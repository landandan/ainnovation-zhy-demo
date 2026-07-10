/**
 * Dify API 类型定义 & 后端代理调用
 *
 * ⚠️ 非 Mock 模式下所有 Dify 调用由 Flask 后端代理，API Key 不暴露到浏览器。
 * Mock 模式下直连 Dify 标准 API（不依赖后端），API Key 从 localStorage 读取。
 */

import { getToken } from "../auth/token"
import {
  API_BASE_URL,
  DIFY_FILE_UPLOAD_BASE_URL,
  DIFY_STOP_PROXY_BASE_URL,
} from "../http/routes"
import { isMockMode, getMockDifyApiConfigForAgent, generateMockStream } from "../mock/config"
import { getMockResponse } from "../mock/api"

/* ───── 请求体（前端 → 后端代理） ───── */

export interface DifyChatProxyRequest {
  userId: string
  agentId: string
  sessionId: string
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

/* ───── 调用 Dify Chat（流式 SSE） ───── */

export async function callDifyChatStream(params: {
  query: string
  user: string
  userId: string
  conversationId?: string | null
  inputs?: Record<string, unknown>
  agentId?: string
  signal?: AbortSignal
  files?: Array<{
    type: string
    transfer_method: string
    upload_file_id: string
  }>
  sessionId?: string
}): Promise<Response> {
  const { query, userId, user, conversationId, inputs, agentId, signal, files, sessionId } = params

  // --- Help 智能体：直接返回 Mock 数据，完全绕过 Dify ---
  // if (agentId === "help") {
  //   console.log("[DEBUG] Help 智能体被调用，查询:", query)
  //   const { mockText, retriever_resources } = getMockResponse(agentId, query)
  //   console.log("[DEBUG] getMockResponse 返回:", mockText.slice(0, 200), "...")
  //   return new Response(generateMockStream(mockText, retriever_resources, signal), {
  //     headers: {
  //       "Content-Type": "text/event-stream",
  //       "Cache-Control": "no-cache",
  //       "Connection": "keep-alive",
  //     }
  //   })
  // }

  if (!agentId) {
    throw new Error("agent_id 未指定")
  }

  // Mock 模式：直连 Dify chat-messages SSE 接口（不走后端代理）
  // if (!isMockMode()) {
  //   const { dify_base_url, dify_api_key } = getMockDifyApiConfigForAgent(agentId)

  //   const difyBody: Record<string, unknown> = {
  //     inputs: inputs || {},
  //     query,
  //     response_mode: "streaming",
  //     user,
  //   }

  //   // if (conversationId) {
  //   //   difyBody.conversation_id = conversationId
  //   // }

  //   if (files && files.length > 0) {
  //     difyBody.files = files
  //   }

  //   const response = await fetch(`${dify_base_url}/chat-messages`, {
  //     method: "POST",
  //     headers: {
  //       "Content-Type": "application/json",
  //       Authorization: `Bearer ${dify_api_key}`,
  //     },
  //     body: JSON.stringify(difyBody),
  //     signal,
  //   })

  //   if (!response.ok) {
  //     const errorText = await response.text()
  //     throw new Error(`Dify API 错误 (${response.status}): ${errorText}`)
  //   }

  //   return response
  // }

  // 非 Mock 模式：走后端代理
  const body: DifyChatProxyRequest = {
    userId: userId || '192.168.11.30',
    agentId: agentId,//'2075139237434441730',//'2075139237434441729',//'1',
    sessionId: sessionId || conversationId || '',//`${new Date().getTime()}`,
    // conversation_id: "1783586820396-b8sit26yn",
    query,
    inputs: inputs || {},
  }
    //   "query": "什么是oa",
    // "user": "192.168.11.30",
    // "response_mode": "streaming",
    // "conversation_id": "1783586820396-b8sit26yn",
    //  "userId": "192.168.11.30",
    //   "appId": "1",
    // "inputs": {
    // }

  // if (conversationId) {
  //   body.conversation_id = conversationId
  // }

  if (files && files.length > 0) {
    body.files = files
  }

  const token = getToken()
  if (!token) {
    throw new Error("未登录，无法调用 AI")
  }

  // /manage/dify/chat/streaming    /h5/chat/stream
  const response = await fetch(`${API_BASE_URL}/h5/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      Authorization: `Bearer ${token}`,
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      'Accept': 'text/event-stream',
      // "transfer-encoding": "chunked", 
    },
    body: JSON.stringify(body),
    // cache: 'no-store', // 关键：禁止 Next.js 缓存该请求
    signal,
  })
//   {
//     "query": "什么是oa",
//     "user": "192.168.11.30",
//     "response_mode": "streaming",
//     "conversation_id": "1783586820396-b8sit26yn",
//      "userId": "192.168.11.30",
//       "appId": "1",
//     "inputs": {
//     }
// }
  // const response = await fetch(`${API_BASE_URL}/dify/chat-messages`, {
  //   method: "POST",
  //   headers: {
  //     "Content-Type": "application/json",
  //     Authorization: `Bearer ${token}`,
  //     "Cache-Control": "no-cache",
  //     "Connection": "keep-alive",
  //   },
  //   body: JSON.stringify(body),
  //   signal,
  // })

  console.log('response123:', response)
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API 错误 (${response.status}): ${errorText}`)
  }

  return response
}

/* ───── 上传文件到 Dify ───── */

export async function uploadFileToDify(
  file: File,
  user: string,
  agentId?: string,
): Promise<DifyFileUploadResponse> {
  if (!agentId) {
    throw new Error("agent_id 未指定")
  }

  const formData = new FormData()
  formData.append("file", file)
  formData.append("user", user)

  // Mock 模式：直连 Dify 文件上传接口（不走后端代理）
  if (isMockMode()) {
    const { dify_base_url, dify_api_key } = getMockDifyApiConfigForAgent(agentId)

    const response = await fetch(`${dify_base_url}/files/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${dify_api_key}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Dify 文件上传失败 (${response.status}): ${errorText}`)
    }

    return response.json()
  }

  // 非 Mock 模式：走后端代理
  const token = getToken()
  if (!token) {
    throw new Error("未登录，无法上传文件")
  }

  formData.append("agent_id", agentId)

  const response = await fetch(`${DIFY_FILE_UPLOAD_BASE_URL}/dify/files/upload`, {
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

/* ───── 批量上传文件到 Dify ───── */

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

/* ───── 停止 Dify 任务 ───── */

/**
 * 通知 Dify 服务端停止指定 task 的生成。
 *
 * Dify 根据"应用类型"使用不同的停止端点：
 * - Chatflow / Agent / Chatbot → `POST /chat-messages/{task_id}/stop`
 * - Workflow                    → `POST /workflows/run/{task_id}/stop`
 *
 * 调用方需通过 SSE 事件类型判断应用类型并传入 `isWorkflow`：
 * - 出现 `workflow_started` / `node_started` 等事件 → isWorkflow = true
 * - 出现 `agent_thought` / `message` 等事件           → isWorkflow = false
 *
 * - Mock 模式：浏览器直连对应 Dify 端点
 * - 非 Mock 模式：通过后端统一代理端点 `/api/dify/chat-messages/stop`，
 *   后端根据 `is_workflow` 参数路由到正确的 Dify URL。
 *
 * 即使请求失败也不抛错（停止是 best-effort 操作）。
 */
export async function stopDifyTask(params: {
  agentId: string
  taskId: string
  user: string
  isWorkflow?: boolean
}): Promise<void> {
  const { agentId, taskId, user, isWorkflow = false } = params

  try {
    if (isMockMode()) {
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

    // 非 Mock 模式：走后端代理（后端根据 is_workflow 路由）
    const token = getToken()
    if (!token) return

    await fetch(`${DIFY_STOP_PROXY_BASE_URL}/dify/chat-messages/stop`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        agent_id: agentId,
        task_id: taskId,
        is_workflow: isWorkflow,
      }),
    })
  } catch (err) {
    // 停止是 best-effort，失败不抛错
    console.warn("停止 Dify 任务失败:", err)
  }
}
