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
import {
  loadConversations,
  addConversation,
  deleteConversation,
  saveConversationMessages,
  loadConversationMessages,
  loadActiveConversationId,
  saveActiveConversationId,
  generateConversationId,
  loadSettings,
  loadTheme,
  saveTheme,
  DEFAULT_AGENT_DEFS,
} from "@/lib/settings-store"
import type { AgentDef } from "@/lib/settings-store"
import {
  callDifyChatStream,
  getDifyConfig,
  getAgentInputs,
} from "@/lib/dify-api"
import { createMockStream } from "@/lib/mock-api"

export interface Message {
  role: "user" | "ai"
  text: string
  image?: string
  file?: { name: string; size: number }
  time: string
  loading?: boolean
  /** thinking 思考链内容（DeepSeek/OpenAI 风格） */
  thinking?: string
  /** 首 token 到达前的 loading 阶段（独立于 message.loading） */
  waiting?: boolean
}

export interface ChatHistoryItem {
  id: string
  title: string
  agent: string
  preview: string
  time: string
  active: boolean
}

/* ───── 20 套主题列表 ───── */
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

export default function Page() {
  /* ───── 主题状态（SSR 一致默认值，客户端从 localStorage 恢复） ───── */
  const [theme, setTheme] = useState<ThemeId>("ocean-trench")
  const [themeLoaded, setThemeLoaded] = useState(false)

  // 客户端挂载后从 localStorage 恢复主题，避免 hydration mismatch
  useEffect(() => {
    const saved = loadTheme("ocean-trench") as ThemeId
    setTheme(saved)
    document.documentElement.dataset.theme = saved
    setThemeLoaded(true)
  }, [])

  const router = useRouter()

  /* ───── 布局状态 ───── */
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [difyConfigured, setDifyConfigured] = useState(false)
  const [useMock, setUseMock] = useState(true)

  /* ───── 动态应用列表 ───── */
  const [agentDefs, setAgentDefs] = useState<AgentDef[]>(DEFAULT_AGENT_DEFS)

  /* ───── 业务状态 ───── */
  const [currentAgentId, setCurrentAgentId] = useState<string>("knowledge")
  const [messages, setMessages] = useState<Message[]>([])
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; size: number }[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const chatAreaRef = useRef<HTMLDivElement>(null)

  /* ───── 对话持久化状态 ───── */
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const difyConversationIdRef = useRef<string | null>(null)

  /* ───── Toast hook ───── */
  const { toasts, dismissToast, success, error, warning, info } = useToast()

  /** 当前应用名称（用于 toast 等展示） */
  const currentAgentLabel =
    agentDefs.find((d) => d.id === currentAgentId)?.label ?? "未知应用"

  /* ───── 初始化：检查配置 & 加载活跃对话 & 同步 agentDefs ───── */
  useEffect(() => {
    // 从 localStorage 加载完整设置
    try {
      const settings = loadSettings()
      setAgentDefs(settings.agentDefs)
      setUseMock(settings.useMock)

      // 判断是否已配置
      const agents = settings.agents || {}
      const anyAgentConfigured =
        Object.values(agents).some((a) => !!(a as { apiKey?: string })?.apiKey)
      const s = getDifyConfig()
      setDifyConfigured(!!s.apiKey || anyAgentConfigured)
    } catch {
      setDifyConfigured(false)
    }

    // 加载上次活跃对话
    const activeId = loadActiveConversationId()
    if (activeId) {
      const msgs = loadConversationMessages(activeId)
      if (msgs.length > 0) {
        setMessages(msgs)
        setActiveConversationId(activeId)
      }
    }
  }, [])

  /* ───── 衍生：build chatHistory from localStorage ───── */
  const buildChatHistory = useCallback((): ChatHistoryItem[] => {
    const conversations = loadConversations()
    return conversations.map((c) => ({
      id: c.id,
      title: c.title,
      agent: c.agentType,
      preview: c.preview,
      time: c.time,
      active: c.id === activeConversationId,
    }))
  }, [activeConversationId])

  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([])
  useEffect(() => {
    setChatHistory(buildChatHistory())
  }, [buildChatHistory, activeConversationId, messages])

  /* ───── 持久化当前对话 ───── */
  const persistCurrentConversation = useCallback(
    (msgs: Message[]) => {
      if (!activeConversationId || msgs.length === 0) return

      saveConversationMessages(activeConversationId, msgs)

      const lastUserMsg = msgs.filter((m) => m.role === "user").pop()
      const preview = lastUserMsg ? lastUserMsg.text.slice(0, 40) : "新对话"

      addConversation({
        id: activeConversationId,
        title: preview.slice(0, 20) || "无标题",
        agentType: currentAgentId,
        preview,
        time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
        updatedAt: Date.now(),
      })
    },
    [activeConversationId, currentAgentId],
  )

  useEffect(() => {
    const realMsgs = messages.filter((m) => !m.loading && !m.waiting)
    if (realMsgs.length > 0) {
      persistCurrentConversation(realMsgs)
    }
  }, [messages, persistCurrentConversation])

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
    saveActiveConversationId(null)
    setSidebarOpen(false)
    setIsStreaming(false)
    info("已开启新的对话")
  }

  const handleSelectHistory = (id: string) => {
    if (activeConversationId && messages.length > 0) {
      const realMsgs = messages.filter((m) => !m.loading && !m.waiting)
      saveConversationMessages(activeConversationId, realMsgs)
    }

    const msgs = loadConversationMessages(id)
    setMessages(msgs)
    setActiveConversationId(id)
    saveActiveConversationId(id)
    difyConversationIdRef.current = null
    setSidebarOpen(false)
    info("已切换到历史对话")
  }

  const handleDeleteHistory = (id: string) => {
    deleteConversation(id)
    if (activeConversationId === id) {
      setMessages([])
      setActiveConversationId(null)
      difyConversationIdRef.current = null
      saveActiveConversationId(null)
    }
    success("对话已删除")
  }

  /* ───── 设置面板跳转 ───── */
  const handleOpenSettings = () => {
    setSidebarOpen(false)
    router.push("/settings")
  }

  /* ───── 调用 Dify API 或 Mock（流式） ───── */
  const callDifyAPI = async (userText: string, allMessages: Message[]) => {
    if (!difyConfigured && !useMock) {
      const time = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "⚠️ 尚未配置 Dify API，请在侧边栏点击「API 设置」配置后重试。",
          time,
        },
      ])
      error("请先配置 Dify API")
      return
    }

    setIsStreaming(true)

    try {
      let response: Response

      if (useMock || !difyConfigured) {
        const mockStream = createMockStream(currentAgentId, userText, difyConversationIdRef.current)
        response = new Response(mockStream, {
          headers: { "Content-Type": "text/event-stream" },
        })
      } else {
        response = await callDifyChatStream({
          query: userText,
          user: "admin",
          conversationId: difyConversationIdRef.current,
          inputs: getAgentInputs(currentAgentId, agentDefs),
          agentId: currentAgentId,
        })
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error("无法读取流式响应")

      const decoder = new TextDecoder()
      let buffer = ""
      let fullAnswer = ""
      let fullThinking = ""
      let firstTokenArrived = false
      let newConversationId: string | null = null
      const aiTime = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })

      // messageIndex 指向 handleSendMessage 中已插入的 waiting 占位消息
      const messageIndex = allMessages.length - 1

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith("data: ")) continue

          const jsonStr = trimmed.slice(6)
          if (jsonStr === "[DONE]") continue

          try {
            const event = JSON.parse(jsonStr)

            switch (event.event) {
              case "agent_thought":
                // 需求1：累积 thinking 过程内容（DeepSeek/OpenAI 风格）
                if (event.thought) {
                  fullThinking += event.thought
                  setMessages((prev) => {
                    const updated = [...prev]
                    if (messageIndex >= 0 && updated[messageIndex]) {
                      updated[messageIndex] = {
                        ...updated[messageIndex],
                        thinking: fullThinking,
                        waiting: false,
                      }
                    }
                    return updated
                  })
                }
                break

              case "message":
                if (event.answer) {
                  // 首 token：清除 waiting 状态，正式切换为流式输出
                  if (!firstTokenArrived) {
                    firstTokenArrived = true
                  }
                  fullAnswer += event.answer
                  setMessages((prev) => {
                    const updated = [...prev]
                    if (messageIndex >= 0 && updated[messageIndex]) {
                      updated[messageIndex] = {
                        ...updated[messageIndex],
                        text: fullAnswer,
                        waiting: false,
                        loading: false,
                        time: aiTime,
                      }
                    }
                    return updated
                  })
                }
                break

              case "message_end":
                if (event.conversation_id) {
                  newConversationId = event.conversation_id
                  difyConversationIdRef.current = newConversationId
                }
                setMessages((prev) => {
                  const updated = [...prev]
                  if (messageIndex >= 0 && updated[messageIndex]) {
                    updated[messageIndex] = {
                      ...updated[messageIndex],
                      waiting: false,
                      loading: false,
                    }
                  }
                  return updated
                })
                break

              case "error":
                throw new Error(event.message || "Dify 返回错误")

              case "workflow_started":
              case "node_started":
              case "node_finished":
              case "workflow_finished":
                break
            }
          } catch (parseError) {
            if (parseError instanceof SyntaxError) continue
            throw parseError
          }
        }
      }

      if (newConversationId && !activeConversationId) {
        const newId = generateConversationId()
        setActiveConversationId(newId)
        saveActiveConversationId(newId)

        const preview = userText.slice(0, 40)
        addConversation({
          id: newId,
          title: userText.slice(0, 20) || "新对话",
          agentType: currentAgentId,
          preview,
          time: aiTime,
          updatedAt: Date.now(),
        })
      }

      setMessages((prev) => {
        const realMsgs = prev.filter((m) => !m.loading)
        saveConversationMessages(activeConversationId || "", realMsgs)
        return prev
      })
    } catch (err: unknown) {
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
      // 确保流结束后清除 waiting 状态（防止 skeleton 残留）
      setMessages((prev) =>
        prev.map((m) => (m.waiting ? { ...m, waiting: false } : m)),
      )
      setIsStreaming(false)
    }
  }

  /* ───── 发送消息 ───── */
  const handleSendMessage = (text: string) => {
    if (isStreaming) {
      warning("请等待当前回复完成")
      return
    }

    const time = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
    const newMessages: Message[] = [...messages]

    if (text) {
      newMessages.push({ role: "user", text, time })
    }

    uploadedImages.forEach((img) => {
      newMessages.push({ role: "user", text: "", image: img, time })
    })

    uploadedFiles.forEach((file) => {
      newMessages.push({ role: "user", text: "", file, time })
    })

    setUploadedImages([])
    setUploadedFiles([])

    // 立即插入一个 waiting 占位消息（需求2：首 token 返回前的 loading）
    newMessages.push({ role: "ai", text: "", time, waiting: true })

    setMessages(newMessages)
    callDifyAPI(text || "请分析我上传的文件", newMessages)
  }

  const handleImageUpload = (dataUrl: string) => {
    setUploadedImages((prev) => [...prev, dataUrl])
  }

  const handleFileUpload = (file: { name: string; size: number }) => {
    setUploadedFiles((prev) => [...prev, file])
    info(`已添加附件：${file.name}`)
  }

  const handleRemoveImage = (idx: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleRemoveFile = (idx: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleVoiceToggle = () => {
    setIsRecording(!isRecording)
    if (!isRecording) {
      info("正在录音，再次点击结束")
    }
  }

  /* ───── 构建 agentNames map（供 sidebar 等显示用） ───── */
  const agentNames = Object.fromEntries(agentDefs.map((d) => [d.id, d.label]))

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
      />

      <main className="main">
        <Header
          onMenuToggle={() => setSidebarOpen(true)}
          currentTheme={theme}
          onThemeChange={handleThemeChange}
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
        />
      </main>

      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}