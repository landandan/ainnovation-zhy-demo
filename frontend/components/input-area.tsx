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
    <div
      className="flex-shrink-0 border-t px-6 pb-5 pt-4"
      style={{
        background: "var(--primary)",
        borderColor: "var(--border)",
      }}
    >
      <div className="mx-auto flex max-w-[960px] flex-col gap-3">
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
                <span className="text-lg">📄</span>
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

        {/* Input wrapper */}
        <div
          className="flex flex-col gap-2 rounded-2xl border px-4 py-3 transition-all focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_3px_var(--glow)]"
          style={{
            background: "var(--secondary)",
            borderColor: "transparent",
          }}
        >
          <textarea
            ref={textareaRef}
            className="min-h-[38px] max-h-[300px] flex-1 resize-none border-none bg-transparent py-2 text-sm leading-relaxed outline-none transition-height"
            style={{ color: "var(--foreground)", transition: "height 0.15s ease" }}
            rows={1}
            placeholder={`和${agentLabel}说点什么`}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              autoResize(e.target)
            }}
            onKeyDown={handleKeydown}
          />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-all hover:bg-white/5"
                style={{ color: "var(--text-secondary)" }}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>{agentLabel}</span>
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                className="flex h-9 w-9 items-center justify-center rounded-lg transition-all hover:bg-white/5"
                style={{ color: "var(--text-secondary)" }}
                title="设置"
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex h-9 w-9 items-center justify-center rounded-lg transition-all hover:bg-white/5"
                style={{ color: "var(--text-secondary)" }}
                title="添加附件"
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              {isStreaming ? (
                <button
                  onClick={onStopStreaming}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-white transition-all hover:scale-110 hover:shadow-lg"
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
                  onClick={handleSend}
                  disabled={!hasContent}
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-white transition-all ${
                    hasContent ? "hover:scale-110 hover:shadow-md" : "opacity-50"
                  }`}
                  style={{
                    background: "var(--accent)",
                  }}
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

        {/* Security hint */}
        <div
          className="flex items-center justify-center gap-1.5 text-[10px]"
          style={{ color: "var(--text-muted)" }}
        >
          <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          数据加密传输中 · 您的信息安全受保护
        </div>
      </div>

      {/* Hidden file inputs */}
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
