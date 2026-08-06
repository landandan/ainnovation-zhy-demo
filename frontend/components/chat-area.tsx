"use client"

import { forwardRef, useState, useEffect, useRef, type ReactNode } from "react"
import type { Message, ResourceItem } from "@/app/page"
import { MessageBubble } from "./message-bubble"
import { MessageActions } from "./message-actions"
import { ThinkingBlock } from "./thinking-block"
import { CanvasDragonAvatar } from "./canvas-dragon-avatar"
import { WorkflowProgressComponent } from "./workflow-progress"
import { DownloadLink } from "./download-link"

interface ChatAreaProps {
  messages: Message[]
  onUseSuggestion: (text: string) => void
  isStreaming?: boolean
  agentLabel?: string
  agentDesc?: string
  quickQuestions?: string[]
  currentAgentId?: string
  /** 当前智能体 thinkShow："1" 时展示工作流进度 */
  thinkShow?: string | number
  userId?: number
  onRetryWorkflow?: () => void
  onRetryMessage?: (messageIndex: number) => void
  onStopWorkflow?: () => void
  onOpenResources?: (resources: ResourceItem[]) => void
  /** 空会话时渲染在标题/副标题下方（如输入框、助手卡片） */
  emptyExtra?: ReactNode
}

export const ChatArea = forwardRef<HTMLDivElement, ChatAreaProps>(
  function ChatArea({ messages, onUseSuggestion, isStreaming, agentLabel = "深海智航", agentDesc, quickQuestions, currentAgentId, thinkShow, userId, onRetryWorkflow, onRetryMessage, onStopWorkflow, onOpenResources, emptyExtra }, ref) {
    const [showScrollButton, setShowScrollButton] = useState(false)
    /** data:/blob: URL 用 window.open 常被浏览器拦截，改用页内预览 */
    const [previewImage, setPreviewImage] = useState<{ src: string; name: string } | null>(null)
    const internalRef = useRef<HTMLDivElement>(null)
    const shouldFollowLatestRef = useRef(true)
    const previousMessageCountRef = useRef(messages.length)

    const handleResourceClick = (resources: ResourceItem[]) => {
      onOpenResources?.(resources)
    }

    useEffect(() => {
      if (!previewImage) return
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") setPreviewImage(null)
      }
      window.addEventListener("keydown", onKeyDown)
      return () => window.removeEventListener("keydown", onKeyDown)
    }, [previewImage])

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

    const formatFileSize = (bytes?: number) => {
      if (bytes == null || Number.isNaN(bytes)) return ""
      if (bytes < 1024) return `${bytes} B`
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    }

    const getFileExtLabel = (file: { name: string; mime_type?: string }) => {
      const fromName = file.name.includes(".")
        ? file.name.split(".").pop()?.toUpperCase()
        : ""
      if (fromName) return fromName
      if (file.mime_type?.includes("word")) return "DOCX"
      if (file.mime_type?.includes("pdf")) return "PDF"
      if (file.mime_type?.includes("sheet") || file.mime_type?.includes("excel")) return "XLSX"
      return "FILE"
    }

    /** 用户消息附件：Kimi 风格 — 图片缩略图 + 文件卡片，与文字气泡分离、右对齐 */
    const renderUserAttachments = (msg: Message) => {
      const hasImages = !!(msg.images && msg.images.length > 0)
      const hasFiles = !!(msg.files && msg.files.length > 0)
      if (!hasImages && !hasFiles) return null

      return (
        <div className="chat-user-attachments">
          {hasImages && (
            <div className="chat-user-images">
              {msg.images!.map((img, idx) => (
                <button
                  key={`img-${idx}`}
                  type="button"
                  className="chat-user-image-thumb"
                  onClick={() => setPreviewImage({ src: img, name: `上传图片 ${idx + 1}` })}
                  title="查看原图"
                >
                  <img src={img} alt={`上传图片 ${idx + 1}`} />
                </button>
              ))}
            </div>
          )}
          {hasFiles && (
            <div className="chat-user-files">
              {msg.files!.map((file, idx) => {
                const ext = getFileExtLabel(file)
                const sizeLabel = formatFileSize(file.size)
                const meta = (
                  <>
                    <div className="chat-user-file-icon" aria-hidden>
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="8" y1="13" x2="16" y2="13" />
                        <line x1="8" y1="17" x2="13" y2="17" />
                      </svg>
                    </div>
                    <div className="chat-user-file-meta">
                      <div className="chat-user-file-name" title={file.name}>
                        {file.name}
                      </div>
                      <div className="chat-user-file-sub">
                        {[ext, sizeLabel].filter(Boolean).join(" ")}
                      </div>
                    </div>
                  </>
                )
                const href = file.original_url || (file.file_id ? `/files/${file.file_id}` : "")
                if (href) {
                  return (
                    <DownloadLink
                      key={`file-${idx}`}
                      href={href}
                      label={file.name}
                      agentId={currentAgentId}
                      fileId={file.file_id}
                      className="chat-user-file-card"
                    >
                      {meta}
                    </DownloadLink>
                  )
                }
                return (
                  <div key={`file-${idx}`} className="chat-user-file-card">
                    {meta}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )
    }

    // Empty state
    if (messages.length === 0) {
      return (
        <div
          ref={setRefs}
          className="chat-main flex flex-1 flex-col items-center justify-center overflow-y-auto p-6 text-center"
          style={{ background: "var(--background)" }}
        >
          {/* Title */}
          <h2 className="chat-empty-title mb-3 tracking-tight">
            开始一段新的业务对话
          </h2>

          {/* Subtitle */}
          <p className="chat-empty-subtitle mb-3 max-w-[760px]">
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

          {emptyExtra ? (
            <div className="welcome-empty-extra w-full text-left">
              {emptyExtra}
            </div>
          ) : null}
        </div>
      )
    }

    // Conversation view
    return (
      <div
        ref={setRefs}
        className="chat-main flex flex-1 flex-col overflow-y-auto transition-all duration-300"
        style={{ background: "var(--background)" }}
      >
        <div className="flex flex-col gap-5 p-4 sm:p-6 pb-2 max-w-[960px] mx-auto w-full">
        {messages.map((msg, idx) => {
          const isLatestMessage = idx === messages.length - 1
          // thinkShow === "1" 时才展示工作流进度
          const canShowThink = String(thinkShow ?? "") === "1"
          console.log("canShowThink", canShowThink, thinkShow)
          const visibleWorkflowProgress = 
            canShowThink && msg.workflowProgress && msg.workflowProgress.status !== "idle"
              ? msg.workflowProgress
              : undefined
          console.log("visibleWorkflowProgress", visibleWorkflowProgress, msg.workflowProgress, canShowThink)

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
                    {/* {!visibleWorkflowProgress && msg.thinking && (
                      <ThinkingBlock text={msg.thinking} isComplete={false} />
                    )} */}
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

          // 流式中但首 token 尚未到达：仅最新一条显示骨架屏，避免历史空回复被带上
          if (msg.role === "ai" && !msg.text && isStreaming && isLatestMessage) {
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
                    {/* {!visibleWorkflowProgress && msg.thinking && (
                      <ThinkingBlock
                        text={msg.thinking}
                        isComplete={msg.thinkingComplete}
                        defaultExpanded={!msg.thinkingComplete}
                        autoCollapse={true}
                      />
                    )} */}
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

                <div className={`flex flex-col gap-1.5 min-w-0 ${isUser ? "items-end" : ""}`}>
                  {visibleWorkflowProgress && (
                    <WorkflowProgressComponent
                      progress={visibleWorkflowProgress}
                      onRetry={onRetryWorkflow}
                      onStop={isLatestMessage ? onStopWorkflow : undefined}
                    />
                  )}
                  {/* AI 思考过程（独立可折叠块，在气泡上方） */}
                  {/* {msg.thinking && !msg.loading && !visibleWorkflowProgress && (
                    <ThinkingBlock
                      text={msg.thinking}
                      isComplete={msg.thinkingComplete || !isStreaming}
                      defaultExpanded={isStreaming && !msg.thinkingComplete} // 流式且思考未完成时展开
                      autoCollapse={true} // 思考完成后自动折叠
                    />
                  )} */}

                  {/* ── 用户消息：附件与文字分离，整体右对齐（Kimi 风格） ── */}
                  {isUser && (msg.text || hasAttachments) && (
                    <div className="chat-user-message">
                      {hasAttachments && renderUserAttachments(msg)}
                      {msg.text ? (
                        <div className="chat-user-bubble relative group">
                          <div className="chat-text-body px-4 py-2.5">
                            {msg.text}
                          </div>
                        </div>
                      ) : null}
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

                  {/* ── AI 消息：MessageActions 操作按钮 ── */}
                  {!isUser &&
                    msg.text &&
                    !msg.waiting &&
                    !msg.loading &&
                    !(isStreaming && isLatestMessage) && (
                      <MessageActions
                        text={msg.text}
                        messageId={msg.messageId}
                        agentId={currentAgentId}
                        userId={userId}
                        initialFeedback={msg.feedback ?? null}
                        onRetry={
                          onRetryMessage
                            ? () => onRetryMessage(idx)
                            : isLatestMessage
                              ? onRetryWorkflow
                              : undefined
                        }
                        disabled={isStreaming}
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

      {previewImage ? (
        <div
          className="upload-lightbox"
          onClick={() => setPreviewImage(null)}
          role="dialog"
          aria-modal="true"
          aria-label="查看原图"
        >
          <button
            type="button"
            className="upload-lightbox-close"
            onClick={() => setPreviewImage(null)}
            aria-label="关闭预览"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div className="upload-lightbox-center" onClick={(e) => e.stopPropagation()}>
            <img src={previewImage.src} alt={previewImage.name} className="upload-lightbox-image" />
          </div>
        </div>
      ) : null}
      </div>
    )
  },
)
