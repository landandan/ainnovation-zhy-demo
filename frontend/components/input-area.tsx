"use client"

import { isGuestUser } from "@/lib/auth";
import { useState, useRef, useCallback, useEffect } from "react"
import LoginModal, { LoginModalRef } from "@/components/login-modal"
import mammoth from "mammoth"
import type { WorkBook } from "xlsx"
import type { AgentDef } from "./agent-section"
import type { UploadingAttachment } from "@/app/page"

interface InputAreaProps {
  uploadedImages: string[]
  uploadedFiles: { name: string; size: number }[]
  uploadingAttachments?: UploadingAttachment[]
  rawDocFiles?: File[]
  onSendMessage: (text: string) => void
  onImageUpload: (dataUrl: string, rawFile: File) => void
  onFileUpload: (file: { name: string; size: number }, rawFile: File) => void
  onRemoveImage: (idx: number) => void
  onRemoveFile: (idx: number) => void
  onCancelUploading?: (uploadId: string) => void
  onVoiceToggle: () => void
  isRecording: boolean
  disabled?: boolean
  isStreaming?: boolean
  onStopStreaming?: () => void
  agentLabel?: string
  agent?: AgentDef & { visible?: string }
  agentDefs?: Array<{ id: string; label: string; visible?: string }>
  currentAgentId?: string
  /** 切换智能体（会新开对话） */
  onSelectAgent?: (agentId: string) => void
  onOpenSettings?: () => void
}

type LightboxPreview =
  | { kind: "image"; src: string; name: string }
  | { kind: "pdf"; url: string; name: string }
  | { kind: "text"; content: string; name: string }
  | { kind: "html"; content: string; name: string }
  | { kind: "pptx"; name: string }
  | {
      kind: "table"
      name: string
      headers: string[]
      rows: string[][]
      sheetNames?: string[]
      activeSheet?: string
    }
  | { kind: "unsupported"; name: string; message: string }

type PptxViewerInstance = {
  destroy: () => void
}

function getExt(name: string) {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/)
  return match?.[1] || ""
}

async function excelSheetToPreviewTable(sheet: WorkBook["Sheets"][string], maxRows = 120) {
  const XLSX = await import("xlsx")
  const raw = XLSX.utils.sheet_to_json<(string | number | boolean | null | undefined)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as Array<Array<string | number | boolean | null | undefined>>

  if (!raw.length) {
    return { headers: [] as string[], rows: [] as string[][] }
  }

  const headers = (raw[0] || []).map((cell) => String(cell ?? ""))
  const colCount = Math.max(headers.length, ...raw.slice(1, maxRows + 1).map((row) => row.length), 1)
  const normalizedHeaders = Array.from({ length: colCount }, (_, index) => headers[index] || `列 ${index + 1}`)
  const rows = raw.slice(1, maxRows + 1).map((row) =>
    Array.from({ length: colCount }, (_, index) => String(row[index] ?? "")),
  )
  return { headers: normalizedHeaders, rows }
}

async function readSpreadsheetWorkbook(arrayBuffer: ArrayBuffer, extension: string): Promise<WorkBook> {
  const XLSX = await import("xlsx")
  const ext = extension.toLowerCase()

  if (ext === "csv" || ext === "tsv") {
    let text = new TextDecoder("utf-8").decode(arrayBuffer)
    if (text.charCodeAt(0) === 0xfeff) {
      text = text.slice(1)
    }
    try {
      return XLSX.read(text, {
        type: "string",
        FS: ext === "tsv" ? "\t" : ",",
        raw: false,
      })
    } catch {
      return XLSX.read(arrayBuffer, { type: "array", raw: false })
    }
  }

  return XLSX.read(arrayBuffer, { type: "array", cellDates: true, raw: false })
}

async function openSpreadsheetPreview(arrayBuffer: ArrayBuffer, extension: string) {
  const workbook = await readSpreadsheetWorkbook(arrayBuffer, extension)
  const activeSheet = workbook.SheetNames[0]
  if (!activeSheet) {
    throw new Error("该表格文件没有可预览的工作表")
  }
  const { headers, rows } = await excelSheetToPreviewTable(workbook.Sheets[activeSheet])
  return {
    headers,
    rows,
    sheetNames: workbook.SheetNames,
    activeSheet,
    workbook,
  }
}

