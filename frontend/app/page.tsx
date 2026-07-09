"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { ChatArea } from "@/components/chat-area"
import { InputArea } from "@/components/input-area"
import { Toast } from "@/components/toast"
import { ResourceSidebar } from "@/components/resource-sidebar"
import { useToast } from "@/components/toast"
import { useAuth } from "@/lib/auth-store"
import {
  getAgents,
  getConversations,
  createConversation,
  updateConversation,
  deleteConversationApi,
  getMessages,
  addMessage,
  type AgentDefApi,
  type ConversationApi,
  type MessageApi,
} from "@/lib/api-client"
import { loadTheme, saveTheme } from "@/lib/settings-store"
import {
  callDifyChatStream,
  getAgentInputs,
  uploadFilesToDify,
  stopDifyTask,
} from '@/lib/dify-api'
import {
  WorkflowProgress,
  createInitialProgress,
  handleWorkflowStarted,
  handleNodeStarted,
  handleNodeFinished,
  handleWorkflowFinished,
  handleWorkflowError,
  handleWorkflowStopped,
} from '@/lib/workflow-progress'
import { getUserSettings, updateUserSettings, isAuthenticated } from "@/lib/api-client"

export interface MessageFileAttachment {
  name: string
  size?: number
  original_url?: string
  file_id?: string
  mime_type?: string
  type?: string
}

export interface ResourceItem {
  document_name: string
  content: string
}

export interface Message {
  role: "user" | "ai"
  text: string
  images?: string[]
  files?: MessageFileAttachment[]
  workflowProgress?: WorkflowProgress
  time: string
  loading?: boolean
  thinking?: string
  thinkingComplete?: boolean
  waiting?: boolean
  resourcesList?: ResourceItem[]
}

export interface ChatHistoryItem {
  id: number
  title: string
  agent: string
  preview: string
  time: string
  active: boolean
}

export interface AgentDef {
  id: string
  label: string
  icon: string
  desc: string
  quickQuestions: string[]
  gradient: string
  sortOrder: number
  isActive: boolean
}

/** 3 套主题列表 */
export const THEMES = [
  { id: "", label: "Kimi 默认", dark: false, category: "浅色" },
  { id: "deep-ocean", label: "深海蓝", dark: true, category: "暗色" },
  { id: "aurora-blue", label: "极光蓝", dark: false, category: "浅色" },
] as const

export type ThemeId = (typeof THEMES)[number]["id"]

/** 将后端 AgentDefApi 转为前端 AgentDef */
function mapAgentDef(a: AgentDefApi): AgentDef {
  return {
    id: a.agent_id,
    label: a.label,
    icon: a.icon,
    desc: a.desc,
    gradient: a.gradient,
    sortOrder: a.sort_order,
    isActive: a.is_active,
    quickQuestions: a.quick_questions,
  }
}

/** 将后端 MessageApi 转为前端 Message */
function fileNameFromUrl(url: string, fallback = "附件"): string {
  try {
    const parsed = new URL(url, "http://localhost")
    const pathname = parsed.pathname || ""
    const lastSegment = pathname.split("/").pop() || fallback
    const decoded = decodeURIComponent(lastSegment)
    return decoded || fallback
  } catch {
    return fallback
  }
}

function normalizeMessageAttachments(rawAttachments: unknown[]): MessageFileAttachment[] {
  if (!Array.isArray(rawAttachments)) return []

  return rawAttachments.flatMap((item) => {
    if (!item || typeof item !== "object") return []

    const record = item as Record<string, unknown>
    const originalUrl = typeof record.original_url === "string"
      ? record.original_url.trim()
      : typeof record.url === "string"
        ? record.url.trim()
        : ""
    const fileId = typeof record.file_id === "string"
      ? record.file_id.trim()
      : typeof record.id === "string"
        ? record.id.trim()
        : ""
    const rawName = typeof record.name === "string" ? record.name.trim() : ""
    const name = rawName || (originalUrl ? fileNameFromUrl(originalUrl) : fileId || "附件")

    return [{
      name,
      size: typeof record.size === "number" ? record.size : undefined,
      original_url: originalUrl || undefined,
      file_id: fileId || undefined,
      mime_type: typeof record.mime_type === "string" ? record.mime_type : undefined,
      type: typeof record.type === "string" ? record.type : undefined,
    }]
  })
}

