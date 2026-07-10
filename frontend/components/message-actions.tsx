"use client"

import { useCallback, useState } from "react"

interface MessageActionsProps {
  text: string
  onRetry?: () => void
  disabled?: boolean
}

export function MessageActions({ text, onRetry, disabled = false }: MessageActionsProps) {
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<"like" | "dislike" | null>(null)

  const plainText = text.replace(/<think>[\s\S]*?<\/think>/, "").trim()

  const handleCopy = useCallback(async () => {
    if (!plainText) return
    try {
      await navigator.clipboard.writeText(plainText)
    } catch {
      const textarea = document.createElement("textarea")
      textarea.value = plainText
      textarea.style.position = "fixed"
      textarea.style.opacity = "0"
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [plainText])

  const handleShare = useCallback(async () => {
    if (!plainText) return
    const shareText = plainText.length > 500 ? `${plainText.slice(0, 500)}…` : plainText
    if (navigator.share) {
      try {
        await navigator.share({ title: "对话分享", text: shareText })
        return
      } catch {
        /* 用户取消或不支持 */
      }
    }
    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }, [plainText])

  const toggleFeedback = (type: "like" | "dislike") => {
    setFeedback((prev) => (prev === type ? null : type))
  }

  return (
    <div className="message-actions" role="toolbar" aria-label="消息操作">
      <button
        type="button"
        className="message-action-btn"
        onClick={handleCopy}
        disabled={disabled || !plainText}
        title={copied ? "已复制" : "复制"}
        aria-label={copied ? "已复制" : "复制"}
      >
        {copied ? (
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>

      {onRetry && (
        <button
          type="button"
          className="message-action-btn"
          onClick={onRetry}
          disabled={disabled}
          title="重试"
          aria-label="重试"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <polyline points="3 4 3 9 8 9" />
          </svg>
        </button>
      )}

      <button
        type="button"
        className="message-action-btn"
        onClick={handleShare}
        disabled={disabled || !plainText}
        title="分享"
        aria-label="分享"
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
          <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
      </button>

      <button
        type="button"
        className={`message-action-btn${feedback === "like" ? " active" : ""}`}
        onClick={() => toggleFeedback("like")}
        disabled={disabled}
        title="点赞"
        aria-label="点赞"
        aria-pressed={feedback === "like"}
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
          <path d="M7 10v12" />
          <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
        </svg>
      </button>

      <button
        type="button"
        className={`message-action-btn${feedback === "dislike" ? " active" : ""}`}
        onClick={() => toggleFeedback("dislike")}
        disabled={disabled}
        title="点踩"
        aria-label="点踩"
        aria-pressed={feedback === "dislike"}
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
          <path d="M17 14V2" />
          <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
        </svg>
      </button>
    </div>
  )
}
