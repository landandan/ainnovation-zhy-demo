 "use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import mammoth from "mammoth"
import type { WorkBook } from "xlsx"

import { isMockMode } from "@/lib/mock-config"
 import {getToken} from "@/lib/auth";

 interface DownloadLinkProps {
   href: string
   label?: string
  agentId?: string
  fileId?: string
  /** 自定义触发器样式，默认 attachment-link-card */
  className?: string
  /** 自定义触发器内容；不传则用默认图标+文件名 */
  children?: ReactNode
 }

 type PreviewState =
   | { kind: "idle" }
   | { kind: "loading" }
   | { kind: "table"; headers: string[]; rows: string[][]; sheetNames?: string[]; activeSheet?: string }
   | { kind: "text"; content: string; language: string }
   | { kind: "html"; content: string }
   | { kind: "pptx" }
   | { kind: "image" }
   | { kind: "pdf" }
   | { kind: "unsupported"; message: string }
   | { kind: "error"; message: string }

type PptxViewerInstance = {
  destroy: () => void
}

const API_BASE_URL = process.env.NODE_ENV === "development" ? "http://localhost:5000/api" : "/api"

 function getFileNameFrom(href: string, label?: string) {
   try {
     const u = new URL(href, typeof window !== "undefined" ? window.location.origin : "http://localhost")
     const pathname = u.pathname
     const name = pathname.split("/").pop() || "download"
     const clean = decodeURIComponent(name.replace(/\?.*$/, ""))
     if (label && typeof label === "string" && label.trim()) {
       return label.replace(/\s+/g, " ").trim()
     }
     return clean
   } catch {
     if (label && label.trim()) return label.replace(/\s+/g, " ").trim()
     return "download"
   }
 }

 function getFileExtension(fileName: string) {
   const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)
   return match?.[1] || ""
 }

 function fileBaseNameFrom(fileName: string) {
   return fileName.replace(/\.(csv|tsv|xls|xlsx|doc|docx|ppt|pptx|txt|md|json|pdf|png|jpg|jpeg|gif|webp)$/i, "")
 }

 function downloadBlob(blob: Blob, filename: string) {
   const url = URL.createObjectURL(blob)
   const a = document.createElement("a")
   a.href = url
   a.download = filename
   document.body.appendChild(a)
   a.click()
   URL.revokeObjectURL(url)
   a.remove()
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

/** csv / tsv / xls / xlsx 统一用 SheetJS 解析 */
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
      // 编码异常时回退按二进制让 SheetJS 自行识别
      return XLSX.read(arrayBuffer, { type: "array", raw: false })
    }
  }

  // xls / xlsx（及误标后缀的表格）
  return XLSX.read(arrayBuffer, { type: "array", cellDates: true, raw: false })
}

