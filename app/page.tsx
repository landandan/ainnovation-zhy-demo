"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { AgentSection } from "@/components/agent-section"
import { ChatArea } from "@/components/chat-area"
import { InputArea } from "@/components/input-area"
import { Toast } from "@/components/toast"
import { useToast, type ToastType } from "@/components/toast"
import { SettingsPanel } from "@/components/settings-panel"
import {
  loadConversations,
  addConversation,
  deleteConversation,
  saveConversationMessages,
  loadConversationMessages,
  loadActiveConversationId,
  saveActiveConversationId,
  generateConversationId,
} from "@/lib/settings-store"
import type { ConversationMeta } from "@/lib/settings-store"
import {
  callDifyChatStream,
  getDifyConfig,
  AGENT_INPUTS,
} from "@/lib/dify-api"
import { createMockStream } from "@/lib/mock-api"
import type { DifySettings } from "@/lib/settings-store"

export type AgentType = "knowledge" | "inspection" | "repair" | "report"

export interface Message {
  role: "user" | "ai"
  text: string
  image?: string
  file?: { name: string; size: number }
  time: string
  loading?: boolean
}

export interface ChatHistoryItem {
  id: string
  title: string
  agent: AgentType
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
  /* ───── 主题状态 ───── */
  const [theme, setTheme] = useState<ThemeId>("ocean-trench")

  /* ───── 布局状态 ───── */
  const [sidebarOpen, setSidebarOpen] = useState(false)

  /* ───── 设置面板状态 ───── */
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [difyConfigured, setDifyConfigured] = useState(false)
  const [useMock, setUseMock] = useState(true) // 默认启用 Mock 模式

