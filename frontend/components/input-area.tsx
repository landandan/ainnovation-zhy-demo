"use client"

import { isGuestUser } from "@/lib/auth";
import { useState, useRef, useCallback, useEffect } from "react"
import LoginModal, { LoginModalRef } from "@/components/login-modal"

interface InputAreaProps {
  uploadedImages: string[]
  uploadedFiles: { name: string; size: number }[]
  rawDocFiles?: File[]
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
  agent?: AgentDef
  onOpenSettings?: () => void
}

type LightboxPreview =
  | { kind: "image"; src: string; name: string }
  | { kind: "pdf"; url: string; name: string }
  | { kind: "text"; content: string; name: string }
  | { kind: "unsupported"; name: string; message: string }

function getExt(name: string) {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/)
  return match?.[1] || ""
}

export function InputArea({
  uploadedImages,
  uploadedFiles,
  rawDocFiles = [],
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
  agent = {},
  onOpenSettings,
}: InputAreaProps) {
  const [text, setText] = useState("")
  const [lightbox, setLightbox] = useState<LightboxPreview | null>(null)
  const [lightboxLoading, setLightboxLoading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const objectUrlRef = useRef<string | null>(null)
  const dragDepthRef = useRef(0)

  const hasContent = text.trim() || uploadedImages.length > 0 || uploadedFiles.length > 0

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  const closeLightbox = useCallback(() => {
    revokeObjectUrl()
    setLightbox(null)
    setLightboxLoading(false)
  }, [revokeObjectUrl])

  useEffect(() => {
    return () => revokeObjectUrl()
  }, [revokeObjectUrl])

  useEffect(() => {
    if (!lightbox && !lightboxLoading) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [lightbox, lightboxLoading, closeLightbox])

  const loginModalRef = useRef<LoginModalRef>(null);
  
  const handleSend = useCallback(() => {
    if (!hasContent) return
    if (isGuestUser() && agent.visible == '1') {
    console.log('🔍 ~ InputArea ~ frontend/components/input-area.tsx:97 ~ isGuestUser():', isGuestUser());
      
      loginModalRef.current?.open()
      return
    }
    onSendMessage(text.trim())
    setText("")
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }, [hasContent, text, onSendMessage])

  const handleKeydown = (e: React.KeyboardEvent) => {
    // Mac 中文等输入法「选词确认」也会产生 Enter；组合输入中不要发送
    if (e.nativeEvent.isComposing || e.keyCode === 229) return

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const addImageFile = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = (event) => {
        if (event.target?.result) {
          onImageUpload(event.target.result as string, file)
        }
      }
      reader.readAsDataURL(file)
    },
    [onImageUpload],
  )

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items?.length) return

      let pastedImage = false
      for (const item of Array.from(items)) {
        if (!item.type.startsWith("image/")) continue
        const blob = item.getAsFile()
        if (!blob) continue

        pastedImage = true
        const ext = blob.type.split("/")[1] || "png"
        const file =
          blob instanceof File && blob.name
            ? blob
            : new File([blob], `截图-${Date.now()}.${ext}`, { type: blob.type || "image/png" })

        addImageFile(file)
      }

      if (pastedImage) {
        e.preventDefault()
      }
    },
    [addImageFile],
  )

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!e.dataTransfer.types.includes("Files")) return
    dragDepthRef.current += 1
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragDepthRef.current -= 1
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0
      setIsDragging(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes("Files")) {
      e.dataTransfer.dropEffect = "copy"
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragDepthRef.current = 0
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files || [])
    if (!files.length) return

    for (const file of files) {
      if (file.type.startsWith("image/")) {
        addImageFile(file)
      } else {
        onFileUpload({ name: file.name, size: file.size }, file)
      }
    }
  }

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 300) + "px"
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    addImageFile(file)
    e.target.value = ""
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type.startsWith("image/")) {
      addImageFile(file)
    } else {
      onFileUpload({ name: file.name, size: file.size }, file)
    }
    e.target.value = ""
  }

  const openImageLightbox = (src: string, index: number) => {
    revokeObjectUrl()
    setLightbox({ kind: "image", src, name: `图片${index + 1}` })
  }

  const openFileLightbox = async (index: number) => {
    const meta = uploadedFiles[index]
    const file = rawDocFiles[index]
    if (!meta) return

    const ext = getExt(meta.name)
    revokeObjectUrl()

    if (!file) {
      setLightbox({
        kind: "unsupported",
        name: meta.name,
        message: "无法预览该附件",
      })
      return
    }

    setLightboxLoading(true)
    try {
      if (file.type === "application/pdf" || ext === "pdf") {
        const url = URL.createObjectURL(file)
        objectUrlRef.current = url
        setLightbox({ kind: "pdf", url, name: meta.name })
        return
      }

      if (
        file.type.startsWith("text/") ||
        ["txt", "md", "json", "csv", "tsv", "log", "xml", "html", "css", "js", "ts"].includes(ext)
      ) {
        const content = await file.text()
        setLightbox({
          kind: "text",
          content: content.slice(0, 200000),
          name: meta.name,
        })
        return
      }

      setLightbox({
        kind: "unsupported",
        name: meta.name,
        message: "该文件类型暂不支持在线预览",
      })
    } catch {
      setLightbox({
        kind: "unsupported",
        name: meta.name,
        message: "预览失败，请稍后重试",
      })
    } finally {
      setLightboxLoading(false)
    }
  }

  return (
    <div className="input-area-container pt-4">
      <div className="input-area-inner">
        <div
          className={`input-box${isDragging ? " is-dragging" : ""}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {isDragging && (
            <div className="input-box-drop-hint" aria-hidden="true">
              松开以上传图片或文件
            </div>
          )}

          {(uploadedImages.length > 0 || uploadedFiles.length > 0) && (
            <div className="upload-preview-list">
              {uploadedFiles.map((file, idx) => {
                const ext = (file.name.split(".").pop() || "FILE").toUpperCase()
                const sizeKb = (file.size / 1024).toFixed(2)
                return (
                  <div
                    key={`file-${idx}`}
                    className="upload-preview-file group"
                    role="button"
                    tabIndex={0}
                    onClick={() => openFileLightbox(idx)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        openFileLightbox(idx)
                      }
                    }}
                  >
                    <div className="upload-preview-file-icon" aria-hidden="true">
                      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="8" y1="13" x2="16" y2="13" />
                        <line x1="8" y1="17" x2="13" y2="17" />
                      </svg>
                    </div>
                    <div className="upload-preview-file-meta">
                      <span className="upload-preview-file-name" title={file.name}>{file.name}</span>
                      <span className="upload-preview-file-sub">{ext} {sizeKb} KB</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveFile(idx)
                      }}
                      className="upload-preview-remove"
                      title="移除"
                      aria-label="移除附件"
                    >
                      ✕
                    </button>
                  </div>
                )
              })}
              {uploadedImages.map((img, idx) => (
                <div
                  key={`img-${idx}`}
                  className="upload-preview-image group"
                  role="button"
                  tabIndex={0}
                  onClick={() => openImageLightbox(img, idx)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      openImageLightbox(img, idx)
                    }
                  }}
                >
                  <img src={img} alt="预览" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveImage(idx)
                    }}
                    className="upload-preview-remove"
                    title="移除"
                    aria-label="移除图片"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

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
            onPaste={handlePaste}
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
              {/* <button
                type="button"
                onClick={onOpenSettings}
                className="input-box-icon-btn"
                title="设置"
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button> */}
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
      <LoginModal ref={loginModalRef} />

      {(lightbox || lightboxLoading) && (
        <div className="upload-lightbox" onClick={closeLightbox} role="dialog" aria-modal="true">
          <button
            type="button"
            className="upload-lightbox-close"
            onClick={closeLightbox}
            aria-label="关闭预览"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div
            className="upload-lightbox-center"
            onClick={(e) => e.stopPropagation()}
          >
            {lightboxLoading ? (
              <div className="upload-lightbox-message">正在加载预览...</div>
            ) : null}

            {lightbox?.kind === "image" && (
              <img src={lightbox.src} alt={lightbox.name} className="upload-lightbox-image" />
            )}

            {lightbox?.kind === "pdf" && (
              <iframe src={lightbox.url} title={lightbox.name} className="upload-lightbox-frame" />
            )}

            {lightbox?.kind === "text" && (
              <div className="upload-lightbox-text">
                <div className="upload-lightbox-text-title">{lightbox.name}</div>
                <pre>{lightbox.content}</pre>
              </div>
            )}

            {lightbox?.kind === "unsupported" && (
              <div className="upload-lightbox-message">
                <div className="upload-lightbox-text-title">{lightbox.name}</div>
                <p>{lightbox.message}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
