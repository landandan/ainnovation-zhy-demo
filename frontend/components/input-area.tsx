"use client"

import { useState, useRef, useCallback } from "react"

interface InputAreaProps {
  uploadedImages: string[]
  uploadedFiles: { name: string; size: number }[]
  onSendMessage: (text: string) => void
  onImageUpload: (dataUrl: string, rawFile: File) => void
  onFileUpload: (file: { name: string; size: number }, rawFile: File) => void
  onRemoveImage: (idx: number) => void
  onRemoveFile: (idx: number) => void
  onVoiceToggle: () => void
  isRecording: boolean
  disabled?: boolean
  isStreaming?: boolean
  onStopStreaming?: () => void
  agentLabel?: string
  onOpenSettings?: () => void
}

export function InputArea({
  uploadedImages,
  uploadedFiles,
  onSendMessage,
  onImageUpload,
  onFileUpload,
  onRemoveImage,
  onRemoveFile,
  onVoiceToggle,
  isRecording,
  disabled = false,
  isStreaming = false,
  onStopStreaming,
  agentLabel = "深海智航",
  onOpenSettings,
}: InputAreaProps) {
  const [text, setText] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasContent = text.trim() || uploadedImages.length > 0 || uploadedFiles.length > 0

  const handleSend = useCallback(() => {
    if (!hasContent) return
    onSendMessage(text.trim())
    setText("")
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }, [hasContent, text, onSendMessage])

  const handleKeydown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 300) + "px"
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      if (event.target?.result) {
        onImageUpload(event.target.result as string, file)
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    onFileUpload({ name: file.name, size: file.size }, file)
    e.target.value = ""
  }

  return (
    <div className="input-area-container pt-4">
      <div className="input-area-inner">
        {/* Upload preview */}
        {(uploadedImages.length > 0 || uploadedFiles.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {uploadedImages.map((img, idx) => (
              <div
                key={`img-${idx}`}
                className="group relative h-16 w-16 overflow-hidden rounded-xl border-2 shadow-sm"
                style={{
                  borderColor: "var(--accent)",
                  animation: "fadeSlideUp 0.25s ease",
                }}
              >
                <img src={img} alt="预览" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <button
                  onClick={() => onRemoveImage(idx)}
                  className="absolute right-1.5 top-1.5 flex h-[20px] w-[20px] items-center justify-center rounded-full bg-black/70 text-[11px] text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:scale-110"
                >
                  ✕
                </button>
              </div>
            ))}
            {uploadedFiles.map((file, idx) => (
              <div
                key={`file-${idx}`}
                className="group relative flex h-16 flex-col items-center justify-center gap-0.5 rounded-xl border-2 min-w-[64px] px-2 shadow-sm"
                style={{
                  background: "var(--card)",
                  borderColor: "var(--accent)",
                  animation: "fadeSlideUp 0.25s ease",
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
                  style={{ color: "var(--foreground)" }}
                >
                  {file.name}
                </span>
                <button
                  onClick={() => onRemoveFile(idx)}
                  className="absolute -right-1.5 -top-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-red-500 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-all hover:scale-110 shadow"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 输入框 — Kimi 样式，原有文案与结构 */}
        <div className="input-box">
          <textarea
            ref={textareaRef}
            className="input-box-textarea"
            rows={1}
            placeholder={`和${agentLabel}说点什么`}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              autoResize(e.target)
            }}
            onKeyDown={handleKeydown}
          />

          <div className="input-box-toolbar">
            <div className="flex items-center gap-3">
              <div
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm"
                style={{ color: "var(--text-secondary)", background: "var(--primary)" }}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>当前助手: {agentLabel}</span>
              </div>
            </div>

            <div className="input-box-actions">
              <button
                type="button"
                onClick={onOpenSettings}
                className="input-box-icon-btn"
                title="设置"
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="input-box-icon-btn"
                title="添加附件"
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              {isStreaming ? (
                <button
                  type="button"
                  onClick={onStopStreaming}
                  className="input-box-send"
                  style={{
                    background: "#ef4444",
                    boxShadow: "0 0 16px rgba(239,68,68,0.5)",
                    animation: "pulse-stop 1.8s ease-in-out infinite",
                  }}
                  title="停止生成"
                >
                  <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                  </svg>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!hasContent}
                  className="input-box-send"
                  title="发送"
                >
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="5 12 12 5 19 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="input-box-hint">
          <span>Enter 发送</span>
          <span>Shift + Enter 换行</span>
          <span>支持图片与文档上传</span>
        </div>
      </div>

      <input
        ref={imageInputRef}
        type="file"
        className="hidden"
        accept="image/*"
        onChange={handleImageChange}
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
