 "use client"

import { useEffect, useMemo, useState } from "react"

import { isMockMode } from "@/lib/mock-config"
 import {getToken} from "@/lib/auth";

 interface DownloadLinkProps {
   href: string
   label?: string
  agentId?: string
  fileId?: string
 }

 type PreviewState =
   | { kind: "idle" }
   | { kind: "loading" }
   | { kind: "table"; headers: string[]; rows: string[][] }
   | { kind: "text"; content: string; language: string }
   | { kind: "image" }
   | { kind: "pdf" }
   | { kind: "unsupported"; message: string }
   | { kind: "error"; message: string }

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

 function parseDelimitedRow(line: string, delimiter: string) {
   const result: string[] = []
   let current = ""
   let inQuotes = false

   for (let i = 0; i < line.length; i += 1) {
     const char = line[i]
     const next = line[i + 1]

     if (char === '"') {
       if (inQuotes && next === '"') {
         current += '"'
         i += 1
       } else {
         inQuotes = !inQuotes
       }
       continue
     }

     if (char === delimiter && !inQuotes) {
       result.push(current.trim())
       current = ""
       continue
     }

     current += char
   }

   result.push(current.trim())
   return result
 }

 function parseDelimitedText(text: string, delimiter: string) {
   const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
   if (lines.length === 0) {
     return { headers: [], rows: [] }
   }

   const headers = parseDelimitedRow(lines[0], delimiter)
   const rows = lines.slice(1, 121).map((line) => parseDelimitedRow(line, delimiter))
   return { headers, rows }
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

export function DownloadLink({ href, label, agentId, fileId }: DownloadLinkProps) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [preview, setPreview] = useState<PreviewState>({ kind: "idle" })
  const [downloading, setDownloading] = useState(false)
  const [previewAssetUrl, setPreviewAssetUrl] = useState<string | null>(null)

   const fileName = useMemo(() => getFileNameFrom(href, label), [href, label])
   const baseName = useMemo(() => fileBaseNameFrom(fileName), [fileName])
   const extension = useMemo(() => getFileExtension(fileName), [fileName])
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

  const clearPreviewAssetUrl = () => {
    setPreviewAssetUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev)
      }
      return null
    })
  }

  useEffect(() => {
    return () => {
      if (previewAssetUrl) {
        URL.revokeObjectURL(previewAssetUrl)
      }
    }
  }, [previewAssetUrl])

   const fileMeta = useMemo(() => {
     if (["csv", "tsv"].includes(extension)) return { tag: extension.toUpperCase(), desc: "表格附件，可在线预览" }
     if (["txt", "md", "json", "log"].includes(extension)) return { tag: extension.toUpperCase(), desc: "文本附件，可在线预览" }
     if (["png", "jpg", "jpeg", "gif", "webp"].includes(extension)) return { tag: "图片", desc: "点击查看右侧预览" }
     if (extension === "pdf") return { tag: "PDF", desc: "点击查看右侧预览" }
     return { tag: extension ? extension.toUpperCase() : "文件", desc: "点击查看附件信息" }
   }, [extension])

   const handlePreviewOpen = async () => {
     setPreviewOpen(true)
    clearPreviewAssetUrl()

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

      if (!["csv", "tsv", "txt", "md", "json", "log"].includes(extension)) {
        setPreview({ kind: "unsupported", message: "当前附件暂不支持在线预览，可直接下载查看。" })
        return
      }

      const text = await (await fetchFileResponse(ensureFileReady(false), shouldUseProxyAuth)).text()

       if (extension === "csv" || extension === "tsv") {
         const { headers, rows } = parseDelimitedText(text, extension === "tsv" ? "\t" : ",")
         setPreview({ kind: "table", headers, rows })
         return
       }
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
    }, 220) // 与 CSS 动画时间一致
  }

   return (
    <>
      <button
        type="button"
        onClick={handlePreviewOpen}
        className="attachment-link-card"
        title={`预览 ${fileName}`}
      >
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

              {preview.kind === "table" && (
                <div className="attachment-preview-table-wrap">
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
 
