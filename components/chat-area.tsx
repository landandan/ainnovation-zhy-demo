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
          // 首 token 等待阶段：脉冲骨架屏（需求2）
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
                  {/* Thinking 思考链（如果有的话，可折叠展开） */}
                  {msg.thinking && (
                    <ThinkingBlock text={msg.thinking} />
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

          return (
            <div
              key={idx}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse self-end" : "self-start"}`}
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
                    msg.role === "user" ? "var(--gradient-2)" : "var(--gradient-accent)",
                  boxShadow:
                    msg.role === "user"
                      ? "0 2px 12px rgba(249, 115, 22, 0.3)"
                      : "var(--shadow-sm)",
                }}
              >
                {msg.role === "user" ? "我" : "AI"}
              </div>

              <div className="flex flex-col gap-1.5 min-w-0">
                {/* Thinking 思考链（消息已完成时，折叠在气泡上方） */}
                {msg.thinking && !msg.waiting && !msg.loading && (
                  <ThinkingBlock text={msg.thinking} isComplete={!isStreaming} />
                )}

                {/* Image attachment */}
                {msg.image && (
                  <img
                    src={msg.image}
                    alt="上传图片"
                    className="mb-1 max-w-[240px] rounded-2xl shadow-lg"
                    style={{ border: "1px solid var(--border)" }}
                  />
                )}

                {/* File attachment */}
                {msg.file && (
                  <div
                    className="mb-1 flex min-w-[200px] items-center gap-3 rounded-2xl px-4 py-3"
                    style={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0"
                      style={{
                        background: "var(--gradient-4)",
                        color: "white",
                      }}
                    >
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className="truncate text-[13px] font-semibold"
                        style={{ color: "var(--foreground)" }}
                      >
                        {msg.file.name}
                      </div>
                      <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {formatFileSize(msg.file.size)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Text bubble with Markdown + LaTeX + copy */}
                {msg.text && (
                  <MessageBubble
                    role={msg.role}
                    text={msg.text}
                    time={msg.time}
                  />
                )}

                {/* Timestamp */}
                <div
                  className={`px-2 text-[10px] flex items-center gap-1.5 ${
                    msg.role === "user" ? "justify-end" : ""
                  }`}
                  style={{ color: "var(--text-muted)" }}
                >
                  {msg.role === "ai" && (
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