function extractThinkingFromContent(content: string): {
  thinking: string | null
  mainText: string
  hasThinkTag: boolean
} {
  if (!content) {
    return {
      thinking: null,
      mainText: "",
      hasThinkTag: false,
    }
  }

  const openTag = "<think>"
  const closeTag = "</think>"
  const openIndex = content.indexOf(openTag)

  if (openIndex === -1) {
    return {
      thinking: null,
      mainText: content.trim(),
      hasThinkTag: false,
    }
  }

  const afterOpen = content.slice(openIndex + openTag.length)
  const closeIndex = afterOpen.indexOf(closeTag)

  if (closeIndex === -1) {
    return {
      thinking: afterOpen.trim() || null,
      mainText: content.slice(0, openIndex).trim(),
      hasThinkTag: true,
    }
  }

  const thinking = afterOpen.slice(0, closeIndex).trim()
  const mainText = `${content.slice(0, openIndex)}${afterOpen.slice(closeIndex + closeTag.length)}`.trim()

  return {
    thinking: thinking || null,
    mainText,
    hasThinkTag: true,
  }
}

function normalizeResources(rawResources: unknown): ResourceItem[] {
  if (!Array.isArray(rawResources)) return []
  return rawResources.map((item) => {
    const record = item as Record<string, unknown>
    return {
      document_name: typeof record.document_name === "string" ? record.document_name : "未知文档",
      content: typeof record.content === "string" ? record.content : "",
    }
  })
}

