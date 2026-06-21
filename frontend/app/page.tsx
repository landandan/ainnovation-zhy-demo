"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { AgentSection } from "@/components/agent-section"
import { ChatArea } from "@/components/chat-area"
import { InputArea } from "@/components/input-area"
import { Toast } from "@/components/toast"
import { useToast } from "@/components/toast"
import { useAuth } from "@/lib/auth-store"
import {
  getAgents,
  getConversations,
  createConversation,
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
} from "@/lib/dify-api"
import { getUserSettings, updateUserSettings, isAuthenticated } from "@/lib/api-client"

export interface Message {
  role: "user" | "ai"
  text: string
  images?: string[]
  files?: { name: string; size: number }[]
  time: string
  loading?: boolean
  thinking?: string
  waiting?: boolean
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
  gradient: string
  sortOrder: number
  isActive: boolean
}

/** 20 套主题列表 */
export const THEMES = [
  { id: "ocean-trench", label: "深海暗沟", dark: true, category: "暗色" },
  { id: "industrial-rig", label: "工业钻台", dark: true, category: "暗色" },
  { id: "hse-alert", label: "安全警示", dark: true, category: "暗色" },
  { id: "cyber-matrix", label: "赛博矩阵", dark: true, category: "暗色" },
  { id: "quantum-purple", label: "量子紫晶", dark: true, category: "暗色" },
  { id: "carbon-fiber", label: "碳纤维", dark: true, category: "暗色" },
  { id: "abyssal-blue", label: "深渊蓝", dark: true, category: "暗色" },
  { id: "neon-synthwave", label: "霓虹合成波", dark: true, category: "暗色" },
  { id: "radar-sweep", label: "雷达扫描", dark: true, category: "暗色" },
  { id: "midnight-sand", label: "午夜沙漠", dark: true, category: "暗色" },
  { id: "arctic-ice", label: "北极冰川", dark: false, category: "浅色" },
  { id: "pearl-clean", label: "珍珠白", dark: false, category: "浅色" },
  { id: "control-room", label: "控制室", dark: false, category: "浅色" },
  { id: "safety-first", label: "安全优先", dark: false, category: "浅色" },
  { id: "eco-pipeline", label: "生态管道", dark: false, category: "浅色" },
  { id: "dawn-horizon", label: "黎明地平线", dark: false, category: "浅色" },
  { id: "corporate-tech", label: "企业科技", dark: false, category: "浅色" },
  { id: "data-analytics", label: "数据分析", dark: false, category: "浅色" },
  { id: "desert-oil", label: "沙漠石油", dark: false, category: "浅色" },
  { id: "eink-display", label: "电子墨水", dark: false, category: "浅色" },
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
  }
}