export function InputArea({
  uploadedImages,
  uploadedFiles,
  uploadingAttachments = [],
  rawDocFiles = [],
  onSendMessage,
  onImageUpload,
  onFileUpload,
  onRemoveImage,
  onRemoveFile,
  onCancelUploading,
  onVoiceToggle,
  isRecording,
  disabled = false,
  isStreaming = false,
  onStopStreaming,
  agentLabel = "深海智航",
  agent = {},
  agentDefs = [],
  currentAgentId = "",
  onSelectAgent,
  onOpenSettings,
}: InputAreaProps) {
  const [text, setText] = useState("")
  const [lightbox, setLightbox] = useState<LightboxPreview | null>(null)
  const [lightboxLoading, setLightboxLoading] = useState(false)
  const [pptxBooting, setPptxBooting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [agentMenuOpen, setAgentMenuOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const objectUrlRef = useRef<string | null>(null)
  const dragDepthRef = useRef(0)
  const pptxContainerRef = useRef<HTMLDivElement | null>(null)
  const pptxViewerRef = useRef<PptxViewerInstance | null>(null)
  const pptxBufferRef = useRef<ArrayBuffer | null>(null)
  const workbookRef = useRef<WorkBook | null>(null)
  const agentMenuRef = useRef<HTMLDivElement | null>(null)

  const hasContent = text.trim() || uploadedImages.length > 0 || uploadedFiles.length > 0
  const hasUploading = uploadingAttachments.some((item) => item.status === "uploading")
  const canSend = hasContent && !hasUploading && !disabled

  const destroyPptxViewer = useCallback(() => {
    try {
      pptxViewerRef.current?.destroy()
    } catch {
      /* ignore */
    }
    pptxViewerRef.current = null
    pptxBufferRef.current = null
    setPptxBooting(false)
    if (pptxContainerRef.current) {
      pptxContainerRef.current.innerHTML = ""
    }
  }, [])

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  const closeLightbox = useCallback(() => {
    revokeObjectUrl()
    destroyPptxViewer()
    workbookRef.current = null
    setLightbox(null)
    setLightboxLoading(false)
  }, [revokeObjectUrl, destroyPptxViewer])

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

  useEffect(() => {
    if (!agentMenuOpen) return
    const onPointerDown = (e: MouseEvent) => {
      if (!agentMenuRef.current?.contains(e.target as Node)) {
        setAgentMenuOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAgentMenuOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [agentMenuOpen])

  const loginModalRef = useRef<LoginModalRef>(null)

  const handlePickAgent = (next: { id: string; label: string; visible?: string }) => {
    setAgentMenuOpen(false)
    if (next.id === currentAgentId) return
    if (next.visible === "1" && isGuestUser()) {
      loginModalRef.current?.open()
      return
    }
    onSelectAgent?.(next.id)
  }

  const handleSend = useCallback(() => {
    if (!canSend) return
    if (isGuestUser() && agent.visible == "1") {
      loginModalRef.current?.open()
      return
    }
    onSendMessage(text.trim())
    setText("")
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }, [canSend, text, onSendMessage, agent])

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
    destroyPptxViewer()
    workbookRef.current = null

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

      // 表格优先走表格预览（不要当纯文本打开）
      if (["csv", "tsv", "xls", "xlsx"].includes(ext)) {
        const arrayBuffer = await file.arrayBuffer()
        const result = await openSpreadsheetPreview(arrayBuffer, ext)
        workbookRef.current = result.workbook
        setLightbox({
          kind: "table",
          name: meta.name,
          headers: result.headers,
          rows: result.rows,
          sheetNames: result.sheetNames,
          activeSheet: result.activeSheet,
        })
        return
      }

      if (
        file.type.startsWith("text/") ||
        ["txt", "md", "json", "log", "xml", "html", "css", "js", "ts"].includes(ext)
      ) {
        const content = await file.text()
        setLightbox({
          kind: "text",
          content: content.slice(0, 200000),
          name: meta.name,
        })
        return
      }

      // Word：本地 File 转 HTML（与消息附件预览同一套能力）
      if (ext === "docx" || ext === "doc") {
        const arrayBuffer = await file.arrayBuffer()
        if (ext === "docx") {
          const result = await mammoth.convertToHtml({ arrayBuffer })
          setLightbox({
            kind: "html",
            content: result.value || "<p>（文档无内容）</p>",
            name: meta.name,
          })
          return
        }
        try {
          const maybeDocx = await mammoth.convertToHtml({ arrayBuffer })
          if (maybeDocx.value?.trim()) {
            setLightbox({ kind: "html", content: maybeDocx.value, name: meta.name })
            return
          }
        } catch {
          // 旧版 .doc 走专用解析
        }
        const { parseMsDocToHtml } = await import("@file-viewer/doc")
        const rendered = await parseMsDocToHtml(arrayBuffer)
        const html = `${rendered.css ? `<style>${rendered.css}</style>` : ""}<div class="msdoc-root">${rendered.html || "<p>（文档无内容）</p>"}</div>`
        setLightbox({ kind: "html", content: html, name: meta.name })
        return
      }

      if (ext === "pptx") {
        pptxBufferRef.current = await file.arrayBuffer()
        setLightbox({ kind: "pptx", name: meta.name })
        return
      }

      if (ext === "ppt") {
        setLightbox({
          kind: "unsupported",
          name: meta.name,
          message: "旧版 .ppt 暂不支持在线预览，请下载后查看。建议使用 .pptx。",
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

  const handleSheetChange = async (sheetName: string) => {
    const workbook = workbookRef.current
    if (!workbook || !workbook.Sheets[sheetName] || lightbox?.kind !== "table") return
    try {
      const { headers, rows } = await excelSheetToPreviewTable(workbook.Sheets[sheetName])
      setLightbox({
        ...lightbox,
        headers,
        rows,
        activeSheet: sheetName,
      })
    } catch {
      /* ignore sheet switch errors */
    }
  }

  // pptx：lightbox 挂载后再初始化 viewer
  useEffect(() => {
    if (lightbox?.kind !== "pptx") return
    const container = pptxContainerRef.current
    const buffer = pptxBufferRef.current
    if (!container || !buffer) return

    let cancelled = false
    setPptxBooting(true)

    ;(async () => {
      try {
        const { PptxViewer } = await import("@file-viewer/pptx")
        await import("@file-viewer/pptx/styles.css")
        if (cancelled) return

        try {
          pptxViewerRef.current?.destroy()
        } catch {
          /* ignore */
        }
        pptxViewerRef.current = null
        container.innerHTML = ""

        const viewer = await PptxViewer.open(buffer, container, {
          fitMode: "contain",
          zoomPercent: 100,
          workerUrl: "/file-viewer/pptx.worker.js",
          workerType: "module",
          onRenderComplete: () => {
            if (!cancelled) setPptxBooting(false)
          },
          onError: () => {
            if (cancelled) return
            setLightbox({
              kind: "unsupported",
              name: lightbox.name,
              message: "PPTX 预览失败，请稍后重试",
            })
            setPptxBooting(false)
          },
        })
        if (cancelled) {
          viewer.destroy()
          return
        }
        pptxViewerRef.current = viewer
        setPptxBooting(false)
      } catch {
        if (!cancelled) {
          setLightbox({
            kind: "unsupported",
            name: lightbox.name,
            message: "PPTX 预览失败，请稍后重试",
          })
        }
      } finally {
        if (!cancelled) setPptxBooting(false)
      }
    })()

    return () => {
      cancelled = true
      try {
        pptxViewerRef.current?.destroy()
      } catch {
        /* ignore */
      }
      pptxViewerRef.current = null
      if (pptxContainerRef.current) {
        pptxContainerRef.current.innerHTML = ""
      }
    }
  }, [lightbox])

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

          {(uploadedImages.length > 0 || uploadedFiles.length > 0 || uploadingAttachments.length > 0) && (
            <div className="upload-preview-list">
              {uploadingAttachments.map((item) => {
                const ext = (item.name.split(".").pop() || "FILE").toUpperCase()
                const isError = item.status === "error"
                const statusText = isError
                  ? item.errorMessage || "上传失败"
                  : item.progress >= 100
                    ? "处理中..."
                    : "上传中..."
                const ringSize = 36
                const stroke = 3
                const radius = (ringSize - stroke) / 2
                const circumference = 2 * Math.PI * radius
                const progress = Math.max(0, Math.min(100, item.progress))
                const dashOffset = circumference * (1 - progress / 100)
                return (
                  <div
                    key={`uploading-${item.id}`}
                    className={`upload-preview-file is-uploading${isError ? " is-error" : ""}`}
                  >
                    <div className="upload-preview-file-icon" aria-hidden="true">
                      {isError ? (
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="9" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                      ) : (
                        <svg
                          className="upload-preview-progress-ring"
                          width={ringSize}
                          height={ringSize}
                          viewBox={`0 0 ${ringSize} ${ringSize}`}
                        >
                          <circle
                            className="upload-preview-progress-track"
                            cx={ringSize / 2}
                            cy={ringSize / 2}
                            r={radius}
                            fill="none"
                            strokeWidth={stroke}
                          />
                          <circle
                            className="upload-preview-progress-value"
                            cx={ringSize / 2}
                            cy={ringSize / 2}
                            r={radius}
                            fill="none"
                            strokeWidth={stroke}
                            strokeDasharray={circumference}
                            strokeDashoffset={dashOffset}
                            strokeLinecap="round"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="upload-preview-file-meta">
                      <span className="upload-preview-file-name" title={item.name}>{item.name}</span>
                      <span className="upload-preview-file-sub">
                        {isError ? statusText : `${ext} · ${statusText}`}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onCancelUploading?.(item.id)}
                      className="upload-preview-remove is-visible"
                      title={isError ? "移除" : "取消上传"}
                      aria-label={isError ? "移除" : "取消上传"}
                    >
                      ✕
                    </button>
                  </div>
                )
              })}
              {uploadedFiles.map((file, idx) => {
                const ext = (file.name.split(".").pop() || "FILE").toUpperCase()
                const sizeKb = ((file.size || 0) / 1024).toFixed(2)
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
              <div className="input-agent-switch" ref={agentMenuRef}>
                <button
                  type="button"
                  className="input-agent-switch-trigger"
                  onClick={() => setAgentMenuOpen((open) => !open)}
                  aria-expanded={agentMenuOpen}
                  aria-haspopup="listbox"
                  title="切换智能助手（将新开对话）"
                >
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span>当前助手: {agentLabel}</span>
                  <svg
                    className={`input-agent-switch-caret${agentMenuOpen ? " open" : ""}`}
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {agentMenuOpen && (
                  <div className="input-agent-switch-menu" role="listbox">
                    {agentDefs.length === 0 ? (
                      <div className="input-agent-switch-empty">暂无可用助手</div>
                    ) : (
                      agentDefs.map((item) => {
                        const active = item.id === currentAgentId
                        return (
                          <button
                            key={item.id}
                            type="button"
                            role="option"
                            aria-selected={active}
                            className={`input-agent-switch-item${active ? " active" : ""}`}
                            onClick={() => handlePickAgent(item)}
                          >
                            <span className="input-agent-switch-item-label">{item.label}</span>
                            {active ? <span className="input-agent-switch-item-check">✓</span> : null}
                          </button>
                        )
                      })
                    )}
                  </div>
                )}
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
                  disabled={!canSend}
                  className="input-box-send"
                  title={hasUploading ? "附件上传中，请稍候" : "发送"}
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

            {lightbox?.kind === "html" && (
              <div className="upload-lightbox-docx">
                <div className="upload-lightbox-text-title">{lightbox.name}</div>
                <div
                  className="upload-lightbox-docx-body"
                  dangerouslySetInnerHTML={{ __html: lightbox.content }}
                />
              </div>
            )}

            {lightbox?.kind === "pptx" && (
              <div className="upload-lightbox-pptx-wrap">
                <div className="upload-lightbox-text-title">{lightbox.name}</div>
                {pptxBooting ? (
                  <div className="upload-lightbox-message">正在加载演示文稿...</div>
                ) : null}
                <div ref={pptxContainerRef} className="upload-lightbox-pptx" />
              </div>
            )}

            {lightbox?.kind === "table" && (
              <div className="upload-lightbox-table-wrap">
                <div className="upload-lightbox-text-title">{lightbox.name}</div>
                {!!lightbox.sheetNames && lightbox.sheetNames.length > 1 && (
                  <div className="upload-lightbox-sheet-tabs">
                    {lightbox.sheetNames.map((sheetName) => (
                      <button
                        key={sheetName}
                        type="button"
                        className={`upload-lightbox-sheet-tab${lightbox.activeSheet === sheetName ? " active" : ""}`}
                        onClick={() => void handleSheetChange(sheetName)}
                      >
                        {sheetName}
                      </button>
                    ))}
                  </div>
                )}
                <div className="upload-lightbox-table-scroll">
                  <table className="upload-lightbox-table">
                    <thead>
                      <tr>
                        {lightbox.headers.map((header, index) => (
                          <th key={`h-${index}`}>{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lightbox.rows.map((row, rowIndex) => (
                        <tr key={`r-${rowIndex}`}>
                          {lightbox.headers.map((_, cellIndex) => (
                            <td key={`c-${rowIndex}-${cellIndex}`}>{row[cellIndex] ?? ""}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
