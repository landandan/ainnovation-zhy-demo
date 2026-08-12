"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { ToolShell, ToolToast, PrimaryButton } from "./shell"
import { copyText, downloadText, showToast } from "./shared"

interface IRecognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((e: any) => void) | null
  onerror: ((e: any) => void) | null
  onend: (() => void) | null
}

export default function SpeechToText() {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [listening, setListening] = useState(false)
  const [finalText, setFinalText] = useState("")
  const [interimText, setInterimText] = useState("")
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null)
  const recognitionRef = useRef<IRecognition | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    setSupported(!!SR)
    if (!SR) return
    const rec: IRecognition = new SR()
    rec.lang = "zh-CN"
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (e: any) => {
      let interim = ""
      let final = ""
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) final += res[0].transcript
        else interim += res[0].transcript
      }
      if (final) setFinalText((prev) => prev + final)
      setInterimText(interim)
    }
    rec.onerror = (e: any) => {
      showToast(setToast, "error", "识别错误：" + (e?.error || "未知"))
      setListening(false)
    }
    rec.onend = () => setListening(false)
    recognitionRef.current = rec
    return () => {
      try {
        recognitionRef.current?.stop()
      } catch {
        /* noop */
      }
    }
  }, [])

  const toggle = useCallback(() => {
    const rec = recognitionRef.current
    if (!rec) return
    if (listening) {
      rec.stop()
      setListening(false)
    } else {
      setInterimText("")
      try {
        rec.start()
        setListening(true)
      } catch {
        /* 已在运行 */
      }
    }
  }, [listening])

  const fullText = finalText + interimText

  const handleCopy = async () => {
    if (!fullText.trim()) return
    const ok = await copyText(fullText)
    showToast(setToast, ok ? "success" : "error", ok ? "已复制" : "复制失败")
  }

  const handleDownload = () => {
    if (!fullText.trim()) return
    downloadText(fullText, "语音转写.txt", "text/plain;charset=utf-8")
    showToast(setToast, "success", "已下载 .txt")
  }

  const handleClear = () => {
    setFinalText("")
    setInterimText("")
  }

  return (
    <ToolShell title="语音转文字" desc="使用浏览器内置语音识别，将麦克风语音实时转为文字。">
      <ToolToast toast={toast} />

      {supported === false && (
        <div
          className="mb-4 rounded-xl border px-4 py-3 text-[12px]"
          style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)", color: "#EF4444" }}
        >
          当前浏览器不支持语音识别。请使用 Chrome / Edge 桌面版，并确保允许麦克风权限。
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <PrimaryButton onClick={toggle} disabled={!supported}>
            {listening ? (
              <>
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" /> 停止
              </>
            ) : (
              "开始识别"
            )}
          </PrimaryButton>
          <button onClick={handleCopy} className="rounded-xl px-3 py-2 text-[12px] transition-all hover:bg-white/10" style={{ color: "var(--text-secondary)" }}>
            复制
          </button>
          <button onClick={handleDownload} className="rounded-xl px-3 py-2 text-[12px] transition-all hover:bg-white/10" style={{ color: "var(--text-secondary)" }}>
            下载 .txt
          </button>
          <button onClick={handleClear} className="rounded-xl px-3 py-2 text-[12px] transition-all hover:bg-white/10" style={{ color: "var(--text-secondary)" }}>
            清空
          </button>
        </div>

        <div
          className="min-h-[180px] w-full rounded-xl border p-4 text-[14px] leading-relaxed"
          style={{ borderColor: "var(--border)", background: "var(--secondary)", color: "var(--foreground)", whiteSpace: "pre-wrap" }}
        >
          {fullText || <span style={{ color: "var(--text-muted)" }}>点击「开始识别」后，对着麦克风说话即可实时显示文字…</span>}
        </div>

        <div
          className="rounded-xl border px-4 py-3 text-[11px] leading-relaxed"
          style={{ background: "var(--secondary)", borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          ⚠️ 说明：识别依赖浏览器内置的 Web Speech API（Chrome / Edge 桌面版最佳），识别过程会联网发送至语音服务；离线环境或 Safari / 移动端可能不可用。
        </div>
      </div>
    </ToolShell>
  )
}
