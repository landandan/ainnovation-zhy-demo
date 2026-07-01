"use client"

import { forwardRef, useState, useEffect, useRef } from "react"
import type { Message } from "@/app/page"
import { MessageBubble } from "./message-bubble"
import { ThinkingBlock } from "./thinking-block"
import { CanvasDragonAvatar } from "./canvas-dragon-avatar"

interface ChatAreaProps {
  messages: Message[]
  onUseSuggestion: (text: string) => void
  isStreaming?: boolean
  agentLabel?: string
  agentDesc?: string
  quickQuestions?: string[]
  currentAgentId?: string
}

export const ChatArea = forwardRef<HTMLDivElement, ChatAreaProps>(
  function ChatArea({ messages, onUseSuggestion, isStreaming, agentLabel = "深海智航", agentDesc, quickQuestions, currentAgentId }, ref) {
    const [showScrollButton, setShowScrollButton] = useState(false)
    const internalRef = useRef<HTMLDivElement>(null)

    const setRefs = (node: HTMLDivElement | null) => {
      ;(internalRef as React.MutableRefObject<HTMLDivElement | null>).current = node
      if (typeof ref === "function") {
        ref(node)
      } else if (ref) {
        ;(ref as React.MutableRefObject<HTMLDivElement | null>).current = node
      }
    }

    const checkScrollPosition = () => {
      const el = internalRef.current
      if (!el) return
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100
      setShowScrollButton(!isNearBottom)
    }

    const scrollToBottom = () => {
      const el = internalRef.current
      if (el) {
        el.scrollTo({
          top: el.scrollHeight,
          behavior: "auto",
        })
      }
    }

    useEffect(() => {
      const el = internalRef.current
      if (!el) return
      el.addEventListener("scroll", checkScrollPosition)
      return () => el.removeEventListener("scroll", checkScrollPosition)
    }, [])

    useEffect(() => {
      const el = internalRef.current
      if (!el) return

      // 使用 requestAnimationFrame 确保在 DOM 更新后执行滚动
      requestAnimationFrame(() => {
        // 判断是否在底部附近 (阈值设为 150px)
        const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150
        
        // 如果最后一条消息是用户发送的，或者正在流式输出且在底部附近，强制滚动到底部
        const lastMessage = messages[messages.length - 1]
        const isLastMessageFromUser = lastMessage?.role === "user"

        // 新增逻辑：如果不是流式输出，且消息列表不为空（通常意味着切换了历史会话或初次加载），强制滚动到底部
        const isInitialLoadOrSwitch = !isStreaming && messages.length > 0;

        if (isNearBottom || isLastMessageFromUser || (isStreaming && isNearBottom) || isInitialLoadOrSwitch) {
          el.scrollTo({
            top: el.scrollHeight,
            behavior: "auto", // 切换会话时使用 auto 瞬间到达底部体验更好
          })
        }

        checkScrollPosition()
      })
    }, [messages, isStreaming])

    const suggestions = quickQuestions?.map((text) => ({ text, label: "" })) || []

    const formatFileSize = (bytes: number) => {
      if (bytes < 1024) return bytes + " B"
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
      return (bytes / (1024 * 1024)).toFixed(1) + " MB"
    }

    /** 渲染用户消息中的附件缩略图行 */
    const renderAttachments = (msg: Message) => {
      const hasImages = msg.images && msg.images.length > 0
      const hasFiles = msg.files && msg.files.length > 0
      if (!hasImages && !hasFiles) return null

      return (
        <div
          className="flex flex-wrap gap-2 mb-2"
          style={{
            padding: "8px 8px 4px 8px",
          }}
        >
          {msg.images?.map((img, idx) => (
            <div
              key={`img-${idx}`}
              className="h-16 w-16 overflow-hidden rounded-xl border shadow-sm"
              style={{
                borderColor: "var(--border)",
              }}
            >
              <img src={img} alt="上传图片" className="h-full w-full object-cover" />
            </div>
          ))}
          {msg.files?.map((file, idx) => (
            <div
              key={`file-${idx}`}
              className="flex h-16 flex-col items-center justify-center gap-0.5 rounded-xl border min-w-[64px] px-2 shadow-sm"
              style={{
                background: "rgba(255,255,255,0.08)",
                borderColor: "var(--border)",
              }}
            >
              <span className="text-lg">📄</span>
              <span
                className="max-w-[56px] truncate text-[9px] font-medium"
                style={{ color: "inherit", opacity: 0.9 }}
              >
                {file.name}
              </span>
            </div>
          ))}
        </div>
      )
    }

    // Empty state
    if (messages.length === 0) {
      return (
        <div
          ref={setRefs}
          className="flex flex-1 flex-col items-center justify-center overflow-y-auto p-6 text-center"
          style={{ background: "var(--background)" }}
        >
          {/* Title */}
          <h2
            className="mb-4 text-[32px] font-extrabold tracking-tight"
            style={{ color: "var(--foreground)" }}
          >
            {`Hi~，我是${agentLabel}智能体`}
          </h2>

          {/* Subtitle */}
          <p
            className="mb-8 text-[18px] font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            {agentDesc && agentDesc.trim() ? agentDesc : "有什么我能帮你的吗?"}
          </p>

          {/* Quick question tags */}
          <div className="flex flex-wrap justify-center gap-3 max-w-[700px]">
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => onUseSuggestion(s.text)}
                className="rounded-full border px-5 py-2.5 text-[13px] transition-all duration-200 hover:-translate-y-0.5"
                style={{
                  background: "var(--card)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent)"
                  e.currentTarget.style.color = "var(--accent)"
                  e.currentTarget.style.boxShadow = "var(--shadow-md)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)"
                  e.currentTarget.style.color = "var(--foreground)"
                  e.currentTarget.style.boxShadow = ""
                }}
              >
                {s.text}
              </button>
            ))}
          </div>
        </div>
      )
    }

    // Conversation view
    return (
      <div
        ref={setRefs}
        className="flex flex-1 flex-col overflow-y-auto"
        style={{ background: "var(--background)" }}
      >
        <div className="flex flex-col gap-5 p-4 sm:p-6 pb-2 max-w-[960px] mx-auto w-full">
        {messages.map((msg, idx) => {
          // 首 token 等待阶段：脉冲骨架屏
          if (msg.waiting) {
            return (
              <div
                key={idx}
                className="flex justify-start"
                style={{ width: "100%", animation: "messageIn 0.35s ease" }}
              >
                <div className="flex items-start gap-3 max-w-[90%]">
                  <div className="flex h-[36px] w-[36px] flex-shrink-0 items-center justify-center">
                    <CanvasDragonAvatar size={36} />
                  </div>
                  <div className="flex flex-col gap-2 min-w-0">
                    {/* 思考过程实时显示（等待态也展示） */}
                    {msg.thinking && (
                      <ThinkingBlock text={msg.thinking} isComplete={false} />
                    )}
                    {/* 脉冲骨架屏 */}
                    <div
                      className="rounded-2xl px-5 py-4 waiting-skeleton"
                      style={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderBottomLeftRadius: "8px",
                        boxShadow: "var(--shadow-sm)",
                      }}
                    >
                      {/* 首 token 等待 loading 图标 */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                          正在思考...
                        </span>
                      </div>
                      <div className="skeleton-line skeleton-line-1" />
                      <div className="skeleton-line skeleton-line-2" />
                      <div className="skeleton-line skeleton-line-3" />
                    </div>
                  </div>
                </div>
              </div>
            )
          }

          // 流式中但首 token 尚未到达：继续显示骨架屏
          if (msg.role === "ai" && !msg.text && isStreaming) {
            return (
              <div
                key={idx}
                className="flex justify-start"
                style={{ width: "100%", animation: "messageIn 0.35s ease" }}
              >
                <div className="flex items-start gap-3 max-w-[90%]">
                  <div className="flex h-[36px] w-[36px] flex-shrink-0 items-center justify-center">
                    <CanvasDragonAvatar size={36} />
                  </div>
                  <div className="flex flex-col gap-2 min-w-0">
                    {/* 等待状态时不显示思考块 */}
                    <div
                      className="rounded-2xl px-5 py-4 waiting-skeleton"
                      style={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderBottomLeftRadius: "8px",
                        boxShadow: "var(--shadow-sm)",
                      }}
                    >
                      {/* 首 token 等待 loading 图标 */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                          正在思考...
                        </span>
                      </div>
                      <div className="skeleton-line skeleton-line-1" />
                      <div className="skeleton-line skeleton-line-2" />
                      <div className="skeleton-line skeleton-line-3" />
                    </div>
                  </div>
                </div>
              </div>
            )
          }

          // 历史遗留 loading 消息（兼容处理）
          if (msg.loading && !msg.text) {
            return (
              <div
                key={idx}
                className="flex justify-start"
                style={{ width: "100%", animation: "messageIn 0.35s ease" }}
              >
                <div className="flex items-start gap-3 max-w-[90%]">
                  <div className="flex h-[36px] w-[36px] flex-shrink-0 items-center justify-center">
                    <CanvasDragonAvatar size={36} />
                  </div>
                  <div
                    className="rounded-2xl px-5 py-4"
                    style={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderBottomLeftRadius: "8px",
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    <div className="typing-indicator">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </div>
                  </div>
                </div>
              </div>
            )
          }

          // ────── 正常消息渲染 ──────
          const isUser = msg.role === "user"
          const hasAttachments = (msg.images && msg.images.length > 0) || (msg.files && msg.files.length > 0)

          return (
            <div
              key={idx}
              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              style={{
                width: "100%",
                animation: "messageIn 0.35s ease",
              }}
            >
              {/* 消息容器 */}
              <div
                className={`flex items-start gap-3 max-w-[90%] ${isUser ? "flex-row-reverse" : "flex-row"}`}
              >
                {/* Avatar - 只显示AI的头像 */}
                {!isUser && (
                  <div className="flex h-[36px] w-[36px] flex-shrink-0 items-center justify-center">
                    <CanvasDragonAvatar size={36} />
                  </div>
                )}

                <div className="flex flex-col gap-1.5 min-w-0">
                  {/* AI 思考过程（独立可折叠块，在气泡上方） */}
                  {console.log("[DEBUG] ThinkingBlock 渲染条件检查:", {
                    "msg.role": msg.role,
                    "msg.thinking": !!msg.thinking,
                    "msg.thinkingLength": msg.thinking?.length,
                    "msg.loading": msg.loading,
                    "msg.waiting": msg.waiting,
                    "msg.thinkingComplete": msg.thinkingComplete,
                    "isStreaming": isStreaming,
                  })}
                  {msg.thinking && !msg.loading && (
                    <ThinkingBlock
                      text={msg.thinking}
                      isComplete={msg.thinkingComplete || !isStreaming}
                      defaultExpanded={isStreaming && !msg.thinkingComplete} // 流式且思考未完成时展开
                      autoCollapse={true} // 思考完成后自动折叠
                    />
                  )}

                  {/* ── 用户消息：附件+文字合并在一个气泡 ── */}
                  {isUser && (msg.text || hasAttachments) && (
                    <div
                      className="rounded-2xl relative group overflow-hidden"
                      style={{
                        background: "var(--accent)",
                        color: "var(--accent-foreground)",
                        borderBottomRightRadius: "8px",
                        boxShadow: "var(--shadow-md)",
                        wordBreak: "break-word",
                      }}
                    >
                      {/* 附件缩略图行（文字上方） */}
                      {hasAttachments && renderAttachments(msg)}

                      {/* 文字内容 */}
                      {msg.text && (
                        <div className="px-4 py-3.5 text-sm leading-relaxed">
                          {msg.text}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── AI 消息：MessageBubble 自带气泡样式，不嵌套 ── */}
                  {!isUser && (msg.text || (msg.files && msg.files.length > 0)) && (
                    <MessageBubble
                      role={msg.role}
                      text={msg.text}
                      time={msg.time}
                      agentId={currentAgentId}
                      attachments={msg.files}
                    />
                  )}

                  {/* Timestamp hidden (Kimi style: 无时间条) */}
                </div>
              </div>
            </div>
          )
        })}

        </div>

        {/* Scroll to bottom button - sticky to the bottom of scroll container */}
        {showScrollButton && (
          <button
            onClick={scrollToBottom}
            className="sticky bottom-2 self-center flex items-center justify-center w-9 h-9 rounded-full shadow-md transition-all duration-200 hover:scale-110 z-10"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--accent)"
              e.currentTarget.style.borderColor = "var(--accent)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-secondary)"
              e.currentTarget.style.borderColor = "var(--border)"
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        )}
      </div>
    )
  },
)
