"use client"

import { useState, useEffect } from "react"
import { loadSettings, saveSettings } from "@/lib/settings-store"
import type { DifySettings } from "@/lib/settings-store"

interface SettingsPanelProps {
  open: boolean
  onClose: () => void
  onSaved?: (settings: DifySettings) => void
}

export function SettingsPanel({ open, onClose, onSaved }: SettingsPanelProps) {
  const [apiUrl, setApiUrl] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [useMock, setUseMock] = useState(true)
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)

  // 加载已有设置
  useEffect(() => {
    if (open) {
      const s = loadSettings()
      setApiUrl(s.apiUrl || "")
      setApiKey(s.apiKey || "")
      setUseMock(s.useMock ?? true)
      setSaved(false)
    }
  }, [open])

  const handleSave = () => {
    const settings: DifySettings = {
      apiUrl: apiUrl.trim(),
      apiKey: apiKey.trim(),
      useMock,
    }
    saveSettings(settings)
    setSaved(true)
    onSaved?.(settings)
    setTimeout(() => {
      setSaved(false)
      onClose()
    }, 800)
  }

  const handleReset = () => {
    setApiUrl("")
    setApiKey("")
    setUseMock(true)
    saveSettings({ apiUrl: "", apiKey: "", useMock: true })
  }

  if (!open) return null

  return (
    <>
      {/* 遮罩 */}
      <div
        className="settings-overlay"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(4px)",
        }}
      />

      {/* 面板 */}
      <div
        className="settings-panel"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 1001,
          width: "min(440px, calc(100vw - 32px))",
          maxHeight: "calc(100vh - 64px)",
          overflowY: "auto",
          background: "var(--card)",
          borderRadius: "16px",
          border: "1px solid var(--border)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          animation: "fadeSlideUp 0.25s ease",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div>
            <h3
              className="text-[16px] font-bold flex items-center gap-2"
              style={{ color: "var(--foreground)" }}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              API 设置
            </h3>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              配置 Dify API 连接信息
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-[32px] w-[32px] items-center justify-center rounded-lg transition-all hover:bg-white/10"
            style={{ color: "var(--text-secondary)" }}
            aria-label="关闭"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 px-6 py-5">
          {/* API URL */}
          <div className="flex flex-col gap-1.5">
            <label
              className="text-[12px] font-semibold"
              style={{ color: "var(--foreground)" }}
            >
              Dify API URL
            </label>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://api.dify.ai/v1"
              className="w-full rounded-xl border px-4 py-2.5 text-[13px] outline-none transition-all focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--glow)]"
              style={{
                background: "var(--secondary)",
                color: "var(--foreground)",
                borderColor: "var(--border)",
              }}
            />
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              自托管填写 {`{your-domain}`}/v1，云端填写 https://api.dify.ai/v1
            </p>
          </div>

          {/* API Key */}
          <div className="flex flex-col gap-1.5">
            <label
              className="text-[12px] font-semibold"
              style={{ color: "var(--foreground)" }}
            >
              API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="app-xxxxxxxxxxxxxxxx"
                className="w-full rounded-xl border px-4 py-2.5 pr-10 text-[13px] outline-none transition-all focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--glow)]"
                style={{
                  background: "var(--secondary)",
                  color: "var(--foreground)",
                  borderColor: "var(--border)",
                }}
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-[28px] w-[28px] items-center justify-center rounded-lg transition-all hover:bg-white/10"
                style={{ color: "var(--text-secondary)" }}
                title={showKey ? "隐藏" : "显示"}
              >
                {showKey ? (
                  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              在 Dify 应用的 API 访问页面中获取
            </p>
          </div>

          {/* Mock 模式开关 */}
          <div
            className="flex items-center justify-between rounded-xl border px-4 py-3"
            style={{
              background: "var(--secondary)",
              borderColor: "var(--border)",
            }}
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-[12px] font-semibold" style={{ color: "var(--foreground)" }}>
                🧪 Mock 模式
              </span>
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                开启后使用模拟数据，无需配置 API Key 即可测试
              </span>
            </div>
            <button
              onClick={() => setUseMock(!useMock)}
              className="relative flex h-[28px] w-[48px] flex-shrink-0 rounded-full transition-all"
              style={{
                background: useMock ? "var(--accent)" : "var(--border)",
                boxShadow: useMock ? "0 0 8px var(--glow)" : "none",
              }}
              aria-label={useMock ? "关闭 Mock 模式" : "开启 Mock 模式"}
            >
              <span
                className="absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white transition-all shadow-sm"
                style={{
                  left: useMock ? "calc(100% - 25px)" : "3px",
                }}
              />
            </button>
          </div>

          {/* API Info */}
          <div
            className="flex flex-col gap-2 rounded-xl border px-4 py-3"
            style={{
              background: "var(--secondary)",
              borderColor: "var(--border)",
            }}
          >
            <div className="flex items-start gap-2">
              <span className="text-xs mt-0.5 flex-shrink-0">💡</span>
              <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                <p className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>
                  如何获取 API Key？
                </p>
                <p>1. 打开 Dify 工作台 → 选择应用 → 左侧「API 访问」</p>
                <p>2. 复制「API 密钥（Chat）」下的密钥</p>
                <p>3. 粘贴到上方输入框并保存</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between gap-3 px-6 py-4"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <button
            onClick={handleReset}
            className="rounded-xl px-3 py-2 text-[12px] font-medium transition-all hover:bg-white/10"
            style={{ color: "var(--text-muted)" }}
          >
            重置
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-xl px-5 py-2 text-[12px] font-medium transition-all hover:bg-white/10"
              style={{ color: "var(--text-secondary)" }}
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={!useMock && (!apiUrl.trim() || !apiKey.trim())}
              className="flex items-center gap-1.5 rounded-xl px-5 py-2 text-[12px] font-semibold text-white transition-all disabled:opacity-40 hover:-translate-y-0.5"
              style={{
                background: saved ? "var(--gradient-4)" : "var(--accent)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              {saved ? (
                <>
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  已保存
                </>
              ) : (
                "保存"
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}