async function openSpreadsheetPreview(
  arrayBuffer: ArrayBuffer,
  extension: string,
): Promise<{
  headers: string[]
  rows: string[][]
  sheetNames: string[]
  activeSheet: string
  workbook: WorkBook
}> {
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

function extractFileIdFromHref(href: string) {
  try {
    const url = new URL(href, typeof window !== "undefined" ? window.location.origin : "http://localhost")
    const pathname = url.pathname

    const previewMatch = pathname.match(/\/files\/([0-9a-f-]{36})\/(?:file|image)-preview$/i)
    if (previewMatch?.[1]) {
      return previewMatch[1]
    }

    const toolFileMatch = pathname.match(/\/files\/tools\/([0-9a-f-]{36})(?:\.[^/]+)?$/i)
    if (toolFileMatch?.[1]) {
      return toolFileMatch[1]
    }

    const genericFileMatch = pathname.match(/\/files\/([0-9a-f-]{36})(?:\.[^/]+)?$/i)
    if (genericFileMatch?.[1]) {
      return genericFileMatch[1]
    }

    return null
  } catch {
    return null
  }
 }

function parseHref(href: string) {
  try {
    return new URL(href, typeof window !== "undefined" ? window.location.origin : "http://localhost")
  } catch {
    return null
  }
}

function isToolFileHref(href: string) {
  const parsed = parseHref(href)
  return !!parsed && /\/files\/tools\/[0-9a-f-]{36}(?:\.[^/]+)?$/i.test(parsed.pathname)
}

function isSignedDifyHref(href: string) {
  const parsed = parseHref(href)
  if (!parsed) return false
  return parsed.searchParams.has("timestamp")
    && parsed.searchParams.has("nonce")
    && parsed.searchParams.has("sign")
}

/** 已是完整 http(s) 地址（含 Dify 签名链）时可直连下载，不必再走后端代理 */
function canDownloadDirectly(href: string) {
  return /^https?:\/\//i.test(href.trim())
}

function triggerDirectDownload(url: string, filename: string) {
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.target = "_blank"
  a.rel = "noopener noreferrer"
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function buildFileAccessUrl(fileId?: string, agentId?: string, download = false) {
  if (!fileId || !agentId) {
    return ""
  }
  const params = new URLSearchParams({ agent_id: agentId })
  if (download) {
    params.set("download", "1")
  }
  return `${API_BASE_URL}/dify/files/${encodeURIComponent(fileId)}/content?${params.toString()}`
}

function buildFetchProxyUrl(rawUrl?: string, agentId?: string) {
  if (!rawUrl || !agentId) {
    return ""
  }
  const params = new URLSearchParams({
    agent_id: agentId,
    url: rawUrl,
  })
  return `${API_BASE_URL}/dify/files/fetch?${params.toString()}`
}

async function readErrorMessage(res: Response, fallback: string) {
  try {
    const data = await res.json()
    if (data && typeof data.error === "string" && data.error.trim()) {
      return data.error.trim()
    }
  } catch {}

  try {
    const text = await res.text()
    if (text.trim()) {
      return text.trim()
    }
  } catch {}

  return `${fallback}（${res.status}）`
}

async function fetchFileResponse(url: string, withAuth: boolean, errorLabel = "文件读取失败") {
  const headers: Record<string, string> = {}

  if (withAuth) {
    const token = getToken()
    if (!token) {
      throw new Error("未登录，无法读取附件")
    }
    headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(url, { headers })
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, errorLabel))
  }
  return res
}

