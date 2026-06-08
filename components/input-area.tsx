"use client"

import { useState, useRef, useCallback } from "react"

interface InputAreaProps {
  uploadedImages: string[]
  uploadedFiles: { name: string; size: number }[]
  onSendMessage: (text: string) => void
  onImageUpload: (dataUrl: string) => void
  onFileUpload: (file: { name: string; size: number }) => void
  onRemoveImage: (idx: number) => void
  onRemoveFile: (idx: number) => void
  onVoiceToggle: () => void
  isRecording: boolean
  disabled?: boolean
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
        onImageUpload(event.target.result as string)
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    onFileUpload({ name: file.name, size: file.size })
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
      <div className="mx-auto flex max-w-[800px] flex-col gap-3">
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
          className="flex items-end gap-2.5 rounded-2xl border px-3.5 py-2.5 transition-all focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_3px_var(--glow)]"
          style={{
            background: "var(--secondary)",
            borderColor: "transparent",
          }}
        >
          <div className="flex flex-shrink-0 gap-1 pb-0.5">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] transition-all hover:bg-white/10 hover:text-[var(--accent)]"
              style={{ color: "var(--text-secondary)" }}
              title="发送附件"
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <button
              onClick={() => imageInputRef.current?.click()}
              className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] transition-all hover:bg-white/10 hover:text-[var(--accent)]"
              style={{ color: "var(--text-secondary)" }}
              title="发送图片"
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
            </button>
            <button
              onClick={onVoiceToggle}
              className={`flex h-[38px] w-[38px] items-center justify-center rounded-[10px] transition-all hover:bg-white/10 ${
                isRecording ? "text-[var(--accent)]" : ""
              }`}
              style={{
                color: isRecording ? "var(--accent)" : "var(--text-secondary)",
                animation: isRecording ? "recording 1.2s ease-in-out infinite" : undefined,
              }}
              title="语音输入"
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 10a7 7 0 0 0 14 0" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            </button>
          </div>

          <textarea
            ref={textareaRef}
            className="min-h-[38px] max-h-[300px] flex-1 resize-none border-none bg-transparent py-2 text-sm leading-relaxed outline-none transition-height"
            style={{ color: "var(--foreground)", transition: "height 0.15s ease" }}
            rows={1}
            placeholder="输入您的问题... (Shift + Enter 换行, Enter 发送)"
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              autoResize(e.target)
            }}
            onKeyDown={handleKeydown}
          />

          <button
            onClick={handleSend}
            disabled={!hasContent}
            className={`flex h-[38px] w-11 flex-shrink-0 items-center justify-center rounded-xl text-white transition-all ${
              hasContent ? "hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]" : "opacity-50"
            }`}
            style={{
              background: "var(--accent)",
              boxShadow: hasContent ? "var(--shadow-sm)" : undefined,
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
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