function mapMessage(m: MessageApi): Message {
  const content = m.content || "";
  const { thinking, mainText } = extractThinkingFromContent(content)
  
  return {
    role: m.role === "assistant" ? "ai" : m.role as "user" | "ai",
    text: mainText,
    thinking,
    thinkingComplete: true, // 历史消息中的思考肯定是完成的
    files: normalizeMessageAttachments(m.attachments),
    resourcesList: normalizeResources((m as any).resources_list),
    time: new Date(m.created_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
  }
}

export default function Page() {
  const { user, logout } = useAuth()
  const router = useRouter()

  /* ───── 主题状态 ───── */
  const [theme, setTheme] = useState<ThemeId>("")
  const [themeLoaded, setThemeLoaded] = useState(false)

  useEffect(() => {
    const saved = loadTheme("") as ThemeId
    setTheme(saved)
    if (saved) {
      document.documentElement.dataset.theme = saved
    } else {
      delete document.documentElement.dataset.theme
    }
    setThemeLoaded(true)
  }, [])

  /* ───── 布局状态 ───── */
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarHovered, setSidebarHovered] = useState(false)
  const [historySearch, setHistorySearch] = useState("")

  const maybeCloseSidebar = useCallback(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
  }, [])

  /* ───── 数据状态（从后端 API 加载） ───── */
  const [agentDefs, setAgentDefs] = useState<AgentDef[]>([])
  const [conversations, setConversations] = useState<ConversationApi[]>([])
  const [loadingData, setLoadingData] = useState(true)

  /** agent_id 字符串 → 数据库 id 映射 */
  const agentIdToDbId = useRef<Map<string, number>>(new Map())

  /* ───── 业务状态 ───── */
  const [currentAgentId, setCurrentAgentId] = useState<string>("")
  const [messages, setMessages] = useState<Message[]>([])
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; size: number }[]>([])
  /* 原始 File 对象，用于上传到 Dify */
  const [rawImageFiles, setRawImageFiles] = useState<File[]>([])
  const [rawDocFiles, setRawDocFiles] = useState<File[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [resourceSidebarOpen, setResourceSidebarOpen] = useState(false)
  const [resourceSidebarResources, setResourceSidebarResources] = useState<ResourceItem[]>([])
  const chatAreaRef = useRef<HTMLDivElement>(null)

  /* ───── 对话持久化状态 ───── */
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null)
  const [sessionId, setSessionId] = useState<string>(() => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
  const difyConversationIdRef = useRef<string | null>(null)

  /* ───── 流式请求中断 ───── */
  const abortControllerRef = useRef<AbortController | null>(null)
  /** 当前 Dify 任务的 task_id（从 SSE 事件中捕获），用于停止生成 */
  const currentTaskIdRef = useRef<string | null>(null)
  /** 当前任务是否为 Workflow 类型（由 SSE 事件判定），用于选择正确的停止端点 */
  const isWorkflowTaskRef = useRef<boolean>(false)
  /** 保存当前请求的上下文，用于重试 */
  const lastRequestRef = useRef<{
    userText: string
    files?: Array<{ type: string; transfer_method: string; upload_file_id: string }>
    userAttachments?: MessageFileAttachment[]
  } | null>(null)

  /* ───── Toast hook ───── */
  const { toasts, dismissToast, success, error, warning, info } = useToast()

  const activeAgentDefs = useMemo(
    () => agentDefs.filter((agent) => agent.isActive),
    [agentDefs],
  )

  const currentAgentLabel =
    activeAgentDefs.find((d) => d.id === currentAgentId)?.label ?? "未知应用"
  const currentAgentDesc =
    activeAgentDefs.find((d) => d.id === currentAgentId)?.desc ?? ""
  const currentAgentQuickQuestions =
    activeAgentDefs.find((d) => d.id === currentAgentId)?.quickQuestions ?? []

  /* ───── 初始化：从后端加载 agents 和 conversations ───── */
  useEffect(() => {
    if (!user) return

    async function loadData() {
      try {
        // 并行加载 agents 和 conversations
        const [agentsRes, convsRes] = await Promise.all([
          getAgents(),
          getConversations(),
        ])
        console.log('agentsRes123:', agentsRes)
        console.log('convsRes123:', convsRes)
        if (agentsRes.agents?.length > 0) {
          const mapped = agentsRes.agents.map(mapAgentDef)
          setAgentDefs(mapped)
          // 建立 agent_id → db_id 映射
          const idMap = new Map<string, number>()
          for (const a of agentsRes.agents) {
            idMap.set(a.agent_id, a.id)
          }
          agentIdToDbId.current = idMap
          const activeMapped = mapped.filter((a) => a.isActive)
          // 首次进入时，如果未选择智能体，默认选择“深海智航”，否则选择第一个启用应用
          if (!currentAgentId) {
            const prefer = activeMapped.find((a) => a.label === "深海智航")?.id
            setCurrentAgentId(prefer || activeMapped[0]?.id || "")
          }
        }

        if (convsRes.conversations?.length > 0) {
          setConversations(convsRes.conversations)
        }
      } catch (err) {
        console.error("加载数据失败:", err)
      } finally {
        setLoadingData(false)
      }
    }

    loadData()
  }, [user])

  useEffect(() => {
    if (loadingData || typeof window === "undefined") return
    window.dispatchEvent(new Event("app-route-transition-complete"))
  }, [loadingData])

  useEffect(() => {
    if (activeAgentDefs.length === 0) {
      if (currentAgentId) {
        setCurrentAgentId("")
      }
      return
    }

    const stillAvailable = activeAgentDefs.some((agent) => agent.id === currentAgentId)
    if (stillAvailable) return

    const prefer = activeAgentDefs.find((agent) => agent.label === "深海智航")?.id
    setCurrentAgentId(prefer || activeAgentDefs[0].id)
  }, [activeAgentDefs, currentAgentId])

  /* ───── 衍生：build chatHistory from conversations ───── */
  const buildChatHistory = useCallback((): ChatHistoryItem[] => {
    return conversations.map((c) => ({
      id: c.id,
      title: c.title,
      agent: c.agent_id_str,
      preview: c.last_message_at ? "最近活跃" : "新对话",
      time: new Date(c.last_message_at || c.created_at).toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      active: c.id === activeConversationId,
    }))
  }, [conversations, activeConversationId])

  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([])
  useEffect(() => {
    setChatHistory(buildChatHistory())
  }, [buildChatHistory])

  /* ───── 保存消息到后端 ───── */
  const persistMessage = useCallback(
    async (
      convId: number,
      role: string,
      content: string,
      options?: {
        attachments?: MessageFileAttachment[]
        difyMessageId?: string
      },
    ) => {
      try {
        await addMessage(convId, {
          role,
          content,
          attachments: options?.attachments?.length ? JSON.stringify(options.attachments) : undefined,
          dify_message_id: options?.difyMessageId,
        })
      } catch (err) {
        console.error("保存消息失败:", err)
      }
    },
    [],
  )

  /* ───── 主题切换 ───── */
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme)
    const currentTheme = THEMES.find((t) => t.id === theme)
    if (currentTheme?.dark) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [theme])

  const handleThemeChange = useCallback(
    (newTheme: ThemeId) => {
      setTheme(newTheme)
      saveTheme(newTheme)
      // 同步主题到后端 settings
      if (isAuthenticated()) {
        updateUserSettings({ theme: newTheme }).catch(() => {})
      }
    },
    [success],
  )

  /* ───── 滚动到底 ───── */
  const scrollToBottom = useCallback(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight
    }
  }, [])

  const isAtBottom = useCallback(() => {
    const el = chatAreaRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 100
  }, [])

  useEffect(() => {
    if (isAtBottom()) {
      scrollToBottom()
    }
  }, [messages, scrollToBottom, isAtBottom])

  /* ───── 智能体切换 ───── */
  const handleSelectAgent = (agentId: string) => {
    if (isStreaming) {
      handleStopStreaming()
    }
    setCurrentAgentId(agentId)
    handleNewChat()
    maybeCloseSidebar()
  }

  const handleNewChat = () => {
    setMessages([])
    setActiveConversationId(null)
    setSessionId(`${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
    difyConversationIdRef.current = null
    setSidebarOpen(false)
    setIsStreaming(false)
    // 清空临时上传的文件和图片
    setUploadedImages([])
    setUploadedFiles([])
    setRawImageFiles([])
    setRawDocFiles([])
  }

  const handleSelectHistory = async (id: number) => {
    try {
      // 从后端加载消息
      const msgsRes = await getMessages(id)
      
      // 确保消息按正序排列（旧的在前，新的在后）
      // 使用 id 进行排序最可靠，因为 id 是自增的，能准确反映插入顺序
      const sortedMsgs = [...msgsRes.messages].sort((a, b) => a.id - b.id);

      const mappedMsgs = sortedMsgs.map(mapMessage)
      setMessages(mappedMsgs)
      setActiveConversationId(id)
      // 切换到该对话所属的智能体
      const conv = conversations.find((c) => c.id === id)
      if (conv) setCurrentAgentId(conv.agent_id_str)
      setSessionId(`${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
      difyConversationIdRef.current = null
      maybeCloseSidebar()
      // 静默切换，不显示提示
    } catch (err) {
      console.error("加载对话消息失败:", err)
      error("加载对话失败")
    }
  }

  const handleDeleteHistory = async (id: number) => {
    try {
      await deleteConversationApi(id)
      setConversations((prev) => prev.filter((c) => c.id !== id))
      if (activeConversationId === id) {
        setMessages([])
        setActiveConversationId(null)
        difyConversationIdRef.current = null
      }
      success("对话已删除")
    } catch (err) {
      console.error("删除对话失败:", err)
      error("删除失败")
    }
  }

  const handleBulkDeleteHistory = async (ids: number[]) => {
    try {
      // 依次删除每个会话
      for (const id of ids) {
        await deleteConversationApi(id)
      }
      // 从列表中移除所有删除的会话
      setConversations((prev) => prev.filter((c) => !ids.includes(c.id)))
      // 如果当前激活的会话在删除列表中，清空消息
      if (activeConversationId && ids.includes(activeConversationId)) {
        setMessages([])
        setActiveConversationId(null)
        difyConversationIdRef.current = null
      }
      // 只显示一个成功提示
      success(`已删除 ${ids.length} 条对话`)
    } catch (err) {
      console.error("批量删除对话失败:", err)
      error("批量删除失败")
    }
  }

  const handleRenameHistory = async (id: number, newTitle: string) => {
    try {
      await updateConversation(id, { title: newTitle })
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c))
      )
      success("重命名成功")
    } catch (err) {
      console.error("重命名对话失败:", err)
      error("重命名失败")
    }
  }

  /* ───── 设置面板跳转 ───── */
  const handleOpenSettings = () => {
    maybeCloseSidebar()
    router.push("/settings")
  }

  /* ───── 调用后端 Dify 代理（流式） ───── */
  const callDifyAPI = async (
    userText: string,
    allMessages: Message[],
    files?: Array<{ type: string; transfer_method: string; upload_file_id: string }>,
    userAttachments?: MessageFileAttachment[],
  ) => {
    // 创建新的 AbortController 用于中断
    const controller = new AbortController()
    abortControllerRef.current = controller
    setIsStreaming(true)

    try {
      const response = await callDifyChatStream({
        query: userText,
        user: user?.username || "anonymous",
        conversationId: difyConversationIdRef.current,
        inputs: getAgentInputs(currentAgentId, agentDefs),
        agentId: currentAgentId,
        signal: controller.signal,
        files,
        sessionId,
      })

      const reader = response.body?.getReader()
      if (!reader) throw new Error("无法读取流式响应")

      const decoder = new TextDecoder()
      let buffer = ""
      let fullAnswer = ""
      let rawAssistantContent = ""
      let fullThinking = ""
      let firstTokenArrived = false
      let thinkingComplete = false // 标记思考是否完成
      let currentWorkflowProgress = createInitialProgress()
      let newDifyConversationId: string | null = null
      let assistantDifyMessageId: string | undefined
      let resourcesList: any = []
      const assistantAttachments: MessageFileAttachment[] = []
      const aiTime = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
      // 重置当前 task_id 和 workflow 标志（新一轮请求）
      currentTaskIdRef.current = null
      isWorkflowTaskRef.current = false

      const messageIndex = allMessages.length - 1

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        console.log('buffer123:', buffer)
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        let chunkHasUpdates = false

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith("data: ")) continue

          const jsonStr = trimmed.slice(6)
          if (jsonStr === "[DONE]") continue

          try {
            const event = JSON.parse(jsonStr)
            console.log('event123:', event)
            if (typeof event.message_id === "string" && event.message_id.trim()) {
              assistantDifyMessageId = event.message_id.trim()
            }

            switch (event.event) {
              // Workflow 类型事件：出现即标记为 Workflow 应用
              case "workflow_started":
                isWorkflowTaskRef.current = true
                if (event.task_id && !currentTaskIdRef.current) {
                  currentTaskIdRef.current = event.task_id
                }
                currentWorkflowProgress = handleWorkflowStarted(currentWorkflowProgress, event)
                chunkHasUpdates = true
                break

              case "node_started":
                isWorkflowTaskRef.current = true
                if (event.task_id && !currentTaskIdRef.current) {
                  currentTaskIdRef.current = event.task_id
                }
                currentWorkflowProgress = handleNodeStarted(currentWorkflowProgress, event)
                chunkHasUpdates = true
                break

              case "node_finished":
                isWorkflowTaskRef.current = true
                if (event.task_id && !currentTaskIdRef.current) {
                  currentTaskIdRef.current = event.task_id
                }
                currentWorkflowProgress = handleNodeFinished(currentWorkflowProgress, event)
                chunkHasUpdates = true
                break

              case "workflow_finished":
                isWorkflowTaskRef.current = true
                if (event.task_id && !currentTaskIdRef.current) {
                  currentTaskIdRef.current = event.task_id
                }
                currentWorkflowProgress = handleWorkflowFinished(currentWorkflowProgress)
                chunkHasUpdates = true
                break

              // Chatflow / Agent 类型事件
              case "agent_thought":
                if (event.thought) {
                  fullThinking += event.thought
                  chunkHasUpdates = true
                }
                if (event.task_id && !currentTaskIdRef.current) {
                  currentTaskIdRef.current = event.task_id
                }
                break

              case "message":
                if (event.answer) {
                  rawAssistantContent += event.answer
                  resourcesList = event.retriever_resources || []
                  const parsedContent = extractThinkingFromContent(rawAssistantContent)
                  fullAnswer = parsedContent.mainText
                  if (parsedContent.hasThinkTag) {
                    fullThinking = parsedContent.thinking || ""
                  }
                  if (!firstTokenArrived) {
                    firstTokenArrived = true
                  }
                  thinkingComplete = parsedContent.hasThinkTag
                    ? parsedContent.mainText.length > 0
                    : true
                  chunkHasUpdates = true
                }
                if (event.task_id && !currentTaskIdRef.current) {
                  currentTaskIdRef.current = event.task_id
                }
                break

              case "message_file": {
                const fileId = typeof event.id === "string" ? event.id.trim() : ""
                const originalUrl = typeof event.url === "string" ? event.url.trim() : ""
                const duplicate = assistantAttachments.some((item) =>
                  (fileId && item.file_id === fileId) ||
                  (originalUrl && item.original_url === originalUrl),
                )
                if (!duplicate) {
                  assistantAttachments.push({
                    name: fileNameFromUrl(originalUrl, fileId || "附件"),
                    file_id: fileId || undefined,
                    original_url: originalUrl || undefined,
                    type: typeof event.type === "string" ? event.type : undefined,
                  })
                  chunkHasUpdates = true
                }
                break
              }

              case "message_end":
                if (event.conversation_id) {
                  newDifyConversationId = event.conversation_id
                  difyConversationIdRef.current = newDifyConversationId
                }
                if (event.task_id && !currentTaskIdRef.current) {
                  currentTaskIdRef.current = event.task_id
                }
                chunkHasUpdates = true
                break

              case "error":
                currentWorkflowProgress = handleWorkflowError(currentWorkflowProgress, event)
                throw new Error(event.message || "Dify 返回错误")
            }
          } catch (parseError) {
            if (parseError instanceof SyntaxError) continue
            throw parseError
          }
        }

        if (chunkHasUpdates) {
          setMessages((prev) => {
            const updated = [...prev]
            if (messageIndex >= 0 && updated[messageIndex]) {
              updated[messageIndex] = {
                ...updated[messageIndex],
                text: fullAnswer,
                files: assistantAttachments.length > 0 ? [...assistantAttachments] : updated[messageIndex].files,
                workflowProgress:
                  currentWorkflowProgress.status === "idle"
                    ? updated[messageIndex].workflowProgress
                    : {
                        ...currentWorkflowProgress,
                        nodes: currentWorkflowProgress.nodes.map((node) => ({ ...node })),
                      },
                thinking: fullThinking,
                thinkingComplete: thinkingComplete,
                resourcesList: resourcesList,
                waiting: false,
                loading: false,
                time: aiTime,
              }
            }
            return updated
          })
        }
      }

      // 如果是新对话（无 activeConversationId），创建后端 conversation
      if (newDifyConversationId && !activeConversationId) {
        try {
          const dbAgentId = agentIdToDbId.current.get(currentAgentId)
          if (dbAgentId) {
            const convRes = await createConversation({
              agent_id: dbAgentId,
              title: userText.slice(0, 20) || "新对话",
            })
            const newConv = convRes.conversation
            setActiveConversationId(newConv.id)

            // 刷新 conversations 列表
            setConversations((prev) => [newConv, ...prev])

            // 保存用户消息和 AI 回复到后端
            await persistMessage(newConv.id, "user", userText, {
              attachments: userAttachments,
            })
            await persistMessage(newConv.id, "assistant", rawAssistantContent || fullAnswer, {
              attachments: assistantAttachments,
              difyMessageId: assistantDifyMessageId,
            })
          }
        } catch (err) {
          console.error("创建后端对话失败:", err)
        }
      } else if (activeConversationId) {
        // 已有对话，追加消息
        await persistMessage(activeConversationId, "user", userText, {
          attachments: userAttachments,
        })
        await persistMessage(activeConversationId, "assistant", rawAssistantContent || fullAnswer, {
          attachments: assistantAttachments,
          difyMessageId: assistantDifyMessageId,
        })
      }
    } catch (err: unknown) {
      // 如果是用户主动取消（AbortError），静默处理，不显示错误
      if (err instanceof DOMException && err.name === "AbortError") {
        // 静默处理，不显示错误 toast
        setMessages((prev) =>
          prev.map((m) =>
            m.waiting ? { ...m, waiting: false, loading: false } : m,
          ),
        )
        return
      }

      const errMsg = err instanceof Error ? err.message : "未知错误"
      const time = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
      setMessages((prev) => {
        const latestAiIndex = [...prev].reverse().findIndex((m) => m.role === "ai")
        if (latestAiIndex === -1) return prev

        const actualIndex = prev.length - 1 - latestAiIndex
        return prev.map((m, index) => {
          if (index !== actualIndex) return m

          const nextWorkflowProgress = m.workflowProgress
            ? m.workflowProgress.status === "error"
              ? m.workflowProgress
              : handleWorkflowStopped(m.workflowProgress, errMsg)
            : undefined

          return {
            ...m,
            waiting: false,
            loading: false,
            workflowProgress: nextWorkflowProgress,
            text: m.text || (nextWorkflowProgress ? "" : "抱歉，我暂时无法回答这个问题。请稍后再试，或换个方式提问。"),
            time,
          }
        })
      })
    } finally {
      // 清理当前 controller
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
      }
      setMessages((prev) =>
        prev.map((m) => (m.waiting ? { ...m, waiting: false, loading: false } : m)),
      )
      setIsStreaming(false)
    }
  }

  /* ───── 停止流式生成 ───── */
  const handleStopStreaming = useCallback(() => {
    // 1. 先中止前端流读取
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    // 2. 通知 Dify 服务端停止任务（best-effort，不阻塞 UI）
    const taskId = currentTaskIdRef.current
    const agentId = currentAgentId
    const username = user?.username || "anonymous"
    const isWorkflow = isWorkflowTaskRef.current
    if (taskId) {
      currentTaskIdRef.current = null
      isWorkflowTaskRef.current = false
      stopDifyTask({ agentId, taskId, user: username, isWorkflow })
    }
    setMessages((prev) =>
      prev.map((m) =>
        m.waiting
          ? {
              ...m,
              waiting: false,
              loading: false,
              text: m.text || "(已停止生成)",
              workflowProgress: m.workflowProgress
                ? handleWorkflowStopped(m.workflowProgress, "流程已停止")
                : m.workflowProgress,
            }
          : m,
      ),
    )
    setIsStreaming(false)
    // 静默处理，不显示提示
  }, [currentAgentId, user])

  /* ───── 重试工作流请求 ───── */
  const handleRetryWorkflow = async () => {
    const lastRequest = lastRequestRef.current
    if (!lastRequest) {
      warning("没有可重试的请求")
      return
    }

    // 构建新的消息列表
    const time = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
    const newMessages: Message[] = [...messages]
    
    // 添加 AI 等待消息
    newMessages.push({ 
      role: "ai", 
      text: "", 
      time, 
      workflowProgress: createInitialProgress(),
      waiting: true, 
      thinking: "", 
      thinkingComplete: false 
    })
    setMessages(newMessages)

    // 重新调用 API
    callDifyAPI(lastRequest.userText, newMessages, lastRequest.files, lastRequest.userAttachments)
  }

  /* ───── 发送消息（异步：先上传文件，再合并到 chat 请求） ───── */
  const handleSendMessage = async (text: string) => {
    if (isStreaming) {
      warning("请等待当前回复完成")
      return
    }

    const time = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
    const newMessages: Message[] = [...messages]

    // 合并文字和附件到一条用户消息
    newMessages.push({
      role: "user",
      text: text || (uploadedImages.length > 0 || uploadedFiles.length > 0 ? "" : ""),
      images: uploadedImages.length > 0 ? [...uploadedImages] : undefined,
      files: uploadedFiles.length > 0 ? [...uploadedFiles] : undefined,
      time,
    })

    // 先收集所有原始 File 对象，然后清空 UI 状态
    const allRawFiles = [...rawImageFiles, ...rawDocFiles]
    const userAttachments: MessageFileAttachment[] = allRawFiles.map((file) => ({
      name: file.name,
      size: file.size,
      mime_type: file.type || undefined,
      type: file.type.startsWith("image/") ? "image" : "document",
    }))
    setUploadedImages([])
    setUploadedFiles([])
    setRawImageFiles([])
    setRawDocFiles([])

    newMessages.push({ 
      role: "ai", 
      text: "", 
      time, 
      workflowProgress: createInitialProgress(),
      waiting: true, 
      thinking: "", 
      thinkingComplete: false 
    })
    setMessages(newMessages)

    // 如果有附件，先上传到 Dify 获取 upload_file_id，再合并到 chat 请求
    let difyFiles: Array<{ type: string; transfer_method: string; upload_file_id: string }> | undefined

    if (allRawFiles.length > 0) {
      try {
        const uploadedRefs = await uploadFilesToDify(
          allRawFiles,
          user?.username || "anonymous",
          currentAgentId,
        )
        difyFiles = uploadedRefs.map((ref) => ({
          type: ref.type,
          transfer_method: "local_file",
          upload_file_id: ref.upload_file_id,
        }))
      } catch (uploadErr) {
        const errMsg = uploadErr instanceof Error ? uploadErr.message : "附件上传失败"
        error(`附件上传失败: ${errMsg}`)
        // 上传失败时仍然发送文本消息，不带 files
      }
    }

    // 保存请求上下文，用于重试
    lastRequestRef.current = {
      userText: text || "请分析我上传的文件",
      files: difyFiles,
      userAttachments,
    }

    callDifyAPI(text || "请分析我上传的文件", newMessages, difyFiles, userAttachments)
  }

  const handleImageUpload = (dataUrl: string, rawFile: File) => {
    setUploadedImages((prev) => [...prev, dataUrl])
    setRawImageFiles((prev) => [...prev, rawFile])
  }

  const handleFileUpload = (file: { name: string; size: number }, rawFile: File) => {
    setUploadedFiles((prev) => [...prev, file])
    setRawDocFiles((prev) => [...prev, rawFile])
  }

  const handleRemoveImage = (idx: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== idx))
    setRawImageFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleRemoveFile = (idx: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== idx))
    setRawDocFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleVoiceToggle = () => {
    setIsRecording(!isRecording)
    if (!isRecording) {
      info("正在录音，再次点击结束")
    }
  }

  const agentNames = Object.fromEntries(activeAgentDefs.map((d) => [d.id, d.label]))

  /* ───── 加载中状态 ───── */
  if (loadingData) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          gridTemplateColumns: "320px minmax(0, 1fr)",
          background: "var(--background)",
          color: "var(--text-secondary)",
        }}
      >
        <div
          style={{
            borderRight: "1px solid var(--border)",
            padding: "20px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            background: "var(--sidebar)",
          }}
        >
          <div
            style={{
              width: "140px",
              height: "18px",
              borderRadius: "999px",
              background: "var(--secondary)",
            }}
          />
          <div
            style={{
              width: "100%",
              height: "44px",
              borderRadius: "16px",
              background: "var(--secondary)",
            }}
          />
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              style={{
                width: "100%",
                height: "56px",
                borderRadius: "16px",
                background: "var(--secondary)",
                opacity: 1 - index * 0.08,
              }}
            />
          ))}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          <div
            style={{
              height: "64px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 24px",
            }}
          >
            <div
              style={{
                width: "120px",
                height: "18px",
                borderRadius: "999px",
                background: "var(--secondary)",
              }}
            />
            <div style={{ display: "flex", gap: "12px" }}>
              {Array.from({ length: 2 }).map((_, index) => (
                <div
                  key={index}
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "12px",
                    background: "var(--secondary)",
                  }}
                />
              ))}
            </div>
          </div>
          <div
            style={{
              flex: 1,
              padding: "32px 24px 20px",
              display: "flex",
              flexDirection: "column",
              gap: "18px",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: "min(420px, 72%)",
                height: "24px",
                borderRadius: "999px",
                background: "var(--secondary)",
              }}
            />
            <div
              style={{
                width: "min(560px, 86%)",
                height: "14px",
                borderRadius: "999px",
                background: "var(--secondary)",
              }}
            />
            <div
              style={{
                width: "min(760px, 92%)",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "14px",
                marginTop: "10px",
              }}
            >
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  style={{
                    height: "64px",
                    borderRadius: "18px",
                    background: "var(--secondary)",
                    opacity: 1 - index * 0.08,
                  }}
                />
              ))}
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              正在准备会话环境与历史记录...
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ───── 渲染 ───── */
  return (
    <div 
      className="app" 
      style={{
        '--sidebar-width': sidebarCollapsed ? '72px' : '320px'
      } as React.CSSProperties}
    >
      <div
        className={`sidebar-overlay ${sidebarOpen ? "open" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* 左侧热点区域 - 用于鼠标悬停展开 */}
      {sidebarCollapsed && (
        <div
          className="sidebar-hotspot"
          onMouseEnter={() => setSidebarHovered(true)}
        />
      )}
      
      <div
        className={sidebarCollapsed ? "sidebar-wrapper" : ""}
        onMouseLeave={() => {
          if (sidebarCollapsed) {
            setSidebarHovered(false)
          }
        }}
      >
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onNewChat={handleNewChat}
          chatHistory={chatHistory}
          agentNames={agentNames}
          onSelectHistory={handleSelectHistory}
          onDeleteHistory={handleDeleteHistory}
          onBulkDeleteHistory={handleBulkDeleteHistory}
          onRenameHistory={handleRenameHistory}
          onOpenSettings={handleOpenSettings}
          activeConversationId={activeConversationId}
          user={user}
          onLogout={logout}
          agentDefs={activeAgentDefs}
          currentAgentId={currentAgentId}
          onSelectAgent={handleSelectAgent}
          collapsed={sidebarCollapsed && !sidebarHovered}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          searchQuery={historySearch}
        />
      </div>

      <main className="main">
        <div className="main-content">
          <Header
            onMenuToggle={() => setSidebarOpen(true)}
            currentTheme={theme}
            onThemeChange={handleThemeChange}
            searchQuery={historySearch}
            onSearchChange={setHistorySearch}
          />

          <ChatArea
            ref={chatAreaRef}
            messages={messages}
            onUseSuggestion={(text) => handleSendMessage(text)}
            isStreaming={isStreaming}
            agentLabel={currentAgentLabel === "未知应用" ? "深海智航" : currentAgentLabel}
            agentDesc={currentAgentDesc}
            quickQuestions={currentAgentQuickQuestions}
            currentAgentId={currentAgentId}
            onRetryWorkflow={handleRetryWorkflow}
            onStopWorkflow={handleStopStreaming}
            onOpenResources={(resources) => {
              setResourceSidebarResources(resources)
              setResourceSidebarOpen(true)
            }}
          />

          <InputArea
            uploadedImages={uploadedImages}
            uploadedFiles={uploadedFiles}
            onSendMessage={handleSendMessage}
            onImageUpload={handleImageUpload}
            onFileUpload={handleFileUpload}
            onRemoveImage={handleRemoveImage}
            onRemoveFile={handleRemoveFile}
            onVoiceToggle={handleVoiceToggle}
            isRecording={isRecording}
            disabled={isStreaming}
            isStreaming={isStreaming}
            onStopStreaming={handleStopStreaming}
            agentLabel={currentAgentLabel === "未知应用" ? "深海智航" : currentAgentLabel}
            onOpenSettings={handleOpenSettings}
          />
        </div>

        <ResourceSidebar
          isOpen={resourceSidebarOpen}
          onClose={() => setResourceSidebarOpen(false)}
          resources={resourceSidebarResources}
        />
      </main>

      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
