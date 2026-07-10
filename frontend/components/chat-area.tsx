"use client"

import { forwardRef, useState, useEffect, useRef } from "react"
import type { Message, ResourceItem } from "@/app/page"
import { MessageBubble } from "./message-bubble"
import { ThinkingBlock } from "./thinking-block"
import { CanvasDragonAvatar } from "./canvas-dragon-avatar"
import { WorkflowProgressComponent } from "./workflow-progress"

interface ChatAreaProps {
  messages: Message[]
  onUseSuggestion: (text: string) => void
  isStreaming?: boolean
  agentLabel?: string
  agentDesc?: string
  quickQuestions?: string[]
  currentAgentId?: string
  onRetryWorkflow?: () => void
  onStopWorkflow?: () => void
  onOpenResources?: (resources: ResourceItem[]) => void
}

export const ChatArea = forwardRef<HTMLDivElement, ChatAreaProps>(
  function ChatArea({ messages, onUseSuggestion, isStreaming, agentLabel = "深海智航", agentDesc, quickQuestions, currentAgentId, onRetryWorkflow, onStopWorkflow, onOpenResources }, ref) {
    const [showScrollButton, setShowScrollButton] = useState(false)
    const internalRef = useRef<HTMLDivElement>(null)
    const shouldFollowLatestRef = useRef(true)
    const previousMessageCountRef = useRef(messages.length)

    const handleResourceClick = (resources: ResourceItem[]) => {
      onOpenResources?.(resources)
    }

    const setRefs = (node: HTMLDivElement | null) => {
      ;(internalRef as React.MutableRefObject<HTMLDivElement | null>).current = node
      if (typeof ref === "function") {
        ref(node)
      } else if (ref) {
        ;(ref as React.MutableRefObject<HTMLDivElement | null>).current = node
      }
    }

    const isNearBottom = (el: HTMLDivElement, threshold = 120) => {
      return el.scrollHeight - el.scrollTop - el.clientHeight < threshold
    }

    const checkScrollPosition = () => {
      const el = internalRef.current
      if (!el) return
      const nearBottom = isNearBottom(el)
      shouldFollowLatestRef.current = nearBottom
      setShowScrollButton(!nearBottom)
    }

    const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
      const el = internalRef.current
      if (el) {
        shouldFollowLatestRef.current = true
        el.scrollTo({
          top: el.scrollHeight,
          behavior,
        })
        setShowScrollButton(false)
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

      const messageCountChanged = messages.length !== previousMessageCountRef.current
      const messageCountIncreased = messages.length > previousMessageCountRef.current
      previousMessageCountRef.current = messages.length
      const lastMessage = messages[messages.length - 1]
      const isNewUserTurn = messageCountIncreased && lastMessage?.role === "ai"
      const isConversationSwitch = !isStreaming && messageCountChanged && messages.length > 0
      const shouldFollowLatest =
        shouldFollowLatestRef.current ||
        isNewUserTurn ||
        isConversationSwitch ||
        (isStreaming && isNearBottom(el, 220))

      if (isNewUserTurn || isConversationSwitch) {
        shouldFollowLatestRef.current = true
      }

      requestAnimationFrame(() => {
        if (shouldFollowLatest) {
          scrollToBottom("auto")
          return
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
              <div
                className="flex h-7 w-7 items-center justify-center rounded-lg"
                style={{ background: "var(--secondary)", color: "var(--text-secondary)" }}
              >
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="8" y1="13" x2="16" y2="13" />
                  <line x1="8" y1="17" x2="13" y2="17" />
                </svg>
              </div>
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
            className="mb-3 text-[30px] font-extrabold tracking-tight"
            style={{ color: "var(--foreground)" }}
          >
            开始一段新的业务对话
          </h2>

          {/* Subtitle */}
          <p
            className="mb-3 max-w-[760px] text-[16px] font-medium leading-7"
            style={{ color: "var(--text-secondary)" }}
          >
            {agentDesc && agentDesc.trim()
              ? `${agentLabel}已就绪，${agentDesc}`
              : `${agentLabel}已就绪，你可以直接发起问答、上传资料，或从下面的高频任务开始。`}
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
        className="flex flex-1 flex-col overflow-y-auto transition-all duration-300"
        style={{ background: "var(--background)" }}
      >
        <div className="flex flex-col gap-5 p-4 sm:p-6 pb-2 max-w-[960px] mx-auto w-full">
        {messages.map((msg, idx) => {
          const isLatestMessage = idx === messages.length - 1
          const visibleWorkflowProgress =
            msg.workflowProgress && msg.workflowProgress.status !== "idle"
              ? msg.workflowProgress
              : undefined

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
                    {visibleWorkflowProgress && (
                      <WorkflowProgressComponent
                        progress={visibleWorkflowProgress}
                        onRetry={onRetryWorkflow}
                        onStop={isLatestMessage ? onStopWorkflow : undefined}
                      />
                    )}
                    {!visibleWorkflowProgress && msg.thinking && (
                      <ThinkingBlock text={msg.thinking} isComplete={false} />
                    )}
                    {!visibleWorkflowProgress && !msg.thinking && (
                      <div
                        className="rounded-2xl px-5 py-4 waiting-skeleton"
                        style={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderBottomLeftRadius: "8px",
                          boxShadow: "var(--shadow-sm)",
                        }}
                      >
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
                    )}
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
                    {!visibleWorkflowProgress && msg.thinking && (
                      <ThinkingBlock
                        text={msg.thinking}
                        isComplete={msg.thinkingComplete}
                        defaultExpanded={!msg.thinkingComplete}
                        autoCollapse={true}
                      />
                    )}
                    {visibleWorkflowProgress ? (
                      <WorkflowProgressComponent
                        progress={visibleWorkflowProgress}
                        onRetry={onRetryWorkflow}
                        onStop={isLatestMessage ? onStopWorkflow : undefined}
                      />
                    ) : !msg.thinking ? (
                      <div
                        className="rounded-2xl px-5 py-4 waiting-skeleton"
                        style={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderBottomLeftRadius: "8px",
                          boxShadow: "var(--shadow-sm)",
                        }}
                      >
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
                    ) : null}
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
                  {visibleWorkflowProgress && (
                    <WorkflowProgressComponent
                      progress={visibleWorkflowProgress}
                      onRetry={onRetryWorkflow}
                      onStop={isLatestMessage ? onStopWorkflow : undefined}
                    />
                  )}
                  {/* AI 思考过程（独立可折叠块，在气泡上方） */}
                  {msg.thinking && !msg.loading && !visibleWorkflowProgress && (
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

                  {!isUser && msg.resourcesList && msg.resourcesList.length > 0 && (
                    <button
                      onClick={() => handleResourceClick(msg.resourcesList!)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all hover:border-[var(--accent)] hover:bg-[var(--secondary)] group"
                      style={{
                        borderColor: "var(--border)",
                        background: "rgba(255,255,255,0.04)",
                      }}
                    >
                      <div className="flex items-center gap-2.5">
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: "var(--text-muted)" }}>
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="8" y1="13" x2="16" y2="13" />
                          <line x1="8" y1="17" x2="13" y2="17" />
                        </svg>
                        <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                          {msg.resourcesList[0].document_name}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--secondary)", color: "var(--text-muted)" }}>
                          {msg.resourcesList.length}
                        </span>
                      </div>
                      <svg
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        className="transition-transform group-hover:translate-x-0.5"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
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
            type="button"
            onClick={() => scrollToBottom("smooth")}
            aria-label="回到最新消息"
            title="回到最新消息"
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
