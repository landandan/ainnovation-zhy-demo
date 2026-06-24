"use client"

import { forwardRef } from "react"
import type { Message } from "@/app/page"
import { MessageBubble } from "./message-bubble"
import { ThinkingBlock } from "./thinking-block"

interface ChatAreaProps {
  messages: Message[]
  onUseSuggestion: (text: string) => void
  isStreaming?: boolean
}

export const ChatArea = forwardRef<HTMLDivElement, ChatAreaProps>(
  function ChatArea({ messages, onUseSuggestion, isStreaming }, ref) {
    const suggestions = [
      { text: "帮我查询海上钻井平台的安全操作规程", label: "查询安全规程", icon: "📋" },
      { text: "分析离心泵振动数据", label: "振动数据分析", icon: "📈" },
      { text: "校验今日生产日报数据", label: "日报数据校验", icon: "✅" },
      { text: "生成巡检工单", label: "生成巡检工单", icon: "🔍" },
    ]

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
          ref={ref}
          className="flex flex-1 flex-col items-center justify-center overflow-y-auto p-6 text-center"
          style={{ background: "var(--background)" }}
        >
          {/* Glowing logo */}
          <div
            className="mb-8 flex h-24 w-24 items-center justify-center rounded-[24px] text-5xl relative"
            style={{
              background: "linear-gradient(135deg, var(--primary-hover), var(--primary))",
              boxShadow: "0 8px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05) inset",
            }}
          >
            <span className="relative z-10 drop-shadow-lg">🌊</span>
            <div
              className="absolute inset-0 rounded-[24px] opacity-30"
              style={{ background: "var(--gradient-accent)" }}
            />
          </div>

          {/* Title */}
          <h2
            className="mb-3 text-[24px] font-extrabold tracking-tight"
            style={{ color: "var(--foreground)" }}
          >
            深海智航
          </h2>
          <p
            className="mb-8 max-w-[400px] leading-relaxed text-[14px]"
            style={{ color: "var(--text-secondary)" }}
          >
            我已接入中海油勘探开发标准、全海域设备运维资产、安全巡检以及
            <strong style={{ color: "var(--accent)" }}>海能生产日报填报平台</strong>
            。请在下方选择专属业务智能体开始协同作业。
          </p>

          {/* Suggestion cards */}
          <div className="flex flex-wrap justify-center gap-3 max-w-[520px]">
            {suggestions.map((s) => (
              <button
                key={s.label}
                onClick={() => onUseSuggestion(s.text)}
                className="group flex items-center gap-3 rounded-2xl border px-5 py-4 text-left transition-all duration-200 hover:-translate-y-1"
                style={{
                  background: "var(--card)",
                  borderColor: "var(--border)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent)"
                  e.currentTarget.style.boxShadow = "var(--shadow-lg)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)"
                  e.currentTarget.style.boxShadow = ""
                }}
              >
                <span className="text-2xl flex-shrink-0">{s.icon}</span>
                <div>
                  <div className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                    {s.label}
                  </div>
                  <div
                    className="text-[11px] mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: "var(--accent)" }}
                  >
                    点击开始 →
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )
    }

    // Conversation view
    return (
      <div
        ref={ref}
        className="flex flex-1 flex-col gap-5 overflow-y-auto p-4 sm:p-6"
        style={{ background: "var(--background)" }}
      >
        {messages.map((msg, idx) => {
          // 首 token 等待阶段：脉冲骨架屏
          if (msg.waiting) {
            return (
              <div
                key={idx}
                className="flex gap-3 self-start"
                style={{ maxWidth: "80%", animation: "messageIn 0.35s ease" }}
              >
                <div
                  className="flex h-[36px] w-[36px] flex-shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
                  style={{
                    background: "var(--gradient-accent)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  AI
                </div>
                <div className="flex flex-col gap-2 min-w-0" style={{ flex: 1 }}>
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
            )
          }

          // 流式中但首 token 尚未到达：继续显示骨架屏
          if (msg.role === "ai" && !msg.text && isStreaming) {
            return (
              <div
                key={idx}
                className="flex gap-3 self-start"
                style={{ maxWidth: "80%", animation: "messageIn 0.35s ease" }}
              >
                <div
                  className="flex h-[36px] w-[36px] flex-shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
                  style={{
                    background: "var(--gradient-accent)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  AI
                </div>
                <div className="flex flex-col gap-2 min-w-0" style={{ flex: 1 }}>
                  {msg.thinking && (
                    <ThinkingBlock text={msg.thinking} isComplete={false} />
                  )}
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
            )
          }

          // 历史遗留 loading 消息（兼容处理）
          if (msg.loading && !msg.text) {
            return (
              <div
                key={idx}
                className="flex gap-3 self-start"
                style={{ maxWidth: "80%", animation: "messageIn 0.35s ease" }}
              >
                <div
                  className="flex h-[36px] w-[36px] flex-shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
                  style={{
                    background: "var(--gradient-accent)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  AI
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
            )
          }

          // ────── 正常消息渲染 ──────
          const isUser = msg.role === "user"
          const hasAttachments = (msg.images && msg.images.length > 0) || (msg.files && msg.files.length > 0)

          return (
            <div
              key={idx}
              className={`flex gap-3 ${isUser ? "flex-row-reverse self-end" : "self-start"}`}
              style={{
                maxWidth: "80%",
                animation: "messageIn 0.35s ease",
              }}
            >
              {/* Avatar */}
              <div
                className="flex h-[36px] w-[36px] flex-shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
                style={{
                  background:
                    isUser ? "var(--gradient-2)" : "var(--gradient-accent)",
                  boxShadow:
                    isUser
                      ? "0 2px 12px rgba(249, 115, 22, 0.3)"
                      : "var(--shadow-sm)",
                }}
              >
                {isUser ? "我" : "AI"}
              </div>

              <div className="flex flex-col gap-1.5 min-w-0">
                {/* AI 思考过程（独立可折叠块，在气泡上方） */}
                {msg.thinking && !msg.waiting && !msg.loading && (
                  <ThinkingBlock
                    text={msg.thinking}
                    isComplete={isUser ? true : !isStreaming || !!msg.text}
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
                {!isUser && msg.text && (
                  <MessageBubble
                    role={msg.role}
                    text={msg.text}
                    time={msg.time}
                  />
                )}

                {/* Timestamp */}
                <div
                  className={`px-2 text-[10px] flex items-center gap-1.5 ${
                    isUser ? "justify-end" : ""
                  }`}
                  style={{ color: "var(--text-muted)" }}
                >
                  {!isUser && (
                    <span style={{ opacity: 0.5 }}>AI · 深海智航</span>
                  )}
                  {msg.time}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  },
)