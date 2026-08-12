"use client"

import { useState } from "react"
import { marked } from "marked"
import TurndownService from "turndown"
import mammoth from "mammoth"
import { ToolShell, ToolToast, PrimaryButton } from "./shell"
import { copyText, downloadText, downloadBlob, readFileAsArrayBuffer, showToast } from "./shared"

const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-" })

type Tab = "md-html" | "docx" | "csv-xlsx"

const tabList: { id: Tab; label: string }[] = [
  { id: "md-html", label: "Markdown ⇄ HTML" },
  { id: "docx", label: "Word → HTML / MD" },
  { id: "csv-xlsx", label: "CSV ⇄ Excel" },
]

export default function DocConvert() {
  const [tab, setTab] = useState<Tab>("md-html")
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null)

  const [md, setMd] = useState("")
  const [html, setHtml] = useState("")

  const [docxHtml, setDocxHtml] = useState("")
  const [docxName, setDocxName] = useState("")

  const [csvText, setCsvText] = useState("")
  const [xlsxName, setXlsxName] = useState("")

  const mdToHtml = () => setHtml(marked.parse(md) as string)
  const htmlToMd = () => setMd(td.turndown(html))

  const convertDocx = async (file: File) => {
    try {
      const arrayBuffer = await readFileAsArrayBuffer(file)
      const result = await mammoth.convertToHtml({ arrayBuffer })
      setDocxHtml(result.value)
      setDocxName(file.name.replace(/\.docx$/i, ""))
      showToast(setToast, "success", "Word 解析完成")
    } catch (e) {
      showToast(setToast, "error", "解析失败：" + (e instanceof Error ? e.message : String(e)))
    }
  }

  const convertDocxToMd = () => setMd((prev) => prev + (prev ? "\n\n" : "") + td.turndown(docxHtml))

  const csvToXlsx = async () => {
    if (!csvText.trim()) return
    try {
      const XLSX = await import("xlsx")
      const wb = XLSX.read(csvText, { type: "string" })
      const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer
      downloadBlob(new Blob([out], { type: "application/octet-stream" }), "converted.xlsx")
      showToast(setToast, "success", "已导出 Excel")
    } catch (e) {
      showToast(setToast, "error", "转换失败：" + (e instanceof Error ? e.message : String(e)))
    }
  }

  const xlsxToCsv = async (file: File) => {
    try {
      const XLSX = await import("xlsx")
      const arrayBuffer = await readFileAsArrayBuffer(file)
      const wb = XLSX.read(arrayBuffer, { type: "array" })
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]])
      setCsvText(csv)
      setXlsxName(file.name.replace(/\.xlsx$/i, ""))
      showToast(setToast, "success", "Excel 解析完成")
    } catch (e) {
      showToast(setToast, "error", "解析失败：" + (e instanceof Error ? e.message : String(e)))
    }
  }

  return (
    <ToolShell title="文档格式转换" desc="在浏览器本地完成常见文档格式互转，文件不上传服务器。">
      <ToolToast toast={toast} />

      {/* Tab 切换 */}
      <div className="mb-4 flex gap-2">
        {tabList.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="rounded-xl px-3 py-2 text-[12px] font-medium transition-all"
            style={
              tab === t.id
                ? { background: "var(--accent)", color: "var(--accent-foreground)" }
                : { background: "var(--secondary)", color: "var(--text-secondary)" }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "md-html" && (
        <div className="flex flex-col gap-3">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[12px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                Markdown
              </span>
              <div className="flex gap-2">
                <button onClick={mdToHtml} className="rounded-lg px-2.5 py-1 text-[11px] font-semibold" style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}>
                  → HTML
                </button>
                <button
                  onClick={async () => {
                    if (md) await copyText(md)
                    showToast(setToast, md ? "success" : "info", md ? "已复制" : "无内容")
                  }}
                  className="rounded-lg px-2.5 py-1 text-[11px]" style={{ background: "var(--secondary)", color: "var(--text-secondary)" }}
                >
                  复制
                </button>
              </div>
            </div>
            <textarea
              value={md}
              onChange={(e) => setMd(e.target.value)}
              rows={6}
              placeholder="# 标题&#10;支持 **加粗**、列表等"
              className="w-full rounded-xl border px-3 py-2 text-[13px] outline-none transition-all focus:border-[var(--accent)]"
              style={{ background: "var(--secondary)", color: "var(--foreground)", borderColor: "var(--border)", resize: "vertical" }}
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[12px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                HTML
              </span>
              <div className="flex gap-2">
                <button onClick={htmlToMd} className="rounded-lg px-2.5 py-1 text-[11px] font-semibold" style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}>
                  → Markdown
                </button>
                <button onClick={() => { if (html) { downloadText(html, "output.html", "text/html;charset=utf-8"); showToast(setToast, "success", "已下载 .html") } }} className="rounded-lg px-2.5 py-1 text-[11px]" style={{ background: "var(--secondary)", color: "var(--text-secondary)" }}>
                  下载 .html
                </button>
              </div>
            </div>
            <textarea
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              rows={6}
              placeholder="<h1>标题</h1>"
              className="w-full rounded-xl border px-3 py-2 text-[13px] outline-none transition-all focus:border-[var(--accent)]"
              style={{ background: "var(--secondary)", color: "var(--foreground)", borderColor: "var(--border)", resize: "vertical" }}
            />
          </div>
        </div>
      )}

      {tab === "docx" && (
        <div className="flex flex-col gap-3">
          <label
            className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-6 text-[13px]"
            style={{ borderColor: "var(--border)", background: "var(--secondary)", color: "var(--foreground)" }}
          >
            点击选择 .docx 文件
            <input
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) convertDocx(f)
              }}
            />
          </label>
          <div className="flex gap-2">
            <button onClick={convertDocxToMd} disabled={!docxHtml} className="rounded-lg px-2.5 py-1 text-[11px] font-semibold disabled:opacity-50" style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}>
              转为 Markdown
            </button>
            <button onClick={() => { if (docxHtml) { downloadText(docxHtml, (docxName || "document") + ".html", "text/html;charset=utf-8"); showToast(setToast, "success", "已下载 .html") } }} disabled={!docxHtml} className="rounded-lg px-2.5 py-1 text-[11px] disabled:opacity-50" style={{ background: "var(--secondary)", color: "var(--text-secondary)" }}>
              下载 .html
            </button>
            <button onClick={() => { if (docxHtml) { downloadText(td.turndown(docxHtml), (docxName || "document") + ".md", "text/markdown;charset=utf-8"); showToast(setToast, "success", "已下载 .md") } }} disabled={!docxHtml} className="rounded-lg px-2.5 py-1 text-[11px] disabled:opacity-50" style={{ background: "var(--secondary)", color: "var(--text-secondary)" }}>
              下载 .md
            </button>
          </div>
          <textarea
            value={docxHtml}
            onChange={(e) => setDocxHtml(e.target.value)}
            rows={10}
            placeholder="Word 内容将解析为 HTML 显示在此处…"
            className="w-full rounded-xl border px-3 py-2 text-[13px] outline-none transition-all focus:border-[var(--accent)]"
            style={{ background: "var(--secondary)", color: "var(--foreground)", borderColor: "var(--border)", resize: "vertical" }}
          />
        </div>
      )}

      {tab === "csv-xlsx" && (
        <div className="flex flex-col gap-3">
          <div>
            <div className="mb-1 text-[12px] font-semibold" style={{ color: "var(--text-secondary)" }}>
              CSV → Excel
            </div>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={5}
              placeholder="a,b,c&#10;1,2,3"
              className="w-full rounded-xl border px-3 py-2 text-[13px] outline-none transition-all focus:border-[var(--accent)]"
              style={{ background: "var(--secondary)", color: "var(--foreground)", borderColor: "var(--border)", resize: "vertical" }}
            />
            <div className="mt-2">
              <PrimaryButton onClick={csvToXlsx} disabled={!csvText.trim()}>
                导出 Excel (.xlsx)
              </PrimaryButton>
            </div>
          </div>
          <div className="h-px" style={{ background: "var(--border)" }} />
          <div>
            <div className="mb-1 text-[12px] font-semibold" style={{ color: "var(--text-secondary)" }}>
              Excel → CSV
            </div>
            <label
              className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-5 text-[13px]"
              style={{ borderColor: "var(--border)", background: "var(--secondary)", color: "var(--foreground)" }}
            >
              点击选择 .xlsx 文件
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) xlsxToCsv(f)
                }}
              />
            </label>
            {csvText && (
              <div className="mt-2 flex gap-2">
                <button onClick={async () => { await copyText(csvText); showToast(setToast, "success", "已复制") }} className="rounded-lg px-2.5 py-1 text-[11px]" style={{ background: "var(--secondary)", color: "var(--text-secondary)" }}>
                  复制 CSV
                </button>
                <button onClick={() => { downloadText(csvText, (xlsxName || "sheet") + ".csv", "text/csv;charset=utf-8"); showToast(setToast, "success", "已下载 .csv") }} className="rounded-lg px-2.5 py-1 text-[11px]" style={{ background: "var(--secondary)", color: "var(--text-secondary)" }}>
                  下载 .csv
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </ToolShell>
  )
}
