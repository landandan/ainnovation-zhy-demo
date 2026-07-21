"use client"

import { useState, useRef, type ChangeEvent } from "react"
import { Document, Packer, Paragraph, TextRun } from "docx"
import { ToolShell, ToolToast, PrimaryButton } from "./shell"
import { downloadBlob, readFileAsArrayBuffer, showToast } from "./shared"

export default function PdfToWord() {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      setFile(f)
      setStatus("")
    }
  }

  const convert = async () => {
    if (!file) return
    setBusy(true)
    setStatus("正在解析 PDF…")
    try {
      const pdfjs = await import("pdfjs-dist")
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
      const data = await readFileAsArrayBuffer(file)
      const pdf = await pdfjs.getDocument({ data }).promise
      const paragraphs: Paragraph[] = []
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        const text = (content.items as Array<{ str?: string }>)
          .map((it) => it.str ?? "")
          .join(" ")
        if (text.trim()) {
          paragraphs.push(new Paragraph({ children: [new TextRun(text)], spacing: { after: 160 } }))
        }
        setStatus(`正在提取第 ${i}/${pdf.numPages} 页…`)
      }
      setStatus(`已提取 ${paragraphs.length} 段文本，正在生成 Word…`)
      const doc = new Document({
        sections: [
          {
            children: paragraphs.length
              ? paragraphs
              : [new Paragraph({ children: [new TextRun("（未提取到文本，可能是扫描件 / 图片型 PDF）")] })],
          },
        ],
      })
      const blob = await Packer.toBlob(doc)
      downloadBlob(blob, file.name.replace(/\.pdf$/i, "") + ".docx")
      showToast(setToast, "success", "已导出 Word 文档")
      setStatus("完成 ✓")
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      showToast(setToast, "error", "转换失败：" + msg)
      setStatus("转换失败")
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolShell title="PDF 转 Word" desc="上传 PDF，提取正文内容并导出为 .docx 文档。完全在浏览器本地处理，离线可用。">
      <ToolToast toast={toast} />

      <div className="flex flex-col gap-4">
        <div
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition-all hover:bg-white/5"
          style={{ borderColor: "var(--border)", background: "var(--secondary)" }}
          onClick={() => inputRef.current?.click()}
        >
          <svg width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" style={{ color: "var(--accent)" }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <div className="text-[13px] font-medium" style={{ color: "var(--foreground)" }}>
            {file ? file.name : "点击选择 PDF 文件"}
          </div>
          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            仅支持文本型 PDF，单文件建议 &lt; 20MB
          </div>
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onPick} />
        </div>

        <div className="flex items-center gap-3">
          <PrimaryButton onClick={convert} disabled={!file || busy}>
            {busy ? "处理中…" : "转换为 Word"}
          </PrimaryButton>
          {file && (
            <button
              onClick={() => {
                setFile(null)
                setStatus("")
                if (inputRef.current) inputRef.current.value = ""
              }}
              className="rounded-xl px-3 py-2 text-[12px] transition-all hover:bg-white/10"
              style={{ color: "var(--text-secondary)" }}
            >
              清除
            </button>
          )}
        </div>

        {status && (
          <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>
            {status}
          </div>
        )}

        <div
          className="rounded-xl border px-4 py-3 text-[11px] leading-relaxed"
          style={{ background: "var(--secondary)", borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          ⚠️ 说明：提取的是 PDF 文本流，原版式、图片、表格样式不会保留，生成的是“纯文本 Word”。高保真排版转换需后端服务或专业库。
        </div>
      </div>
    </ToolShell>
  )
}