/** 将后端 MessageApi 转为前端 Message */
function mapMessage(m: MessageApi): Message {
  return {
    role: m.role === "assistant" ? "ai" : m.role as "user" | "ai",
    text: m.content,
    time: new Date(m.created_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
  }
}

export default function Page() {
  const { user, logout } = useAuth()
  const router = useRouter()

  /* ───── 主题状态 ───── */
  const [theme, setTheme] = useState<ThemeId>("ocean-trench")
  const [themeLoaded, setThemeLoaded] = useState(false)

  useEffect(() => {
    const saved = loadTheme("ocean-trench") as ThemeId
    setTheme(saved)
    document.documentElement.dataset.theme = saved
    setThemeLoaded(true)
  }, [])

  /* ───── 布局状态 ───── */
  const [sidebarOpen, setSidebarOpen] = useState(false)


  /* ───── 数据状态（从后端 API 加载） ───── */
  const [agentDefs, setAgentDefs] = useState<AgentDef[]>([])
  const [conversations, setConversations] = useState<ConversationApi[]>([])
  const [loadingData, setLoadingData] = useState(true)

  /** agent_id 字符串 → 数据库 id 映射 */
  const agentIdToDbId = useRef<Map<string, number>>(new Map())

  /* ───── 业务状态 ───── */
  const [currentAgentId, setCurrentAgentId] = useState<string>("knowledge")
  const [messages, setMessages] = useState<Message[]>([])
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; size: number }[]>([])
  /* 原始 File 对象，用于上传到 Dify */
  const [rawImageFiles, setRawImageFiles] = useState<File[]>([])
  const [rawDocFiles, setRawDocFiles] = useState<File[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const chatAreaRef = useRef<HTMLDivElement>(null)

  /* ───── 对话持久化状态 ───── */
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null)
  const difyConversationIdRef = useRef<string | null>(null)

  /* ───── 流式请求中断 ───── */
  const abortControllerRef = useRef<AbortController | null>(null)

  /* ───── Toast hook ───── */
  const { toasts, dismissToast, success, error, warning, info } = useToast()

  const currentAgentLabel =
    agentDefs.find((d) => d.id === currentAgentId)?.label ?? "未知应用"

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

        if (agentsRes.agents?.length > 0) {
          setAgentDefs(agentsRes.agents.map(mapAgentDef))
          // 建立 agent_id → db_id 映射
          const idMap = new Map<string, number>()
          for (const a of agentsRes.agents) {
            idMap.set(a.agent_id, a.id)
          }
          agentIdToDbId.current = idMap
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
    async (convId: number, role: string, content: string) => {
      try {
        await addMessage(convId, { role, content })
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
      const t = THEMES.find((t) => t.id === newTheme)
      success(`已切换至${t?.label ?? newTheme}主题`)
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

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  /* ───── 智能体切换 ───── */
  const handleSelectAgent = (agentId: string) => {
    setCurrentAgentId(agentId)
    handleNewChat()
    const def = agentDefs.find((d) => d.id === agentId)
    info(`已切换至${def?.label ?? agentId}，新会话已开启`)
  }

  const handleNewChat = () => {
    setMessages([])
    setActiveConversationId(null)
    difyConversationIdRef.current = null
    setSidebarOpen(false)
    setIsStreaming(false)
    info("已开启新的对话")
  }

  const handleSelectHistory = async (id: number) => {
    try {
      // 从后端加载消息
      const msgsRes = await getMessages(id)
      const mappedMsgs = msgsRes.messages.map(mapMessage)
      setMessages(mappedMsgs)
      setActiveConversationId(id)
      // 切换到该对话所属的智能体
      const conv = conversations.find((c) => c.id === id)
      if (conv) setCurrentAgentId(conv.agent_id_str)
      difyConversationIdRef.current = null
      setSidebarOpen(false)
      info("已切换到历史对话")
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

  /* ───── 设置面板跳转 ───── */
  const handleOpenSettings = () => {
    setSidebarOpen(false)
    router.push("/settings")
  }

  /* ───── 调用后端 Dify 代理（流式） ───── */
  const callDifyAPI = async (
    userText: string,
    allMessages: Message[],
    files?: Array<{ type: string; transfer_method: string; upload_file_id: string }>,
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
      })

      const reader = response.body?.getReader()
      if (!reader) throw new Error("无法读取流式响应")

      const decoder = new TextDecoder()
      let buffer = ""
      let fullAnswer = ""
      let fullThinking = ""
      let firstTokenArrived = false
      let newDifyConversationId: string | null = null
      const aiTime = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })

      const messageIndex = allMessages.length - 1

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
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

            switch (event.event) {
              case "agent_thought":
                if (event.thought) {
                  fullThinking += event.thought
                  chunkHasUpdates = true
                }
                break

              case "message":
                if (event.answer) {
                  if (!firstTokenArrived) firstTokenArrived = true
                  fullAnswer += event.answer
                  chunkHasUpdates = true
                }
                break

              case "message_end":
                if (event.conversation_id) {
                  newDifyConversationId = event.conversation_id
                  difyConversationIdRef.current = newDifyConversationId
                }
                chunkHasUpdates = true
                break

              case "error":
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
                thinking: fullThinking,
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
            await persistMessage(newConv.id, "user", userText)
            await persistMessage(newConv.id, "assistant", fullAnswer)
          }
        } catch (err) {
          console.error("创建后端对话失败:", err)
        }
      } else if (activeConversationId) {
        // 已有对话，追加消息
        await persistMessage(activeConversationId, "user", userText)
        await persistMessage(activeConversationId, "assistant", fullAnswer)
      }
    } catch (err: unknown) {
      // 如果是用户主动取消（AbortError），静默处理，不显示错误
      if (err instanceof DOMException && err.name === "AbortError") {
        // 静默处理，不显示错误 toast
        setMessages((prev) =>
          prev.map((m) =>
            m.waiting ? { ...m, waiting: false } : m,
          ),
        )
        return
      }

      const errMsg = err instanceof Error ? err.message : "未知错误"
      const time = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
      error(`API 调用失败: ${errMsg}`)

      setMessages((prev) => {
        const filtered = prev.filter((m) => !m.loading && !m.waiting)
        return [
          ...filtered,
          {
            role: "ai",
            text: `❌ 调用失败: ${errMsg}`,
            time,
          },
        ]
      })
    } finally {
      // 清理当前 controller
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
      }
      setMessages((prev) =>
        prev.map((m) => (m.waiting ? { ...m, waiting: false } : m)),
      )
      setIsStreaming(false)
    }
  }

  /* ───── 停止流式生成 ───── */
  const handleStopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setMessages((prev) =>
      prev.map((m) =>
        m.waiting ? { ...m, waiting: false, text: m.text || "(已停止生成)" } : m,
      ),
    )
    setIsStreaming(false)
    info("已停止生成")
  }, [info])

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
    setUploadedImages([])
    setUploadedFiles([])
    setRawImageFiles([])
    setRawDocFiles([])

    newMessages.push({ role: "ai", text: "", time, waiting: true })
    setMessages(newMessages)

    // 如果有附件，先上传到 Dify 获取 upload_file_id，再合并到 chat 请求
    let difyFiles: Array<{ type: string; transfer_method: string; upload_file_id: string }> | undefined

    if (allRawFiles.length > 0) {
      try {
        info("正在上传附件...")
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
        success("附件上传完成")
      } catch (uploadErr) {
        const errMsg = uploadErr instanceof Error ? uploadErr.message : "附件上传失败"
        error(`附件上传失败: ${errMsg}`)
        // 上传失败时仍然发送文本消息，不带 files
      }
    }

    callDifyAPI(text || "请分析我上传的文件", newMessages, difyFiles)
  }

  const handleImageUpload = (dataUrl: string, rawFile: File) => {
    setUploadedImages((prev) => [...prev, dataUrl])
    setRawImageFiles((prev) => [...prev, rawFile])
  }

  const handleFileUpload = (file: { name: string; size: number }, rawFile: File) => {
    setUploadedFiles((prev) => [...prev, file])
    setRawDocFiles((prev) => [...prev, rawFile])
    info(`已添加附件：${file.name}`)
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

  const agentNames = Object.fromEntries(agentDefs.map((d) => [d.id, d.label]))

  /* ───── 加载中状态 ───── */
  if (loadingData) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-primary, #0a0e17)",
          color: "var(--text-secondary, #9ca3af)",
        }}
      >
        正在加载...
      </div>
    )
  }

  /* ───── 渲染 ───── */
  return (
    <div className="app">
      <div
        className={`sidebar-overlay ${sidebarOpen ? "open" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={handleNewChat}
        chatHistory={chatHistory}
        agentNames={agentNames}
        onSelectHistory={handleSelectHistory}
        onDeleteHistory={handleDeleteHistory}
        onOpenSettings={handleOpenSettings}
        activeConversationId={activeConversationId}
        user={user}
        onLogout={logout}
      />

      <main className="main">
        <Header
          onMenuToggle={() => setSidebarOpen(true)}
          currentTheme={theme}
          onThemeChange={handleThemeChange}
          user={user}
          onLogout={logout}
        />

        <AgentSection
          agentDefs={agentDefs}
          currentAgentId={currentAgentId}
          onSelectAgent={handleSelectAgent}
        />

        <ChatArea
          ref={chatAreaRef}
          messages={messages}
          onUseSuggestion={(text) => handleSendMessage(text)}
          isStreaming={isStreaming}
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
        />
      </main>

      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}