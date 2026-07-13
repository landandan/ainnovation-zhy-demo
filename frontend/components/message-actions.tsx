"use client"

import { useCallback, useEffect, useState } from "react"
import { submitMessageFeedback } from "@/lib/api-client"

const LIKE_REASONS = ["准确理解问题", "完成任务能力强", "有帮助", "文风好"]
const DISLIKE_REASONS = ["没有理解问题", "没有完成任务", "编造事实", "废话太多", "文风不好", "信息过时"]

interface MessageActionsProps {
  text: string
  messageId?: string
  agentId?: string
  userId?: number
  initialFeedback?: "like" | "dislike" | null
  onRetry?: () => void
  disabled?: boolean
}

export function MessageActions({
  text,
  messageId,
  agentId,
  userId,
  initialFeedback = null,
  onRetry,
  disabled = false,
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<"like" | "dislike" | null>(initialFeedback)
  const [feedbackModal, setFeedbackModal] = useState<"like" | "dislike" | null>(null)
  const [selectedReasons, setSelectedReasons] = useState<string[]>([])
  const [feedbackText, setFeedbackText] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setFeedback(initialFeedback ?? null)
  }, [initialFeedback])

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

  const openFeedbackModal = (type: "like" | "dislike") => {
    setFeedbackModal(type)
    setSelectedReasons([])
    setFeedbackText("")
  }

  const cancelFeedback = async () => {
    if (!messageId || !agentId || !userId) return

    setSubmitting(true)
    try {
      await submitMessageFeedback({ agentId, messageId, userId })
      setFeedback(null)
    } catch (err) {
      console.error("取消评分失败:", err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleLikeClick = async () => {
    if (!messageId || !agentId || !userId || disabled || submitting) return

    if (feedback === "like") {
      await cancelFeedback()
      return
    }

    openFeedbackModal("like")
  }

  const handleDislikeClick = async () => {
    if (!messageId || !agentId || !userId || disabled || submitting) return

    if (feedback === "dislike") {
      await cancelFeedback()
      return
    }

    openFeedbackModal("dislike")
  }

  const resetFeedbackModal = () => {
    setFeedbackModal(null)
    setSelectedReasons([])
    setFeedbackText("")
  }

  const closeFeedbackModal = () => {
    if (submitting) return
    resetFeedbackModal()
  }

  const toggleReason = (reason: string) => {
    setSelectedReasons((prev) =>
      prev.includes(reason) ? prev.filter((item) => item !== reason) : [...prev, reason],
    )
  }

  const buildFeedbackContent = () => {
    const parts = [...selectedReasons]
    const trimmed = feedbackText.trim()
    if (trimmed) parts.push(trimmed)
    return parts.join("；")
  }

  const handleSubmitFeedback = async () => {
    if (!feedbackModal || !messageId || !agentId || !userId) return

    setSubmitting(true)
    try {
      const content = buildFeedbackContent()
      await submitMessageFeedback({
        agentId,
        messageId,
        userId,
        rating: feedbackModal,
        ...(content ? { content } : {}),
      })
      setFeedback(feedbackModal)
      resetFeedbackModal()
    } catch (err) {
      console.error("提交反馈失败:", err)
    } finally {
      setSubmitting(false)
    }
  }

  const reasonOptions = feedbackModal === "like" ? LIKE_REASONS : DISLIKE_REASONS

  return (
    <>
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
          onClick={handleLikeClick}
          disabled={disabled || submitting}
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
          onClick={handleDislikeClick}
          disabled={disabled || submitting}
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

      {feedbackModal && (
        <>
          <div className="message-feedback-overlay" onClick={closeFeedbackModal} />
          <div className="message-feedback-panel" role="dialog" aria-modal="true" aria-labelledby="message-feedback-title">
            <div className="message-feedback-header">
              <h4 id="message-feedback-title" className="message-feedback-title">
                会努力做得更好
              </h4>
              <button
                type="button"
                className="message-feedback-close"
                onClick={closeFeedbackModal}
                disabled={submitting}
                aria-label="关闭"
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <p className="message-feedback-subtitle">请选择理由帮助我们做得更好</p>
            <div className="message-feedback-tags">
              {reasonOptions.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  className={`message-feedback-tag${selectedReasons.includes(reason) ? " selected" : ""}`}
                  onClick={() => toggleReason(reason)}
                >
                  {reason}
                </button>
              ))}
            </div>
            <textarea
              className="message-feedback-textarea"
              placeholder="欢迎说说你的想法"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={4}
            />
            <div className="message-feedback-actions">
              <button
                type="button"
                className="message-feedback-cancel"
                onClick={closeFeedbackModal}
                disabled={submitting}
              >
                取消
              </button>
              <button
                type="button"
                className="message-feedback-submit"
                onClick={handleSubmitFeedback}
                disabled={submitting || !messageId || !agentId || !userId}
              >
                {submitting ? "提交中..." : "提交反馈"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