export function DownloadLink({ href, label, agentId, fileId, className, children }: DownloadLinkProps) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [preview, setPreview] = useState<PreviewState>({ kind: "idle" })
  const [downloading, setDownloading] = useState(false)
  const [previewAssetUrl, setPreviewAssetUrl] = useState<string | null>(null)
  const [pptxBooting, setPptxBooting] = useState(false)
  const workbookRef = useRef<WorkBook | null>(null)
  const pptxContainerRef = useRef<HTMLDivElement | null>(null)
  const pptxViewerRef = useRef<PptxViewerInstance | null>(null)
  const pptxBufferRef = useRef<ArrayBuffer | null>(null)

   const fileName = useMemo(() => getFileNameFrom(href, label), [href, label])
   const baseName = useMemo(() => fileBaseNameFrom(fileName), [fileName])
   const extension = useMemo(() => {
     const fromName = getFileExtension(fileName)
     if (fromName) return fromName
     return getFileExtension(getFileNameFrom(href))
   }, [fileName, href])
  const resolvedFileId = useMemo(() => fileId || extractFileIdFromHref(href), [fileId, href])
  const prefersFetchProxy = useMemo(
    () => !isMockMode() && !!agentId && (isToolFileHref(href) || isSignedDifyHref(href)),
    [agentId, href],
  )
  const previewAccessUrl = useMemo(() => buildFileAccessUrl(resolvedFileId || undefined, agentId, false), [resolvedFileId, agentId])
  const downloadAccessUrl = useMemo(() => buildFileAccessUrl(resolvedFileId || undefined, agentId, true), [resolvedFileId, agentId])
  const fetchProxyUrl = useMemo(() => buildFetchProxyUrl(href, agentId), [href, agentId])
  const shouldUseContentProxy = useMemo(
    () => !isMockMode() && !!agentId && !!resolvedFileId && !prefersFetchProxy,
    [agentId, resolvedFileId, prefersFetchProxy],
  )
  const shouldUseProxyAuth = useMemo(
    () => prefersFetchProxy || shouldUseContentProxy,
    [prefersFetchProxy, shouldUseContentProxy],
  )

  const getRequestUrl = (download = false) => {
    if (prefersFetchProxy) {
      return fetchProxyUrl
    }
    if (shouldUseContentProxy) {
      return download ? downloadAccessUrl : previewAccessUrl
    }
    return href
  }

  const ensureFileReady = (download = false) => {
    const requestUrl = getRequestUrl(download)
    if (!requestUrl) {
      throw new Error("无法识别可用的附件地址，请重新生成该附件后重试")
    }
    return requestUrl
  }

  /** 预览需要文件二进制：优先直连已有 URL，失败再走代理（避开 CORS） */
  const loadPreviewArrayBuffer = async () => {
    if (canDownloadDirectly(href)) {
      try {
        const directRes = await fetch(href)
        if (directRes.ok) {
          return await directRes.arrayBuffer()
        }
      } catch {
        // 跨域等失败时回退代理
      }
    }

    const res = await fetchFileResponse(ensureFileReady(false), shouldUseProxyAuth)
    return await res.arrayBuffer()
  }

  const clearPreviewAssetUrl = () => {
    setPreviewAssetUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev)
      }
      return null
    })
  }

  const destroyPptxViewer = () => {
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
  }

  useEffect(() => {
    return () => {
      if (previewAssetUrl) {
        URL.revokeObjectURL(previewAssetUrl)
      }
    }
  }, [previewAssetUrl])

  useEffect(() => {
    return () => {
      try {
        pptxViewerRef.current?.destroy()
      } catch {
        /* ignore */
      }
      pptxViewerRef.current = null
      pptxBufferRef.current = null
    }
  }, [])

  // pptx：容器挂载后再打开渲染引擎（静态导出用 public 下的 worker）
  useEffect(() => {
    if (preview.kind !== "pptx") return
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
          onError: (error) => {
            if (cancelled) return
            const message = error instanceof Error ? error.message : "PPT 预览失败"
            setPreview({ kind: "error", message })
            setPptxBooting(false)
          },
        })

        if (cancelled) {
          viewer.destroy()
          return
        }
        pptxViewerRef.current = viewer
        // 部分文件很快完成，可能已错过 onRenderComplete
        setPptxBooting(false)
      } catch (error) {
        if (cancelled) return
        const message = error instanceof Error ? error.message : "PPT 预览失败"
        setPreview({ kind: "error", message })
        setPptxBooting(false)
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
  }, [preview.kind])

   const fileMeta = useMemo(() => {
     if (["csv", "tsv", "xls", "xlsx"].includes(extension)) return { tag: extension.toUpperCase(), desc: "表格附件，可在线预览" }
     if (["txt", "md", "json", "log"].includes(extension)) return { tag: extension.toUpperCase(), desc: "文本附件，可在线预览" }
     if (["png", "jpg", "jpeg", "gif", "webp"].includes(extension)) return { tag: "图片", desc: "点击查看右侧预览" }
     if (extension === "pdf") return { tag: "PDF", desc: "点击查看右侧预览" }
     if (extension === "docx" || extension === "doc") return { tag: extension.toUpperCase(), desc: "Word 文档，可在线预览" }
     if (extension === "pptx") return { tag: "PPTX", desc: "演示文稿，可在线预览" }
     if (extension === "ppt") return { tag: "PPT", desc: "旧版演示文稿，请下载查看" }
     return { tag: extension ? extension.toUpperCase() : "文件", desc: "点击查看附件信息" }
   }, [extension])

   const handlePreviewOpen = async () => {
     setPreviewOpen(true)
    clearPreviewAssetUrl()
    workbookRef.current = null
    destroyPptxViewer()

     try {
       setPreview({ kind: "loading" })

      if (["png", "jpg", "jpeg", "gif", "webp", "pdf"].includes(extension)) {
        const res = await fetchFileResponse(ensureFileReady(false), shouldUseProxyAuth)
        const blob = await res.blob()
        const objectUrl = URL.createObjectURL(blob)
        setPreviewAssetUrl(objectUrl)
        setPreview({ kind: extension === "pdf" ? "pdf" : "image" })
        return
      }

      if (extension === "docx" || extension === "doc") {
        const arrayBuffer = await loadPreviewArrayBuffer()

        if (extension === "docx") {
          const result = await mammoth.convertToHtml({ arrayBuffer })
          setPreview({ kind: "html", content: result.value || "<p>（文档无内容）</p>" })
          return
        }

        // 部分文件后缀是 .doc 实为 docx，先尝试 mammoth
        try {
          const maybeDocx = await mammoth.convertToHtml({ arrayBuffer })
          if (maybeDocx.value?.trim()) {
            setPreview({ kind: "html", content: maybeDocx.value })
            return
          }
        } catch {
          // 真正的旧版 .doc 再走专用解析
        }

        const { parseMsDocToHtml } = await import("@file-viewer/doc")
        const rendered = await parseMsDocToHtml(arrayBuffer)
        const html = `${rendered.css ? `<style>${rendered.css}</style>` : ""}<div class="msdoc-root">${rendered.html || "<p>（文档无内容）</p>"}</div>`
        setPreview({ kind: "html", content: html })
        return
      }

      if (extension === "pptx") {
        const arrayBuffer = await loadPreviewArrayBuffer()
        pptxBufferRef.current = arrayBuffer
        setPreview({ kind: "pptx" })
        return
      }

      if (extension === "ppt") {
        setPreview({
          kind: "unsupported",
          message: "旧版 .ppt 暂不支持在线预览，请下载后查看。建议使用 .pptx。",
        })
        return
      }

      if (["csv", "tsv", "xls", "xlsx"].includes(extension)) {
        const arrayBuffer = await loadPreviewArrayBuffer()
        const result = await openSpreadsheetPreview(arrayBuffer, extension)
        workbookRef.current = result.workbook
        setPreview({
          kind: "table",
          headers: result.headers,
          rows: result.rows,
          sheetNames: result.sheetNames,
          activeSheet: result.activeSheet,
        })
        return
      }

      if (!["txt", "md", "json", "log"].includes(extension)) {
        setPreview({ kind: "unsupported", message: "当前附件暂不支持在线预览，可直接下载查看。" })
        return
      }

      const arrayBuffer = await loadPreviewArrayBuffer()
      const text = new TextDecoder("utf-8").decode(arrayBuffer)

       setPreview({
         kind: "text",
         content: text,
         language: extension === "md" ? "markdown" : extension === "log" ? "text" : extension,
       })
     } catch (error) {
       const message = error instanceof Error ? error.message : "预览加载失败"
       setPreview({ kind: "error", message })
     }
   }

  const handleSheetChange = async (sheetName: string) => {
    const workbook = workbookRef.current
    if (!workbook || !workbook.Sheets[sheetName]) return
    try {
      const { headers, rows } = await excelSheetToPreviewTable(workbook.Sheets[sheetName])
      setPreview({
        kind: "table",
        headers,
        rows,
        sheetNames: workbook.SheetNames,
        activeSheet: sheetName,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "切换工作表失败"
      setPreview({ kind: "error", message })
    }
  }

   const handleDownload = async () => {
     try {
       setDownloading(true)
      const name = fileName || `${baseName || "download"}.${extension || "file"}`

      // 消息里已带可直连 URL（如带 timestamp/nonce/sign 的 docx）时，直接打开/下载，不走 /dify/files/fetch
      if (canDownloadDirectly(href)) {
        triggerDirectDownload(href, name)
        return
      }

      const res = await fetchFileResponse(ensureFileReady(true), shouldUseProxyAuth, "下载失败")
       const blob = await res.blob()
       downloadBlob(blob, name)
    } catch (error) {
      const message = error instanceof Error ? error.message : "下载失败"
      setPreview({ kind: "error", message })
     } finally {
       setDownloading(false)
     }
   }

  const handleClosePreview = () => {
    setIsClosing(true)
    setTimeout(() => {
      setPreviewOpen(false)
      setIsClosing(false)
      setPreview({ kind: "idle" })
      clearPreviewAssetUrl()
      workbookRef.current = null
      destroyPptxViewer()
    }, 220) // 与 CSS 动画时间一致
  }

   return (
    <>
      <button
        type="button"
        onClick={handlePreviewOpen}
        className={className || "attachment-link-card"}
        title={`预览 ${fileName}`}
      >
        {children ?? (
          <>
            <span
              className="attachment-link-icon"
              style={{ background: "color-mix(in srgb, var(--accent) 12%, var(--card) 88%)", color: "var(--accent)" }}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </span>
            <span className="attachment-link-main">
              <span className="attachment-link-name">{fileName}</span>
              <span className="attachment-link-desc">{fileMeta.desc}</span>
            </span>
            <span className="attachment-link-tag">{fileMeta.tag}</span>
          </>
        )}
      </button>

      {previewOpen && (
        <>
          <div className={`attachment-preview-backdrop ${isClosing ? "closing" : ""}`} onClick={handleClosePreview} />
          <aside className={`attachment-preview-panel ${isClosing ? "closing" : ""}`} aria-label="附件预览">
            <div className="attachment-preview-header">
              <div className="min-w-0">
                <div className="attachment-preview-title">{fileName}</div>
                <div className="attachment-preview-subtitle">{fileMeta.desc}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={downloading}
                  className="attachment-preview-action"
                >
                  {downloading ? "下载中..." : "下载"}
                </button>
                <button
                  type="button"
                  onClick={handleClosePreview}
                  className="attachment-preview-close"
                  aria-label="关闭预览"
                >
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="attachment-preview-body">
              {preview.kind === "idle" || preview.kind === "loading" ? (
                <div className="attachment-preview-empty">
                  <span className="spinner" />
                  <span>正在加载附件预览...</span>
                </div>
              ) : null}

              {preview.kind === "error" && (
                <div className="attachment-preview-empty">
                  <span>{preview.message}</span>
                </div>
              )}

              {preview.kind === "unsupported" && (
                <div className="attachment-preview-empty">
                  <span>{preview.message}</span>
                </div>
              )}

              {preview.kind === "image" && (
                <div className="attachment-preview-image-wrap">
                  {previewAssetUrl ? <img src={previewAssetUrl} alt={fileName} className="attachment-preview-image" /> : null}
                </div>
              )}

              {preview.kind === "pdf" && (
                previewAssetUrl ? <iframe src={previewAssetUrl} title={fileName} className="attachment-preview-frame" /> : null
              )}

              {preview.kind === "text" && (
                <div className="attachment-preview-code">
                  <div className="attachment-preview-code-tag">{preview.language.toUpperCase()}</div>
                  <pre>{preview.content}</pre>
                </div>
              )}

              {preview.kind === "html" && (
                <div className="attachment-preview-docx">
                  <div
                    className="attachment-preview-docx-body"
                    dangerouslySetInnerHTML={{ __html: preview.content }}
                  />
                </div>
              )}

              {preview.kind === "pptx" && (
                <div className="attachment-preview-pptx-wrap">
                  {pptxBooting ? (
                    <div className="attachment-preview-pptx-loading">
                      <span className="spinner" />
                      <span>正在渲染幻灯片...</span>
                    </div>
                  ) : null}
                  <div ref={pptxContainerRef} className="attachment-preview-pptx" />
                </div>
              )}

              {preview.kind === "table" && (
                <div className="attachment-preview-table-wrap">
                  {!!preview.sheetNames && preview.sheetNames.length > 1 && (
                    <div className="attachment-preview-sheet-tabs">
                      {preview.sheetNames.map((sheetName) => (
                        <button
                          key={sheetName}
                          type="button"
                          className={`attachment-preview-sheet-tab${preview.activeSheet === sheetName ? " active" : ""}`}
                          onClick={() => handleSheetChange(sheetName)}
                        >
                          {sheetName}
                        </button>
                      ))}
                    </div>
                  )}
                  <table className="attachment-preview-table">
                    <thead>
                      <tr>
                        {preview.headers.map((header, index) => (
                          <th key={`${header}-${index}`}>{header || `列 ${index + 1}`}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row, rowIndex) => (
                        <tr key={`row-${rowIndex}`}>
                          {preview.headers.map((_, cellIndex) => (
                            <td key={`cell-${rowIndex}-${cellIndex}`}>{row[cellIndex] || ""}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </aside>
        </>
      )}
    </>
  )
 }
 
