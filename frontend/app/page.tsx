"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { ChatArea } from "@/components/chat-area"
import { InputArea } from "@/components/input-area"
import { AgentSection } from "@/components/agent-section"
import { Toast } from "@/components/toast"
import { ResourceSidebar } from "@/components/resource-sidebar"
import { useToast } from "@/components/toast"
import { useAuth } from "@/lib/auth-store"
import {
  getAgents,
  getConversations,
  // createConversation,
  // updateConversation,
  deleteConversationApi,
  renameConversationApi,
  getMessages,
  // addMessage,
  uploadFileSingle,
  extractOssIdFromUpload,
  type AgentDefApi,
  type ConversationApi,
  type MessageApi,
} from "@/lib/api-client"
import { loadTheme, saveTheme } from "@/lib/settings-store"
import {
  callDifyChatStream,
  getAgentInputs,
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
import { getUserSettings, updateUserSettings } from "@/lib/api-client"
import { isAuthenticated } from "@/lib/auth"
import { handleAuthExpired } from "@/lib/http/client"
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
  segment_id?: string
  document_id?: string
}

export interface Message {
  role: "user" | "ai"
  text: string
  /** 原始用户提问（历史消息回填） */
  query?: string
  images?: string[]
  files?: MessageFileAttachment[]
  /** 发送/重试时带给 /h5/chat/stream 的 ossId 列表 */
  inputFiles?: Array<{ ossId: string | number }>
  workflowProgress?: WorkflowProgress
  time: string
  loading?: boolean
  thinking?: string
  thinkingComplete?: boolean
  waiting?: boolean
  resourcesList?: ResourceItem[]
  messageId?: string
  feedback?: "like" | "dislike" | null
}

export interface ChatHistoryItem {
  id: number
  title: string
  agent: string
  preview: string
  time: string
  active: boolean
  sessionId: string
  query?: string
  /** 会话所属智能体 id，对应智能助手列表的 agent.id */
  appId?: string
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
  const status = a.status
  const isActive =
    typeof a.is_active === "boolean"
      ? a.is_active
      : status === true || status === 1 || status === "1" || status === "0" // 接口 status=0 表示可用

  return {
    ...a,
    id: String(a.id),
    label: a.appName || a.label || "",
    icon: a.icon || "🤖",
    desc: a.appDesc || a.desc || "",
    gradient: a.appType || a.gradient || "var(--gradient-1)",
    sortOrder: a.sort_order ?? 0,
    isActive,
    quickQuestions: a.quick_questions || [],
  }
  // return {
  //   id: a.agent_id,
  //   label: a.label,
  //   icon: a.icon,
  //   desc: a.desc,
  //   gradient: a.gradient,
  //   sortOrder: a.sort_order,
  //   isActive: a.is_active,
  //   quickQuestions: a.quick_questions,
  // }
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
      : typeof record.fileUrl === "string"
        ? record.fileUrl.trim()
        : typeof record.url === "string"
          ? record.url.trim()
          : ""
    const fileId = typeof record.file_id === "string"
      ? record.file_id.trim()
      : typeof record.ossId === "string" || typeof record.ossId === "number"
        ? String(record.ossId)
        : typeof record.id === "string"
          ? record.id.trim()
          : ""
    const rawName = typeof record.name === "string"
      ? record.name.trim()
      : typeof record.fileName === "string"
        ? record.fileName.trim()
        : ""
    const name = rawName || (originalUrl ? fileNameFromUrl(originalUrl) : fileId || "附件")
    const fileType = typeof record.fileType === "string"
      ? record.fileType
      : typeof record.type === "string"
        ? record.type
        : undefined

    return [{
      name,
      size: typeof record.size === "number" ? record.size : undefined,
      original_url: originalUrl || undefined,
      file_id: fileId || undefined,
      mime_type: typeof record.mime_type === "string" ? record.mime_type : undefined,
      type: fileType,
    }]
  })
}

/** 从历史消息 inputFileList 拆出图片 URL、文档附件与 ossId */
function splitInputFileList(rawList: unknown[] | undefined): {
  images: string[]
  files: MessageFileAttachment[]
  inputFiles: Array<{ ossId: string | number }>
} {
  if (!Array.isArray(rawList) || rawList.length === 0) {
    return { images: [], files: [], inputFiles: [] }
  }

  const images: string[] = []
  const docs: unknown[] = []
  const inputFiles: Array<{ ossId: string | number }> = []

  for (const item of rawList) {
    if (!item || typeof item !== "object") continue
    const record = item as Record<string, unknown>
    const fileType = String(record.fileType || record.type || "").toLowerCase()
    const url =
      (typeof record.fileUrl === "string" && record.fileUrl.trim()) ||
      (typeof record.original_url === "string" && record.original_url.trim()) ||
      (typeof record.url === "string" && record.url.trim()) ||
      ""

    const ossId = record.ossId
    if (ossId != null && ossId !== "") {
      inputFiles.push({ ossId: ossId as string | number })
    }

    const isImage =
      fileType === "image" ||
      fileType.startsWith("image/") ||
      /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(url) ||
      /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(String(record.fileName || record.name || ""))

    if (isImage && url) {
      images.push(url)
    } else {
      docs.push(item)
    }
  }

  return {
    images,
    files: normalizeMessageAttachments(docs),
    inputFiles,
  }
}