  /* ───── 业务状态 ───── */
  const [currentAgent, setCurrentAgent] = useState<AgentType>("knowledge")
  const [messages, setMessages] = useState<Message[]>([])
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; size: number }[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const chatAreaRef = useRef<HTMLDivElement>(null)

  /* ───── 对话持久化状态 ───── */
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  // Dify conversation_id（用于多轮对话），可能不同于本地 id
  const difyConversationIdRef = useRef<string | null>(null)

  /* ───── Toast hook ───── */
  const { toasts, dismissToast, success, error, warning, info } = useToast()

  const agentNames: Record<AgentType, string> = {
    knowledge: "海油知识库",
    inspection: "AI智能无纸化巡检",
    repair: "AI维修知识库+随身老师傅",
    report: "日报智能填报",
  }

  /* ───── 初始化：检查配置 & 加载活跃对话 ───── */
  useEffect(() => {
    // 检查是否已配置
    try {
      const s = getDifyConfig()
      setDifyConfigured(!!s.apiKey)
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
      agent: c.agentType as AgentType,
      preview: c.preview,
      time: c.time,
      active: c.id === activeConversationId,
    }))
  }, [activeConversationId])

  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([])
  // 同步 chatHistory
  useEffect(() => {
    setChatHistory(buildChatHistory())
  }, [buildChatHistory, activeConversationId, messages])

  /* ───── 持久化当前对话 ───── */
  const persistCurrentConversation = useCallback(
    (msgs: Message[]) => {
      if (!activeConversationId || msgs.length === 0) return

      // 保存消息
      saveConversationMessages(activeConversationId, msgs)

      // 更新对话元数据
      const lastUserMsg = msgs.filter((m) => m.role === "user").pop()
      const preview = lastUserMsg ? lastUserMsg.text.slice(0, 40) : "新对话"

      addConversation({
        id: activeConversationId,
        title: preview.slice(0, 20) || "无标题",
        agentType: currentAgent,
        preview,
        time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
        updatedAt: Date.now(),
      })
    },
    [activeConversationId, currentAgent],
  )

  // 当 messages 变化时自动持久化
  useEffect(() => {
    const realMsgs = messages.filter((m) => !m.loading)
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
  const handleSelectAgent = (agent: AgentType) => {
    setCurrentAgent(agent)
    handleNewChat()
    info(`已切换至${agentNames[agent]}，新会话已开启`)
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
    // 保存当前对话
    if (activeConversationId && messages.length > 0) {
      const realMsgs = messages.filter((m) => !m.loading)
      saveConversationMessages(activeConversationId, realMsgs)
    }

    // 加载选中对话
    const msgs = loadConversationMessages(id)
    setMessages(msgs)
    setActiveConversationId(id)
    saveActiveConversationId(id)
    difyConversationIdRef.current = null // 切换对话时重置 Dify conversation_id
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

  /* ───── 设置面板回调 ───── */
  const handleOpenSettings = () => {
    setSidebarOpen(false)
    setSettingsOpen(true)
  }

  const handleSettingsSaved = (settings: DifySettings) => {
    setDifyConfigured(!!settings.apiKey)
    setUseMock(settings.useMock ?? true)
    success(`API 配置已保存（${settings.useMock ? "Mock 模式" : "真实 API"}）`)
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
      // ─ 分支：Mock 模式 vs 真实 API ─
      let response: Response

      if (useMock || !difyConfigured) {
        // Mock 模式：创建模拟的 ReadableStream，包装为 Response 对象
        const mockStream = createMockStream(currentAgent, userText, difyConversationIdRef.current)
        response = new Response(mockStream, {
          headers: { "Content-Type": "text/event-stream" },
        })
      } else {
        // 真实 Dify API
        response = await callDifyChatStream({
          query: userText,
          user: "admin",
          conversationId: difyConversationIdRef.current,
          inputs: AGENT_INPUTS[currentAgent] || {},
        })
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error("无法读取流式响应")

      const decoder = new TextDecoder()
      let buffer = ""
      let fullAnswer = ""
      let newConversationId: string | null = null
      const aiTime = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })

      // 创建一个占位 AI 消息
      let messageIndex = -1
      setMessages((prev) => {
        messageIndex = prev.length
        return [...prev, { role: "ai", text: "", time: aiTime, loading: true }]
      })

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
              case "message":
                if (event.answer) {
                  fullAnswer += event.answer
                  setMessages((prev) => {
                    const updated = [...prev]
                    if (messageIndex >= 0 && updated[messageIndex]) {
                      updated[messageIndex] = {
                        ...updated[messageIndex],
                        text: fullAnswer,
                        loading: false,
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
                // 确保 loading 关闭
                setMessages((prev) => {
                  const updated = [...prev]
                  if (messageIndex >= 0 && updated[messageIndex]) {
                    updated[messageIndex] = { ...updated[messageIndex], loading: false }
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
                // 忽略工作流事件（或可展示 workflow 运行状态）
                break
            }
          } catch (parseError) {
            // 跳过无法解析的行（可能是 chunked 的 SSE 不完整）
            if (parseError instanceof SyntaxError) continue
            throw parseError
          }
        }
      }

      // 如果是首次对话且得到了 conversation_id，创建新的持久化对话
      if (newConversationId && !activeConversationId) {
        const newId = generateConversationId()
        setActiveConversationId(newId)
        saveActiveConversationId(newId)

        const preview = userText.slice(0, 40)
        addConversation({
          id: newId,
          title: userText.slice(0, 20) || "新对话",
          agentType: currentAgent,
          preview,
          time: aiTime,
          updatedAt: Date.now(),
        })
      }

      // 保存消息
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
        // 移除 loading 消息，如果有的话
        const filtered = prev.filter((m) => !m.loading)
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

    // 清理上传文件
    setUploadedImages([])
    setUploadedFiles([])

    // 更新消息列表（user 消息先上屏）
    setMessages(newMessages)

    // 调用 Dify API（注：使用更新后的消息列表，不含 loading）
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
          currentAgent={currentAgent}
          onSelectAgent={handleSelectAgent}
        />

        <ChatArea
          ref={chatAreaRef}
          messages={messages}
          onUseSuggestion={(text) => handleSendMessage(text)}
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

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={handleSettingsSaved}
      />

      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}