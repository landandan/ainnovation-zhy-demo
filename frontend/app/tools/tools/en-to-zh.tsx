"use client"

import { useState } from "react"
import { ToolShell, ToolToast, PrimaryButton } from "./shell"
import { copyText, downloadText, showToast } from "./shared"

/** 按句子切分，避免单次请求 URL 过长 */
function splitChunks(text: string, maxLen = 450): string[] {
  const sentences = text.match(/[^。！？\.\!\?]+[。！？\.\!\?]?/g) || [text]
  const chunks: string[] = []
  let cur = ""
  for (const s of sentences) {
    if ((cur + s).length > maxLen) {
      if (cur) chunks.push(cur)
      cur = s
    } else {
      cur += s
    }
  }
  if (cur) chunks.push(cur)
  return chunks.filter(Boolean)
}

async function translateChunk(q: string): Promise<string> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=en|zh-CN`
  const res = await fetch(url)
  const data = await res.json()
  if (data?.responseData?.translatedText) return data.responseData.translatedText
  if (data?.responseMessage && data.responseMessage !== "OK") throw new Error(data.responseMessage)
  return ""
}

export default function EnToZh() {
  const [src, setSrc] = useState("")
  const [out, setOut] = useState("")
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null)

  const translate = async () => {
    if (!src.trim()) return
    setBusy(true)
    try {
      const chunks = splitChunks(src)
      const parts: string[] = []
      for (const c of chunks) {
        parts.push(await translateChunk(c))
      }
      setOut(parts.join(""))
      showToast(setToast, "success", "翻译完成")
    } catch (e) {
      showToast(setToast, "error", "翻译失败：" + (e instanceof Error ? e.message : String(e)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolShell title="英文转中文" desc="调用免费翻译接口，将英文文本翻译为中文。">
      <ToolToast toast={toast} />

      <div className="flex flex-col gap-3">
        <div>
          <div className="mb-1 text-[12px] font-semibold" style={{ color: "var(--text-secondary)" }}>
            英文原文
          </div>
          <textarea
            value={src}
            onChange={(e) => setSrc(e.target.value)}
            rows={6}
            placeholder="Paste English text here…"
            className="w-full rounded-xl border px-3 py-2 text-[13px] outline-none transition-all focus:border-[var(--accent)]"
            style={{ background: "var(--secondary)", color: "var(--foreground)", borderColor: "var(--border)", resize: "vertical" }}
          />
        </div>

        <div className="flex items-center gap-3">
          <PrimaryButton onClick={translate} disabled={!src.trim() || busy}>
            {busy ? "翻译中…" : "翻译"}
          </PrimaryButton>
          <button
            onClick={async () => {
              if (out) {
                await copyText(out)
                showToast(setToast, "success", "已复制")
              }
            }}
            disabled={!out}
            className="rounded-xl px-3 py-2 text-[12px] transition-all hover:bg-white/10 disabled:opacity-50"
            style={{ color: "var(--text-secondary)" }}
          >
            复制结果
          </button>
          <button
            onClick={() => {
              if (out) {
                downloadText(out, "translation.txt", "text/plain;charset=utf-8")
                showToast(setToast, "success", "已下载 .txt")
              }
            }}
            disabled={!out}
            className="rounded-xl px-3 py-2 text-[12px] transition-all hover:bg-white/10 disabled:opacity-50"
            style={{ color: "var(--text-secondary)" }}
          >
            下载 .txt
          </button>
        </div>

        <div>
          <div className="mb-1 text-[12px] font-semibold" style={{ color: "var(--text-secondary)" }}>
            中文译文
          </div>
          <textarea
            value={out}
            onChange={(e) => setOut(e.target.value)}
            rows={6}
            placeholder="翻译结果将显示在此处…"
            className="w-full rounded-xl border px-3 py-2 text-[13px] outline-none transition-all focus:border-[var(--accent)]"
            style={{ background: "var(--secondary)", color: "var(--foreground)", borderColor: "var(--border)", resize: "vertical" }}
          />
        </div>

        <div
          className="rounded-xl border px-4 py-3 text-[11px] leading-relaxed"
          style={{ background: "var(--secondary)", borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          ⚠️ 说明：翻译请求发送至公开免费接口（MyMemory），需要联网；免费额度有限，长文本会分段翻译。内网 / 离线环境将不可用，可后续接入自有翻译服务。
        </div>
      </div>
    </ToolShell>
  )
}