function convertToMarkdown(text: string) {
  text = text.split(`\\n`).join(`\n`)
  
  return text;
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

function dedupeResourcesBySegmentId(resources: ResourceItem[]): ResourceItem[] {
  if (!Array.isArray(resources) || resources.length === 0) return []
  const seen = new Set<string>()
  const result: ResourceItem[] = []
  for (const item of resources) {
    const key =
      typeof item?.segment_id === "string" && item.segment_id.trim()
        ? item.segment_id.trim()
        : ""
    // 无 segment_id 时保留（用下标兜底，避免误删）
    const dedupeKey = key || `__idx_${result.length}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    result.push(item)
  }
  return result
}

/**
 * 将 node_finished.inputs.#context# 按 `\nsource:` 分割为引用来源列表。
 * 无 `\nsource:` 标记时不解析（避免把用户提问等原文误当成引用）。
 */
function parseContextToResources(context: string): ResourceItem[] {
  if (!context || typeof context !== "string" || !context.trim()) return []
  if (!/\nsource:\s*/.test(context)) return []

  const segments = context.split(/\nsource:\s*/).map((s) => s.trim()).filter(Boolean)
  const resources: ResourceItem[] = []

  for (const segment of segments) {
    // 首段可能只是孤立的 ---
    if (/^---+\s*$/.test(segment)) continue

    const headerEnd = segment.indexOf("\n---\n")
    let documentName = "引用来源"
    let content = segment

    if (headerEnd >= 0) {
      const header = segment.slice(0, headerEnd).trim()
      const firstLine = header.split("\n")[0]?.replace(/^---+\s*/, "").trim()
      if (firstLine) documentName = firstLine
      content = segment.slice(headerEnd + "\n---\n".length).trim()
    } else {
      const firstLine = segment.split("\n")[0]?.replace(/^---+\s*/, "").trim()
      if (firstLine) {
        documentName = firstLine
        content = segment.slice(firstLine.length).replace(/^\n+/, "").trim()
      }
    }

    if (!content && documentName === "引用来源") continue
    resources.push({
      document_name: documentName,
      content: content || segment,
    })
  }

  return resources
}

function extractContextFromNodeFinished(event: any): string {
  const inputs = event?.data?.inputs
  if (!inputs || typeof inputs !== "object") return ""
  const context = inputs["#context#"] ?? inputs.context
  return typeof context === "string" ? context : ""
}

function normalizeResources(rawResources: string): ResourceItem[] {
  console.log('rawResources123:', rawResources)
  if (!rawResources) return []

  // 兼容：直接是 context 原文
  if (!rawResources.startsWith("data: ") && rawResources.includes("\nsource:")) {
    return parseContextToResources(rawResources)
  }

  if (!rawResources.startsWith("data: ")) return []
  try {
    const event = JSON.parse(rawResources.slice(6).trim())
    // 优先 message_end 的 retriever_resources
    const fromMeta = event?.metadata?.retriever_resources
    if (Array.isArray(fromMeta) && fromMeta.length > 0) {
      return dedupeResourcesBySegmentId(fromMeta)
    }
    // 否则回退 node_finished 的 context
    const context = extractContextFromNodeFinished(event)
    if (context) {
      return parseContextToResources(context)
    }
    return []
  } catch (e) {
    return []
  }
}

function normalizeFeedback(rating?: string | null): "like" | "dislike" | null {
  if (rating === "like" || rating === "dislike") return rating
  return null
}

function mapMessage(m: MessageApi): Message[] {
  console.log('mapMessage123:', m)
  const result: Message[] = []
  const baseTime = new Date(m.createTime).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
  const resourcesList = normalizeResources(m.retrieverResources)
  const { images, files, inputFiles } = splitInputFileList(m.inputFileList)
  
  if (m.query || images.length > 0 || files.length > 0) {
    const { mainText: userText } = extractThinkingFromContent(m.query || "")
    result.push({
      role: "user",
      text: userText,
      query: m.query,
      images: images.length > 0 ? images : undefined,
      files: files.length > 0 ? files : undefined,
      inputFiles: inputFiles.length > 0 ? inputFiles : undefined,
      thinking: undefined,
      thinkingComplete: true,
      resourcesList: [],
      time: baseTime,
    })
  }
  
  if (m.answer) {
    const content = convertToMarkdown(m.answer)
    const { thinking: aiThinking, mainText: aiText } = extractThinkingFromContent(content)

    result.push({
      role: "ai",
      text: aiText,
      query: m.query,
      thinking: aiThinking || undefined,
      thinkingComplete: true,
      resourcesList,
      time: baseTime,
      messageId: m.messageId,
      feedback: normalizeFeedback(m.rating),
    })
  }
  
  return result
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
  const [conversationsPage, setConversationsPage] = useState(1)
  const [conversationsHasMore, setConversationsHasMore] = useState(false)
  const [loadingMoreConversations, setLoadingMoreConversations] = useState(false)
  const CONVERSATIONS_PAGE_SIZE = 10

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
  /** 上传接口返回的 ossId（与图片/文档预览一一对应） */
  const [imageOssIds, setImageOssIds] = useState<Array<string | number>>([])
  const [docOssIds, setDocOssIds] = useState<Array<string | number>>([])
  const [isRecording, setIsRecording] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [resourceSidebarOpen, setResourceSidebarOpen] = useState(false)
  const [resourceSidebarResources, setResourceSidebarResources] = useState<ResourceItem[]>([])

  /* ───── 对话持久化状态 ───── */
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null)
  const [sessionId, setSessionId] = useState<string>('')
  const difyConversationIdRef = useRef<string | null>(null)

  /* ───── 流式请求中断 ───── */
  const abortControllerRef = useRef<AbortController | null>(null)
  /** 当前 Dify 任务的 task_id（从 SSE 事件中捕获），用于停止生成 */
  const currentTaskIdRef = useRef<string | null>(null)
  /** 当前任务是否为 Workflow 类型（由 SSE 事件判定），用于选择正确的停止端点 */
  const isWorkflowTaskRef = useRef<boolean>(false)
  /**
   * 暂停时传给 /h5/chat/stop：
   * answer ← 页面已拼接的完整答案
   * localMessageId ← 外层 localMessageId
   * messageId ← 内层 message_id
   * sessionId ← 内层 conversation_id
   */
  const stopStreamPayloadRef = useRef<{
    answer: string
    localMessageId: string
    messageId: string
    sessionId: string
  } | null>(null)
  /** 保存当前请求的上下文，用于重试 */
  const lastRequestRef = useRef<{
    userText: string
    userAttachments?: MessageFileAttachment[]
    inputFiles?: Array<{ ossId: string | number }>
  } | null>(null)

  /* ───── Toast hook ───── */
  const { toasts, dismissToast, success, error, warning, info } = useToast()

  const activeAgentDefs = useMemo(
    () => agentDefs.filter((agent) => agent.isActive),
    [agentDefs],
  )
  console.log("🚀 ~  ~ agentDefs: ", agentDefs);
  console.log("🚀 ~ Page ~ activeAgentDefs: ", activeAgentDefs);

  const currentAgent =
    activeAgentDefs.find((d) => d.id === currentAgentId) ?? {}
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
          getConversations({ pageNum: 1, pageSize: CONVERSATIONS_PAGE_SIZE }),
        ])
        console.log("🚀 ~ loadData ~ agentsRes: ", agentsRes);
        console.log("🚀 ~ loadData ~ convsRes: ", convsRes);
        //const convsRes = cRes.data
        if (agentsRes?.data?.length > 0) {
          const mapped = agentsRes.data.map(mapAgentDef)
          setAgentDefs(mapped)
          // 建立 agent id → db id 映射（当前接口 id 即 appId）
          const idMap = new Map<string, number>()
          for (const a of agentsRes.data) {
            const key = String(a.id)
            const numericId = Number(a.id)
            if (key) idMap.set(key, Number.isFinite(numericId) ? numericId : 0)
            if (a.agent_id) idMap.set(String(a.agent_id), Number.isFinite(numericId) ? numericId : 0)
          }
          agentIdToDbId.current = idMap
          const activeMapped = mapped.filter((a) => a.isActive)
          // 首次进入时，如果未选择智能体，默认选择“深海智航”，否则选择第一个启用应用
          if (!currentAgentId) {
            const prefer = activeMapped.find((a) => a.label === "深海智航")?.id
            setCurrentAgentId(prefer || activeMapped[0]?.id || "")
          }
        }

        const rows = convsRes?.data?.rows ?? []
        setConversations(rows)
        setConversationsPage(1)
        const total = convsRes?.data?.total
        setConversationsHasMore(
          typeof total === "number"
            ? rows.length < total
            : rows.length >= CONVERSATIONS_PAGE_SIZE,
        )
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
      id: c.messageId as unknown as number,
      title: c.title,
      agent: c.agent_id_str,
      preview: c.last_message_at ? "最近活跃" : "新对话",
      time: new Date(c.last_message_at || c.createTime).toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      // 用 sessionId 判断选中（item.id 是 messageId，与 c.id 不一致会导致永远不高亮）
      active: Boolean(sessionId) && c.sessionId === sessionId,
      sessionId: c.sessionId || "",
      query: c.query || "",
      appId: c.appId ? String(c.appId) : undefined,
    }))
  }, [conversations, sessionId])

  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([])
  useEffect(() => {
    setChatHistory(buildChatHistory())
  }, [buildChatHistory])

  /* ───── 保存消息到后端（已废弃：旧 /conversations/:id/messages） ───── */
  // const persistMessage = useCallback(
  //   async (
  //     convId: number,
  //     role: string,
  //     content: string,
  //     options?: {
  //       attachments?: MessageFileAttachment[]
  //       difyMessageId?: string
  //     },
  //   ) => {
  //     try {
  //       await addMessage(convId, {
  //         role,
  //         content,
  //         attachments: options?.attachments?.length ? JSON.stringify(options.attachments) : undefined,
  //         dify_message_id: options?.difyMessageId,
  //       })
  //     } catch (err) {
  //       console.error("保存消息失败:", err)
  //     }
  //   },
  //   [],
  // )

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
      saveTheme(newTheme)
      if (isAuthenticated()) {
        // updateUserSettings({ theme: newTheme }).catch(() => {})
      }
      if (document.startViewTransition) {
        document.startViewTransition(() => {
          setTheme(newTheme)
        })
      } else {
        setTheme(newTheme)
      }
    },
    [success],
  )

  /* ───── 智能体切换 ───── */
  const handleSelectAgent = (agentId: string) => {
    refreshConversations()
    if (isStreaming) {
      handleStopStreaming()
    }
    setCurrentAgentId(agentId)
    handleNewChat()
    maybeCloseSidebar()
  }

  const refreshConversations = useCallback(async () => {
    try {
      const convsRes = await getConversations({ pageNum: 1, pageSize: CONVERSATIONS_PAGE_SIZE })
      console.log('🔍 ~ Page ~ frontend/app/page.tsx:707 ~ convsRes:', convsRes);
      const rows = convsRes?.data?.rows ?? []
      setConversations(rows)
      setConversationsPage(1)
      const total = convsRes?.data?.total
      setConversationsHasMore(
        typeof total === "number"
          ? rows.length < total
          : rows.length >= CONVERSATIONS_PAGE_SIZE,
      )
      console.log('convsRes123:', convsRes)
    } catch (err) {
      console.error("刷新会话列表失败:", err)
    }
  }, [])

  const handleLoadMoreConversations = useCallback(async () => {
    if (loadingMoreConversations || !conversationsHasMore) return
    setLoadingMoreConversations(true)
    try {
      const nextPage = conversationsPage + 1
      const convsRes = await getConversations({
        pageNum: nextPage,
        pageSize: CONVERSATIONS_PAGE_SIZE,
      })
      const rows = convsRes?.data?.rows ?? []
      let mergedLength = 0
      setConversations((prev) => {
        const seen = new Set(prev.map((c) => c.sessionId || String(c.messageId)))
        const appended = rows.filter((r) => !seen.has(r.sessionId || String(r.messageId)))
        const next = [...prev, ...appended]
        mergedLength = next.length
        return next
      })
      setConversationsPage(nextPage)
      const total = convsRes?.data?.total
      setConversationsHasMore(
        typeof total === "number"
          ? mergedLength < total
          : rows.length >= CONVERSATIONS_PAGE_SIZE,
      )
    } catch (err) {
      console.error("加载更多会话失败:", err)
    } finally {
      setLoadingMoreConversations(false)
    }
  }, [conversationsHasMore, conversationsPage, loadingMoreConversations])

  const handleNewChat = () => {
    setMessages([])
    setActiveConversationId(null)
    setSessionId(``)
    difyConversationIdRef.current = null
    setSidebarOpen(false)
    setIsStreaming(false)
    setResourceSidebarOpen(false)
    // 清空临时上传的文件和图片
    setUploadedImages([])
    setUploadedFiles([])
    setRawImageFiles([])
    setRawDocFiles([])
    setImageOssIds([])
    setDocOssIds([])
    refreshConversations()
  }

  const handleSelectHistory = async (item: ChatHistoryItem) => {
    try {
      refreshConversations()
      const id = item.id
      console.log('id123:', id)
      console.log('sessionId123:', item.sessionId)
      console.log('item:', item)
      // 从后端加载消息
      const msgsRes = await getMessages(item.sessionId)
      console.log('msgsRes123:', msgsRes)
      
      // 确保消息按正序排列（旧的在前，新的在后）
      const sortedMsgs = [...(msgsRes?.data?.messageList ?? [])].sort(
        (a, b) => new Date(a.createTime).getTime() - new Date(b.createTime).getTime(),
      )

      console.log('sortedMsgs123:', sortedMsgs)
      const mappedMsgs = sortedMsgs.flatMap(mapMessage)
      setResourceSidebarOpen(false)
      setMessages(mappedMsgs)
      setActiveConversationId(id)
      setSessionId(item.sessionId)

      // 用历史会话的 appId 匹配智能助手列表 id，选中对应智能体（不新建会话）
      const appId = item.appId ? String(item.appId) : ""
      if (appId) {
        const matchedAgent = agentDefs.find((a) => String(a.id) === appId)
        if (matchedAgent) {
          setCurrentAgentId(matchedAgent.id)
        } else {
          // 列表里暂时没有时也先写入，避免继续沿用上一个智能体
          setCurrentAgentId(appId)
        }
      }

      difyConversationIdRef.current = null
      maybeCloseSidebar()
    } catch (err) {
      console.error("加载对话消息失败:", err)
      error("加载对话失败")
    }
  }

  const handleDeleteHistory = async (sessionIdToDelete: string) => {
    try {
      await deleteConversationApi(sessionIdToDelete)
      setConversations((prev) => prev.filter((c) => c.sessionId !== sessionIdToDelete))
      if (sessionId === sessionIdToDelete) {
        setMessages([])
        setActiveConversationId(null)
        setSessionId("")
        difyConversationIdRef.current = null
      }
      await refreshConversations()
      success("对话已删除")
    } catch (err) {
      console.error("删除对话失败:", err)
      error("删除失败")
    }
  }

  const handleBulkDeleteHistory = async (sessionIds: string[]) => {
    try {
      const uniqueSessionIds = [...new Set(sessionIds.filter(Boolean))]
      for (const sid of uniqueSessionIds) {
        await deleteConversationApi(sid)
      }
      setConversations((prev) => prev.filter((c) => !uniqueSessionIds.includes(c.sessionId)))
      if (sessionId && uniqueSessionIds.includes(sessionId)) {
        setMessages([])
        setActiveConversationId(null)
        setSessionId("")
        difyConversationIdRef.current = null
      }
      await refreshConversations()
      success(`已删除 ${uniqueSessionIds.length} 条对话`)
    } catch (err) {
      console.error("批量删除对话失败:", err)
      error("批量删除失败")
    }
  }

  const handleRenameHistory = async (sessionIdToRename: string, newTitle: string) => {
    if (!sessionIdToRename || !newTitle.trim()) return
    try {
      await renameConversationApi(sessionIdToRename, newTitle.trim())
      setConversations((prev) =>
        prev.map((c) =>
          c.sessionId === sessionIdToRename
            ? { ...c, title: newTitle.trim(), query: newTitle.trim() }
            : c,
        ),
      )
      await refreshConversations()
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
    userAttachments?: MessageFileAttachment[],
    inputFiles?: Array<{ ossId: string | number }>,
  ) => {
    // 创建新的 AbortController 用于中断
    const controller = new AbortController()
    abortControllerRef.current = controller
    setIsStreaming(true)

    try {
      const response = await callDifyChatStream({
        query: userText,
        user: user?.username || "anonymous",
        userId: user?.id,
        conversationId: difyConversationIdRef.current,
        inputs: getAgentInputs(currentAgentId, agentDefs),
        agentId: currentAgentId,
        signal: controller.signal,
        sessionId: sessionId,
        inputFiles,
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
      let nodeFinishedResourcesList: ResourceItem[] = []
      const assistantAttachments: MessageFileAttachment[] = []
      const aiTime = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
      // 重置当前 task_id 和 workflow 标志（新一轮请求）
      currentTaskIdRef.current = null
      isWorkflowTaskRef.current = false
      stopStreamPayloadRef.current = null

      const messageIndex = allMessages.length - 1

      const syncStopPayload = (outJson: Record<string, unknown>, event: Record<string, unknown>) => {
        const prev = stopStreamPayloadRef.current
        const localMessageId =
          (typeof outJson.localMessageId === "string" && outJson.localMessageId.trim()) ||
          prev?.localMessageId ||
          ""
        const messageId =
          (typeof event.message_id === "string" && event.message_id.trim()) ||
          prev?.messageId ||
          ""
        const conversationId =
          (typeof event.conversation_id === "string" && event.conversation_id.trim()) ||
          prev?.sessionId ||
          ""
        // answer 用页面已拼接内容（优先完整原文，其次展示用主文）
        const answer = rawAssistantContent || fullAnswer || prev?.answer || ""
        if (!answer && !localMessageId && !messageId && !conversationId) return
        stopStreamPayloadRef.current = {
          answer,
          localMessageId,
          messageId,
          sessionId: conversationId,
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        // 非 SSE：整包 JSON，如 {"code":401,"msg":"登录过期，请重新登录"}
        // 正常流是 SSE（data:...），JSON.parse 会失败，必须 try/catch
        try {
          const trimmed = buffer.trim()
          if (trimmed.startsWith("{")) {
            const authPayload = JSON.parse(trimmed) as { code?: number | string; msg?: string }
            if (authPayload.code === 401 || authPayload.code === "401") {
              // 游客：刷新不弹窗；非游客：弹登录框
              handleAuthExpired(
                typeof authPayload.msg === "string" ? authPayload.msg : undefined,
              )
              setIsStreaming(false)
              setMessages((prev) =>
                prev.map((m) =>
                  m.waiting
                    ? {
                        ...m,
                        waiting: false,
                        loading: false,
                        text: authPayload.msg || "登录过期，请重新登录",
                      }
                    : m,
                ),
              )
              return
            }
          }
        } catch {
          // 未拼完整或仍是 SSE 文本，继续按行解析
        }
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        let chunkHasUpdates = false
        let isError = false

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith("data:")) continue
          let outJson = JSON.parse(trimmed.slice(5).trim())
          // SSE 里业务码 401：同样走游客刷新 / 非游客弹窗
          if (outJson.code === 401 || outJson.code === "401") {
            handleAuthExpired(
              typeof outJson.msg === "string" ? outJson.msg : undefined,
            )
            setIsStreaming(false)
            setMessages((prev) =>
              prev.map((m) =>
                m.waiting
                  ? {
                      ...m,
                      waiting: false,
                      loading: false,
                      text: outJson.msg || outJson.localMessage || "登录过期，请重新登录",
                    }
                  : m,
              ),
            )
            try {
              await reader.cancel()
            } catch {
              /* ignore */
            }
            return
          }
          if (outJson.code !== 200) {
            fullAnswer = outJson.localMessage || `哎呀，服务暂时开小差了 😅，请稍后重试。`
            // 业务失败：立即结束流式态，隐藏「停止生成」按钮
            setIsStreaming(false)
            currentTaskIdRef.current = null
            isWorkflowTaskRef.current = false
            stopStreamPayloadRef.current = null
            setMessages((prev) => {
              const updated = [...prev]
              // 优先按发起请求时的下标更新；若状态不同步则回退到最后一条 waiting 的 AI
              let idx = messageIndex
              if (!updated[idx] || updated[idx].role !== "ai") {
                idx = -1
                for (let i = updated.length - 1; i >= 0; i--) {
                  if (updated[i].role === "ai" && (updated[i].waiting || !updated[i].text)) {
                    idx = i
                    break
                  }
                }
              }
              if (idx >= 0 && updated[idx]) {
                updated[idx] = {
                  ...updated[idx],
                  text: fullAnswer,
                  waiting: false,
                  loading: false,
                  thinkingComplete: true,
                  time: aiTime,
                }
              }
              // 清掉其它仍卡在 waiting 的气泡，避免下一条提问时旧消息仍显示「正在思考」
              return updated.map((m) =>
                m.waiting ? { ...m, waiting: false, loading: false } : m,
              )
            })
            try {
              await reader.cancel()
            } catch {
              /* ignore */
            }
            isError = true
            break
          }
          // if (!trimmed.startsWith("data:{code=200, message=data: ")) continue
          // console.log('trimmed123:', line)

          const message = outJson.message
          if (!message || !message.startsWith("data: ")) continue
          const jsonStr = message.slice(6)
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
                {
                  // 从 inputs.#context# / context 解析引用来源（按 \nsource: 分割）
                  const context = extractContextFromNodeFinished(event)
                  if (context) {
                    const parsed = parseContextToResources(context)
                    if (parsed.length > 0) {
                      nodeFinishedResourcesList = parsed
                      // message_end 尚未到来时先展示 node_finished 数据
                      if (!resourcesList || resourcesList.length === 0) {
                        resourcesList = parsed
                      }
                    }
                  }
                }
                chunkHasUpdates = true
                break

              case "workflow_finished":
                setIsStreaming(false)
                refreshConversations()
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
                  syncStopPayload(outJson as Record<string, unknown>, event as Record<string, unknown>)
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
                {
                  // 优先 message_end.metadata.retriever_resources，否则用 node_finished 解析结果
                  const fromEnd = dedupeResourcesBySegmentId(
                    event.metadata?.retriever_resources || [],
                  )
                  resourcesList =
                    fromEnd.length > 0 ? fromEnd : nodeFinishedResourcesList
                }
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

        if (isError) break

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
                ...(assistantDifyMessageId ? { messageId: assistantDifyMessageId } : {}),
              }
            }
            return updated
          })
        }
      }

      // 已废弃：旧 /conversations 创建与消息落库（会话由 /h5/chat/* 管理）
      // if (newDifyConversationId && !activeConversationId) {
      //   try {
      //     const dbAgentId = agentIdToDbId.current.get(currentAgentId)
      //     if (dbAgentId) {
      //       const convRes = await createConversation({
      //         agent_id: dbAgentId,
      //         title: userText.slice(0, 20) || "新对话",
      //       })
      //       const newConv = convRes.conversation
      //       setActiveConversationId(newConv.id)
      //       setConversations((prev) => [newConv, ...prev])
      //       await persistMessage(newConv.id, "user", userText, {
      //         attachments: userAttachments,
      //       })
      //       await persistMessage(newConv.id, "assistant", rawAssistantContent || fullAnswer, {
      //         attachments: assistantAttachments,
      //         difyMessageId: assistantDifyMessageId,
      //       })
      //     }
      //   } catch (err) {
      //     console.error("创建后端对话失败:", err)
      //   }
      // } else if (activeConversationId) {
      //   await persistMessage(activeConversationId, "user", userText, {
      //     attachments: userAttachments,
      //   })
      //   await persistMessage(activeConversationId, "assistant", rawAssistantContent || fullAnswer, {
      //     attachments: assistantAttachments,
      //     difyMessageId: assistantDifyMessageId,
      //   })
      // }
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
    // 先取暂停快照（页面已拼接答案 + ids），再中止流
    const payload = stopStreamPayloadRef.current
    const pageAnswer =
      payload?.answer ||
      [...messages].reverse().find((m) => m.role === "ai")?.text ||
      ""

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    const taskId = currentTaskIdRef.current
    const agentId = currentAgentId
    const isWorkflow = isWorkflowTaskRef.current
    if (agentId && user?.id && (payload || taskId || pageAnswer)) {
      currentTaskIdRef.current = null
      isWorkflowTaskRef.current = false
      stopStreamPayloadRef.current = null
      stopDifyTask({
        agentId,
        taskId: taskId || undefined,
        userId: user.id,
        isWorkflow,
        answer: pageAnswer,
        localMessageId: payload?.localMessageId ?? "",
        messageId: payload?.messageId ?? "",
        sessionId: payload?.sessionId ?? "",
      })
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
  }, [currentAgentId, messages, user])

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

    callDifyAPI(
      lastRequest.userText,
      newMessages,
      lastRequest.userAttachments,
      lastRequest.inputFiles,
    )
  }

  /* ───── 重试指定 AI 回复 ───── */
  const handleRetryMessage = async (messageIndex: number) => {
    if (isStreaming) {
      warning("请等待当前回复完成")
      return
    }

    const aiMsg = messages[messageIndex]
    if (!aiMsg || aiMsg.role !== "ai") return

    let userIndex = messageIndex - 1
    while (userIndex >= 0 && messages[userIndex].role !== "user") {
      userIndex--
    }
    if (userIndex < 0) {
      warning("找不到对应的问题")
      return
    }

    const userMsg = messages[userIndex]
    const truncated = messages.slice(0, messageIndex)
    const time = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
    const newMessages: Message[] = [
      ...truncated,
      {
        role: "ai",
        text: "",
        time,
        workflowProgress: createInitialProgress(),
        waiting: true,
        thinking: "",
        thinkingComplete: false,
      },
    ]
    setMessages(newMessages)

    const hasAttachments = !!(
      userMsg.images?.length ||
      userMsg.files?.length ||
      userMsg.inputFiles?.length
    )
    const userText =
      userMsg.text ||
      (hasAttachments ? "请分析我上传的文件" : "")
    if (!userText) {
      warning("无法重试空问题")
      return
    }

    // 优先用当时保存的 inputFiles；最新一条可回退 lastRequestRef
    const isLatestAi = messageIndex === messages.length - 1
    const inputFiles =
      userMsg.inputFiles?.length
        ? userMsg.inputFiles
        : isLatestAi
          ? lastRequestRef.current?.inputFiles
          : undefined

    lastRequestRef.current = {
      userText,
      userAttachments: userMsg.files,
      inputFiles,
    }
    callDifyAPI(userText, newMessages, userMsg.files, inputFiles)
  }

  /* ───── 发送消息（异步：先上传文件，再合并到 chat 请求） ───── */
  const handleSendMessage = async (text: string) => {
    if (isStreaming) {
      warning("请等待当前回复完成")
      return
    }

    const time = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
    const newMessages: Message[] = [...messages]

    // 先收集 ossId，写入用户消息，便于后续重试带回
    const inputFiles = [...imageOssIds, ...docOssIds]
      .filter((id) => id != null && id !== "")
      .map((ossId) => ({ ossId }))

    // 合并文字和附件到一条用户消息
    newMessages.push({
      role: "user",
      text: text || (uploadedImages.length > 0 || uploadedFiles.length > 0 ? "" : ""),
      images: uploadedImages.length > 0 ? [...uploadedImages] : undefined,
      files: uploadedFiles.length > 0 ? [...uploadedFiles] : undefined,
      inputFiles: inputFiles.length > 0 ? inputFiles : undefined,
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
    setImageOssIds([])
    setDocOssIds([])

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

    // 保存请求上下文，用于重试（附件已在选择时上传，这里只传 inputFiles）
    lastRequestRef.current = {
      userText: text || "请分析我上传的文件",
      userAttachments,
      inputFiles,
    }

    callDifyAPI(text || "请分析我上传的文件", newMessages, userAttachments, inputFiles)
  }

  const handleImageUpload = async (dataUrl: string, rawFile: File) => {
    try {
      const uploadRes = await uploadFileSingle(rawFile)
      const ossId = extractOssIdFromUpload(uploadRes)
      if (ossId == null) {
        throw new Error("上传成功但未返回 ossId")
      }
      setUploadedImages((prev) => [...prev, dataUrl])
      setRawImageFiles((prev) => [...prev, rawFile])
      setImageOssIds((prev) => [...prev, ossId])
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "附件上传失败"
      error(`附件上传失败: ${errMsg}`)
    }
  }

  const handleFileUpload = async (file: { name: string; size: number }, rawFile: File) => {
    try {
      const uploadRes = await uploadFileSingle(rawFile)
      const ossId = extractOssIdFromUpload(uploadRes)
      if (ossId == null) {
        throw new Error("上传成功但未返回 ossId")
      }
      setUploadedFiles((prev) => [...prev, file])
      setRawDocFiles((prev) => [...prev, rawFile])
      setDocOssIds((prev) => [...prev, ossId])
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "附件上传失败"
      error(`附件上传失败: ${errMsg}`)
    }
  }

  const handleRemoveImage = (idx: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== idx))
    setRawImageFiles((prev) => prev.filter((_, i) => i !== idx))
    setImageOssIds((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleRemoveFile = (idx: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== idx))
    setRawDocFiles((prev) => prev.filter((_, i) => i !== idx))
    setDocOssIds((prev) => prev.filter((_, i) => i !== idx))
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
          gridTemplateColumns: "240px minmax(0, 1fr)",
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
  const displayAgentLabel =
    currentAgentLabel === "未知应用" ? "深海智航" : currentAgentLabel
  const isConversationStarted = messages.length > 0
  const inputAreaNode = (
    <InputArea
      uploadedImages={uploadedImages}
      uploadedFiles={uploadedFiles}
      rawDocFiles={rawDocFiles}
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
      agentLabel={displayAgentLabel}
      agent={currentAgent}
      onOpenSettings={handleOpenSettings}
    />
  )

  return (
    <div 
      className="app" 
      style={{
        '--sidebar-width': sidebarCollapsed ? '72px' : '240px'
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
          hasMoreHistory={conversationsHasMore}
          loadingMoreHistory={loadingMoreConversations}
          onLoadMoreHistory={handleLoadMoreConversations}
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

          {isConversationStarted ? (
            <>
              <ChatArea
                messages={messages}
                onUseSuggestion={(text) => handleSendMessage(text)}
                isStreaming={isStreaming}
                agentLabel={displayAgentLabel}
                agentDesc={currentAgentDesc}
                quickQuestions={currentAgentQuickQuestions}
                currentAgentId={currentAgentId}
                userId={user?.id}
                onRetryWorkflow={handleRetryWorkflow}
                onRetryMessage={handleRetryMessage}
                onStopWorkflow={handleStopStreaming}
                onOpenResources={(resources) => {
                  setResourceSidebarResources(resources)
                  setResourceSidebarOpen(true)
                }}
              />
              {inputAreaNode}
            </>
          ) : (
            <ChatArea
              messages={messages}
              onUseSuggestion={(text) => handleSendMessage(text)}
              isStreaming={isStreaming}
              agentLabel={displayAgentLabel}
              agentDesc={currentAgentDesc}
              quickQuestions={currentAgentQuickQuestions}
              currentAgentId={currentAgentId}
              userId={user?.id}
              onRetryWorkflow={handleRetryWorkflow}
              onRetryMessage={handleRetryMessage}
              onStopWorkflow={handleStopStreaming}
              onOpenResources={(resources) => {
                setResourceSidebarResources(resources)
                setResourceSidebarOpen(true)
              }}
              emptyExtra={
                <>
                  {inputAreaNode}
                  <AgentSection
                    variant="cards"
                    agentDefs={activeAgentDefs}
                    currentAgentId={currentAgentId}
                    onSelectAgent={handleSelectAgent}
                  />
                </>
              }
            />
          )}
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
