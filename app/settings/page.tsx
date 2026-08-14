"use client"

import { memo, useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-store"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import {
  getAgents,
  createAgent,
  updateAgent,
  deleteAgent,
  getDifyConfigs,
  createDifyConfig,
  updateDifyConfig,
  deleteDifyConfig,
  testDifyConnection,
  reorderAgents,
  type AgentDefApi,
  type DifyConfigApi,
  type CreateAgentRequest,
  type CreateDifyConfigRequest,
  type UpdateDifyConfigRequest,
} from "@/lib/api-client"
import { DEFAULT_DIFY_BASE_URL } from "@/lib/config"

/* ───── 工具函数 ───── */

/** 判断当前用户是否为管理员 */
function isAdmin(roles?: string[]): boolean {
  return roles?.includes("admin") ?? false
}

/** 渐变色预设 */
const GRADIENT_PRESETS = [
  { value: "var(--gradient-1)", label: "蓝色", preview: "linear-gradient(135deg, #0052CC, #0082FF)" },
  { value: "var(--gradient-2)", label: "橙色", preview: "linear-gradient(135deg, #F97316, #FB923C)" },
  { value: "var(--gradient-3)", label: "绿色", preview: "linear-gradient(135deg, #10B981, #34D399)" },
  { value: "var(--gradient-4)", label: "紫色", preview: "linear-gradient(135deg, #8B5CF6, #A78BFA)" },
]

/* ───── 子组件 ───── */

/** 删除确认弹窗 */
const ConfirmDialog = memo(function ConfirmDialog({
  title,
  message,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <>
      <div className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div
        style={{
          position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          zIndex: 1101, width: "min(360px, calc(100vw - 32px))",
          background: "var(--card)", borderRadius: "16px",
          border: "1px solid var(--border)", boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          padding: "24px",
        }}
      >
        <h4 className="text-[15px] font-bold mb-2" style={{ color: "var(--foreground)" }}>{title}</h4>
        <p className="text-[13px] mb-6" style={{ color: "var(--text-secondary)" }}>{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-xl px-4 py-2 text-[12px] font-medium transition-all hover:bg-white/10" style={{ color: "var(--text-secondary)" }}>取消</button>
          <button onClick={onConfirm} className="rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all hover:-translate-y-0.5" style={{ background: "#EF4444", boxShadow: "0 2px 8px rgba(239,68,68,0.3)" }}>确认删除</button>
        </div>
      </div>
    </>
  )
})

/** 新增/编辑 Agent 弹窗 */
const AgentFormDialog = memo(function AgentFormDialog({
  editing,
  onSave,
  onCancel,
}: {
  editing: AgentDefApi | null
  onSave: (data: CreateAgentRequest) => void
  onCancel: () => void
}) {
  const [agentId, setAgentId] = useState(editing?.agent_id ?? "")
  const [label, setLabel] = useState(editing?.label ?? "")
  const [desc, setDesc] = useState(editing?.desc ?? "")
  const [quickQuestions, setQuickQuestions] = useState<string[]>(editing?.quick_questions ?? [])
  const [newQuestion, setNewQuestion] = useState("")
  const [gradient, setGradient] = useState(editing?.gradient ?? "var(--gradient-1)")
  const [isActive, setIsActive] = useState(editing?.is_active ?? true)
  
  // Dify 配置状态
  const defaultDifyConfig = editing?.dify_configs?.find(c => c.is_default) || editing?.dify_configs?.[0]
  const [difyBaseUrl, setDifyBaseUrl] = useState(defaultDifyConfig?.dify_base_url ?? "")
  const [difyApiKey, setDifyApiKey] = useState("") // 编辑时默认不显示真实 key
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)

  const [error, setError] = useState("")

  const handleAddQuestion = () => {
    const trimmed = newQuestion.trim()
    if (!trimmed) return
    if (quickQuestions.length >= 6) {
      setError("最多添加6个快速提问")
      return
    }
    if (quickQuestions.includes(trimmed)) {
      setError("该问题已存在")
      return
    }
    setQuickQuestions([...quickQuestions, trimmed])
    setNewQuestion("")
    setError("")
  }

  const handleRemoveQuestion = (index: number) => {
    setQuickQuestions(quickQuestions.filter((_, i) => i !== index))
  }

  const handleTestConnection = async () => {
    if (!difyApiKey.trim() && !editing) { setError("请输入 API Key"); return }
    setError("")
    setTesting(true)
    setTestResult(null)
    try {
      const result = await testDifyConnection({
        dify_api_key: difyApiKey.trim() || (defaultDifyConfig?.dify_api_key ?? ""), // 如果没填新的，尝试用旧的（虽然可能是脱敏的，后端会处理）
        dify_base_url: difyBaseUrl.trim() || undefined,
      })
      setTestResult(result)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "测试失败"
      setTestResult({ ok: false, error: msg })
    } finally {
      setTesting(false)
    }
  }

  const isHelpAgent = (editing?.agent_id ?? agentId) === "help"

  const handleSubmit = async () => {
    if (!label.trim()) { setError("请输入应用名称"); return }
    if (!editing && !agentId.trim()) { setError("请输入应用标识"); return }
    // help 智能体不需要 Dify 配置
    if (!isHelpAgent && !editing && !difyApiKey.trim()) { setError("请输入 Dify API Key"); return }

    // 如果填写了新的 API Key，先测试连通性（仅非 help 智能体）
    if (!isHelpAgent && difyApiKey.trim()) {
      setError("")
      setTesting(true)
      setTestResult(null)
      let result: { ok: boolean; error?: string } | null = null
      try {
        result = await testDifyConnection({
          dify_api_key: difyApiKey.trim(),
          dify_base_url: difyBaseUrl.trim() || undefined,
        })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "测试失败"
        result = { ok: false, error: msg }
      }
      setTesting(false)
      setTestResult(result)
      if (!result.ok) {
        setError(result.error || "连接校验失败，请检查 API Key 和 Base URL")
        return
      }
    }

    const difyConfigData = isHelpAgent ? null : {
      env_label: "默认",
      dify_base_url: difyBaseUrl.trim() || undefined,
      ...(difyApiKey.trim() ? { dify_api_key: difyApiKey.trim() } : {}),
    }

    onSave({
      agent_id: editing?.agent_id ?? agentId.trim(),
      label: label.trim(),
      desc: desc.trim() || "自定义应用",
      quick_questions: quickQuestions.filter(q => q.trim()),
      gradient,
      is_active: isActive,
      dify_config: difyConfigData && Object.keys(difyConfigData).length > 1 ? difyConfigData as any : undefined, // 只有在有实际配置时才传
    })
  }

  return (
    <>
      <div className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 1101, width: "min(480px, calc(100vw - 32px))", background: "var(--card)", borderRadius: "16px", border: "1px solid var(--border)", boxShadow: "0 20px 60px rgba(0,0,0,0.4)", padding: "24px", maxHeight: "85vh", overflowY: "auto" }}>
        <h4 className="text-[15px] font-bold mb-4" style={{ color: "var(--foreground)" }}>{editing ? "编辑应用" : "新增应用"}</h4>
        
        <div className="flex flex-col gap-4">
          {/* 基本信息区 */}
          <div className="flex flex-col gap-3">
            <h5 className="text-[12px] font-semibold" style={{ color: "var(--text-secondary)" }}>基本信息</h5>
            {!editing && (
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>应用标识 *</label>
                <input type="text" value={agentId} onChange={(e) => { setAgentId(e.target.value); setError("") }}
                  placeholder="例如：knowledge" maxLength={32}
                  className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none transition-all focus:border-[var(--accent)]"
                  style={{ background: "var(--secondary)", color: "var(--foreground)", borderColor: error && !agentId ? "#EF4444" : "var(--border)" }} />
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>应用名称 *</label>
              <input type="text" value={label} onChange={(e) => { setLabel(e.target.value); setError("") }}
                placeholder="例如：智能问答" maxLength={10}
                className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none transition-all focus:border-[var(--accent)]"
                style={{ background: "var(--secondary)", color: "var(--foreground)", borderColor: error && !label ? "#EF4444" : "var(--border)" }} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>欢迎语（描述）</label>
              <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="简短描述，作为欢迎语展示"
                maxLength={256} rows={2}
                className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none transition-all focus:border-[var(--accent)] resize-none"
                style={{ background: "var(--secondary)", color: "var(--foreground)", borderColor: "var(--border)" }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>快速提问</label>
              <div className="flex gap-2">
                <input type="text" value={newQuestion} onChange={(e) => { setNewQuestion(e.target.value); setError("") }}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddQuestion())}
                  placeholder="输入快速提问" maxLength={50}
                  className="flex-1 rounded-lg border px-3 py-2 text-[13px] outline-none transition-all focus:border-[var(--accent)]"
                  style={{ background: "var(--secondary)", color: "var(--foreground)", borderColor: "var(--border)" }} />
                <button onClick={handleAddQuestion}
                  className="rounded-lg px-3 py-2 text-[12px] font-semibold transition-all hover:-translate-y-0.5 flex-shrink-0"
                  style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}>
                  添加
                </button>
              </div>
              {quickQuestions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {quickQuestions.map((q, i) => (
                    <div key={i} className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px]"
                      style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
                      <span>{q}</span>
                      <button onClick={() => handleRemoveQuestion(i)} className="hover:text-red-400 transition-colors">
                        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="15" y1="9" x2="9" y2="15" />
                          <line x1="9" y1="9" x2="15" y2="15" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>主题色</label>
              <div className="flex gap-2">
                {GRADIENT_PRESETS.map((g) => (
                  <button key={g.value} onClick={() => setGradient(g.value)}
                    className="w-9 h-9 rounded-lg border-2 transition-all hover:scale-110"
                    style={{ background: g.preview, borderColor: gradient === g.value ? "var(--foreground)" : "transparent", boxShadow: gradient === g.value ? "0 0 0 2px var(--glow)" : "none" }}
                    title={g.label} />
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border px-3 py-3" style={{ borderColor: "var(--border)", background: "var(--secondary)" }}>
              <div className="flex flex-col gap-0.5">
                <span className="text-[12px] font-semibold" style={{ color: "var(--foreground)" }}>是否启用</span>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  启用后会在首页「智能助手」列表中展示
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isActive}
                onClick={() => setIsActive((prev) => !prev)}
                className="relative inline-flex h-7 w-12 items-center rounded-full transition-all"
                style={{
                  background: isActive ? "var(--accent)" : "color-mix(in srgb, var(--text-muted) 35%, var(--border) 65%)",
                  boxShadow: isActive ? "0 0 0 4px var(--glow)" : "none",
                }}
              >
                <span
                  className="inline-block h-5 w-5 rounded-full bg-white transition-transform"
                  style={{
                    transform: isActive ? "translateX(24px)" : "translateX(4px)",
                    boxShadow: "0 2px 8px rgba(15,23,42,0.2)",
                  }}
                />
              </button>
            </div>
          </div>

          {/* 仅非 help 智能体显示 Dify 配置区 */}
          {!isHelpAgent ? (
            <>
              <div className="h-px w-full" style={{ background: "var(--border)" }} />

              {/* Dify 配置区 */}
              <div className="flex flex-col gap-3">
            <h5 className="text-[12px] font-semibold" style={{ color: "var(--text-secondary)" }}>Dify 配置</h5>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>Dify Base URL</label>
              <input type="text" value={difyBaseUrl} onChange={(e) => { setDifyBaseUrl(e.target.value); setTestResult(null) }}
                placeholder={DEFAULT_DIFY_BASE_URL}
                className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none transition-all focus:border-[var(--accent)]"
                style={{ background: "var(--secondary)", color: "var(--foreground)", borderColor: "var(--border)" }} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>API Key {editing ? "" : "*"}</label>
              <div className="relative">
                <input type={showKey ? "text" : "password"} value={difyApiKey} onChange={(e) => { setDifyApiKey(e.target.value); setError(""); setTestResult(null) }}
                  placeholder={editing ? "留空表示不修改" : "app-xxxxxxxxxxxxxxxx"}
                  className="w-full rounded-lg border px-3 py-2.5 pr-10 text-[13px] font-mono outline-none transition-all focus:border-[var(--accent)]"
                  style={{ background: "var(--secondary)", color: "var(--foreground)", borderColor: error && !difyApiKey && !editing ? "#EF4444" : difyApiKey ? "var(--success)" : "var(--border)" }} />
                <button onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex h-[28px] w-[28px] items-center justify-center rounded-lg transition-all hover:bg-white/10"
                  style={{ color: "var(--text-secondary)" }} title={showKey ? "隐藏" : "显示"}>
                  {showKey ? (
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                  ) : (
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  )}
                </button>
              </div>
              {editing && !difyApiKey && defaultDifyConfig && (
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>当前已配置 API Key（{defaultDifyConfig.dify_api_key}）</p>
              )}
            </div>
            
            {/* 连通性校验状态 */}
            {testResult && (
              <div
                className="flex items-center gap-2 rounded-lg px-3 py-2 mt-1 text-[11px] font-medium"
                style={{
                  background: testResult.ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                  border: `1px solid ${testResult.ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                  color: testResult.ok ? "#22C55E" : "#EF4444",
                }}
              >
                {testResult.ok ? (
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="flex-shrink-0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                ) : (
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="flex-shrink-0"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                )}
                <span>{testResult.ok ? "连接成功，服务可用" : `连接失败：${testResult.error}`}</span>
              </div>
            )}
              </div>
            </>
          ) : (
            <>
              <div className="h-px w-full" style={{ background: "var(--border)" }} />
              <div className="rounded-lg px-4 py-3 text-[11px]" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", color: "#22C55E" }}>
                <div className="flex items-center gap-2 mb-1">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="flex-shrink-0">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <span className="font-semibold">演示智能体</span>
                </div>
                <p style={{ color: "var(--text-muted)" }}>该智能体使用内置预设内容，无需配置 Dify API。</p>
              </div>
            </>
          )}
        </div>

        {error && <p className="text-[11px] mt-3" style={{ color: "#EF4444" }}>{error}</p>}

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onCancel} className="rounded-xl px-4 py-2 text-[12px] font-medium transition-all hover:bg-white/10" style={{ color: "var(--text-secondary)" }}>取消</button>
          {/* 仅非 help 智能体显示测试连接按钮 */}
          {!isHelpAgent && (
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="rounded-xl px-4 py-2 text-[12px] font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            >
              {testing ? "校验中..." : "测试连接"}
            </button>
          )}
          <button onClick={handleSubmit} disabled={testing} className="rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: "var(--accent)", boxShadow: "var(--shadow-sm)" }}>
            {testing ? "保存中..." : (editing ? "保存" : "添加")}
          </button>
        </div>
      </div>
    </>
  )
})

/** Dify 配置编辑弹窗 */
const DifyConfigDialog = memo(function DifyConfigDialog({
  agentLabel,
  existingConfig,
  onSave,
  onCancel,
}: {
  agentLabel: string
  existingConfig: DifyConfigApi | null
  onSave: (data: { env_label?: string; dify_api_key?: string; dify_base_url?: string; is_default?: boolean }) => void
  onCancel: () => void
}) {
  const isEditing = existingConfig !== null
  const [envLabel, setEnvLabel] = useState(existingConfig?.env_label ?? "默认")
  // 编辑模式下 API Key 留空（避免脱敏值覆盖真实 key）
  const [apiKey, setApiKey] = useState("")
  const [baseUrl, setBaseUrl] = useState(existingConfig?.dify_base_url ?? "")
  const [showKey, setShowKey] = useState(false)
  const [error, setError] = useState("")
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)

  /** 测试连接：调用 testDifyConnection，成功显示绿色、失败显示红色 */
  const handleTestConnection = async () => {
    if (!apiKey.trim()) { setError("请输入 API Key"); return }
    setError("")
    setTesting(true)
    setTestResult(null)
    try {
      const result = await testDifyConnection({
        dify_api_key: apiKey.trim(),
        dify_base_url: baseUrl.trim() || undefined,
      })
      setTestResult(result)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "测试失败"
      setTestResult({ ok: false, error: msg })
    } finally {
      setTesting(false)
    }
  }

  /** 保存：填写了 API Key 时先校验连通性，失败则中止保存 */
  const handleSubmit = async () => {
    if (!isEditing && !apiKey.trim()) { setError("请输入 API Key"); return }

    // 仅在用户输入了 API Key 时校验连通性（编辑模式可只改 Base URL）
    if (apiKey.trim()) {
      setError("")
      setTesting(true)
      setTestResult(null)
      let result: { ok: boolean; error?: string } | null = null
      try {
        result = await testDifyConnection({
          dify_api_key: apiKey.trim(),
          dify_base_url: baseUrl.trim() || undefined,
        })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "测试失败"
        result = { ok: false, error: msg }
      }
      setTesting(false)
      setTestResult(result)
      if (!result.ok) {
        setError(result.error || "连接校验失败，请检查 API Key 和 Base URL")
        return
      }
    }

    onSave({
      env_label: envLabel.trim() || "默认",
      // 编辑模式下若未填写 API Key，则不传该字段，避免空值覆盖
      ...(apiKey.trim() ? { dify_api_key: apiKey.trim() } : {}),
      dify_base_url: baseUrl.trim() || undefined,
      is_default: true,
    })
  }

  return (
    <>
      <div className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 1101, width: "min(400px, calc(100vw - 32px))", background: "var(--card)", borderRadius: "16px", border: "1px solid var(--border)", boxShadow: "0 20px 60px rgba(0,0,0,0.4)", padding: "24px" }}>
        <h4 className="text-[15px] font-bold mb-4" style={{ color: "var(--foreground)" }}>
          配置 Dify API · {agentLabel}
        </h4>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>环境标签</label>
            <input type="text" value={envLabel} onChange={(e) => setEnvLabel(e.target.value)}
              placeholder="默认" maxLength={20}
              className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none transition-all focus:border-[var(--accent)]"
              style={{ background: "var(--secondary)", color: "var(--foreground)", borderColor: "var(--border)" }} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>Dify Base URL</label>
            <input type="text" value={baseUrl} onChange={(e) => { setBaseUrl(e.target.value); setTestResult(null) }}
              placeholder={DEFAULT_DIFY_BASE_URL}
              className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none transition-all focus:border-[var(--accent)]"
              style={{ background: "var(--secondary)", color: "var(--foreground)", borderColor: "var(--border)" }} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-semibold" style={{ color: "var(--foreground)" }}>API Key *</label>
            <div className="relative">
              <input type={showKey ? "text" : "password"} value={apiKey} onChange={(e) => { setApiKey(e.target.value); setError(""); setTestResult(null) }}
                placeholder="app-xxxxxxxxxxxxxxxx"
                className="w-full rounded-lg border px-3 py-2.5 pr-10 text-[13px] font-mono outline-none transition-all focus:border-[var(--accent)]"
                style={{ background: "var(--secondary)", color: "var(--foreground)", borderColor: error ? "#EF4444" : apiKey ? "var(--success)" : "var(--border)" }} />
              <button onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-[28px] w-[28px] items-center justify-center rounded-lg transition-all hover:bg-white/10"
                style={{ color: "var(--text-secondary)" }} title={showKey ? "隐藏" : "显示"}>
                {showKey ? (
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                ) : (
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                )}
              </button>
            </div>
            {error && <p className="text-[10px]" style={{ color: "#EF4444" }}>{error}</p>}
            {apiKey && !error && <p className="text-[10px]" style={{ color: "var(--success)" }}>✓ 已填写（{apiKey.slice(0, 8)}...）</p>}
            {!apiKey && <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>在 Dify 对应应用「API 访问」页面中获取</p>}
          </div>
        </div>

        {/* 连通性校验状态：成功绿色 / 失败红色 */}
        {testResult && (
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2 mt-3 text-[11px] font-medium"
            style={{
              background: testResult.ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
              border: `1px solid ${testResult.ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
              color: testResult.ok ? "#22C55E" : "#EF4444",
            }}
          >
            {testResult.ok ? (
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="flex-shrink-0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
            ) : (
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="flex-shrink-0"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
            )}
            <span>{testResult.ok ? "连接成功，服务可用" : `连接失败：${testResult.error}`}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onCancel} className="rounded-xl px-4 py-2 text-[12px] font-medium transition-all hover:bg-white/10" style={{ color: "var(--text-secondary)" }}>取消</button>
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="rounded-xl px-4 py-2 text-[12px] font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" }}
          >
            {testing ? "校验中..." : "测试连接"}
          </button>
          <button
            onClick={handleSubmit}
            disabled={testing}
            className="rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "var(--accent)", boxShadow: "var(--shadow-sm)" }}
          >
            {testing ? "校验中..." : "保存配置"}
          </button>
        </div>
      </div>
    </>
  )
})

/** 编辑按钮 */
const EditButton = memo(function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick() }}
      className="flex h-[28px] w-[28px] items-center justify-center rounded-lg transition-all hover:bg-white/10"
      style={{ color: "var(--text-secondary)" }} title="编辑">
      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    </button>
  )
})

/** 删除按钮 */
const DeleteButton = memo(function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick() }}
      className="flex h-[28px] w-[28px] items-center justify-center rounded-lg transition-all hover:bg-red-500/10 hover:text-red-400"
      style={{ color: "var(--text-muted)" }} title="删除">
      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
      </svg>
    </button>
  )
})

/* ───── 主页面 ───── */

export default function SettingsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const admin = isAdmin(user?.roles)
  const backTimerRef = useRef<number | null>(null)

  /* ── 状态 ── */
  const [agents, setAgents] = useState<AgentDefApi[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // 展开的 agent（显示 Dify 配置详情）
  const [expandedAgentId, setExpandedAgentId] = useState<number | null>(null)
  // 选中的 agent 的 Dify 配置列表（按需加载）
  const [difyConfigsMap, setDifyConfigsMap] = useState<Record<number, DifyConfigApi[]>>({})

  // 弹窗
  const [formOpen, setFormOpen] = useState(false)
  const [editingAgent, setEditingAgent] = useState<AgentDefApi | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<AgentDefApi | null>(null)
  const [configDialogOpen, setConfigDialogOpen] = useState(false)
  const [configTargetAgent, setConfigTargetAgent] = useState<AgentDefApi | null>(null)
  const [configEditing, setConfigEditing] = useState<DifyConfigApi | null>(null)
  const [isReturningHome, setIsReturningHome] = useState(false)

  /* ── 显示提示 ── */
  const showMessage = useCallback((type: "success" | "error", text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 1600)
  }, [])

  /* ── 加载 Agent 列表 ── */
  const loadAgents = useCallback(async () => {
    try {
      const res = await getAgents()
      setAgents(res.agents || [])
    } catch {
      showMessage("error", "加载应用列表失败")
    }
  }, [showMessage])

  useEffect(() => {
    loadAgents().finally(() => setLoading(false))
  }, [loadAgents])

  useEffect(() => {
    router.prefetch("/")
  }, [router])

  useEffect(() => {
    return () => {
      if (backTimerRef.current !== null) {
        window.clearTimeout(backTimerRef.current)
      }
    }
  }, [])

  /* ── 展开/折叠 agent 详情（按需加载 Dify 配置） ── */
  const handleToggleExpand = useCallback(async (agentId: number) => {
    if (expandedAgentId === agentId) {
      setExpandedAgentId(null)
      return
    }
    setExpandedAgentId(agentId)
    // 如果还没加载过配置，请求加载
    if (!difyConfigsMap[agentId]) {
      try {
        const res = await getDifyConfigs(agentId)
        setDifyConfigsMap((prev) => ({ ...prev, [agentId]: res.dify_configs || [] }))
      } catch {
        showMessage("error", "加载配置失败")
      }
    }
  }, [expandedAgentId, difyConfigsMap, showMessage])

  /* ── Agent CRUD（仅管理员） ── */

  const handleAddAgent = useCallback(() => {
    if (!admin) return
    setEditingAgent(null)
    setFormOpen(true)
  }, [admin])

  const handleEditAgent = useCallback((agent: AgentDefApi) => {
    if (!admin) return
    setEditingAgent(agent)
    setFormOpen(true)
  }, [admin])

  const handleAgentFormSave = useCallback(async (data: CreateAgentRequest) => {
    setSaving(true)
    try {
      if (editingAgent) {
        await updateAgent(editingAgent.id, { 
          label: data.label, 
          desc: data.desc, 
          quick_questions: data.quick_questions, 
          gradient: data.gradient,
          is_active: data.is_active,
          dify_config: data.dify_config
        })
        showMessage("success", "应用已更新")
      } else {
        await createAgent(data)
        showMessage("success", "应用已创建")
      }
      await loadAgents()
      setFormOpen(false)
      setEditingAgent(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "操作失败"
      showMessage("error", msg)
    } finally {
      setSaving(false)
    }
  }, [editingAgent, showMessage, loadAgents])

  const handleDeleteClick = useCallback((agent: AgentDefApi) => {
    if (!admin) return
    setDeleteConfirm(agent)
  }, [admin])

  const confirmDeleteAgent = useCallback(async () => {
    if (!deleteConfirm) return
    setSaving(true)
    try {
      await deleteAgent(deleteConfirm.id)
      showMessage("success", `「${deleteConfirm.label}」已删除`)
      await loadAgents()
      if (expandedAgentId === deleteConfirm.id) setExpandedAgentId(null)
      setDeleteConfirm(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "删除失败"
      showMessage("error", msg)
    } finally {
      setSaving(false)
    }
  }, [deleteConfirm, showMessage, loadAgents, expandedAgentId])

  /* ── Dify 配置管理（仅管理员） ── */

  const handleConfigClick = useCallback((agent: AgentDefApi) => {
    if (!admin) return
    const existing = agent.dify_configs?.find((c) => c.is_default) || null
    setConfigTargetAgent(agent)
    setConfigEditing(existing)
    setConfigDialogOpen(true)
  }, [admin])

  const handleConfigSave = useCallback(async (data: { env_label?: string; dify_api_key?: string; dify_base_url?: string; is_default?: boolean }) => {
    if (!configTargetAgent) return
    setSaving(true)
    try {
      if (configEditing) {
        await updateDifyConfig(configEditing.id, data as UpdateDifyConfigRequest)
      } else {
        await createDifyConfig(configTargetAgent.id, data as CreateDifyConfigRequest)
      }
      showMessage("success", "Dify 配置已保存")
      // 刷新该 agent 的配置
      const res = await getDifyConfigs(configTargetAgent.id)
      setDifyConfigsMap((prev) => ({ ...prev, [configTargetAgent.id]: res.dify_configs || [] }))
      setConfigDialogOpen(false)
      setConfigTargetAgent(null)
      setConfigEditing(null)
      // 刷新 agent 列表以更新 dify_configs
      await loadAgents()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "保存配置失败"
      showMessage("error", msg)
    } finally {
      setSaving(false)
    }
  }, [configTargetAgent, configEditing, showMessage, loadAgents])

  /* ── 拖拽排序 ── */
  const handleDragEnd = useCallback(async (result: DropResult) => {
    if (!result.destination) return
    if (result.source.index === result.destination.index) return

    const newAgents = Array.from(agents)
    const [reorderedItem] = newAgents.splice(result.source.index, 1)
    newAgents.splice(result.destination.index, 0, reorderedItem)

    // 乐观更新 UI
    setAgents(newAgents)

    // 调用后端 API 保存新顺序
    try {
      const agentIds = newAgents.map(a => a.id)
      await reorderAgents(agentIds)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "排序保存失败"
      showMessage("error", msg)
      // 恢复原顺序
      loadAgents()
    }
  }, [agents, showMessage, loadAgents])

  /* ── 回首页 ── */
  const handleBack = useCallback(() => {
    if (isReturningHome) return

    setIsReturningHome(true)

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("app-route-transition-start"))
      backTimerRef.current = window.setTimeout(() => {
        router.push("/")
      }, 120)
    } else {
      router.push("/")
    }
  }, [isReturningHome, router])

  /* ── 派生数据 ── */
  const totalConfigured = agents.filter((a) => a.dify_configs?.some((c) => c.is_default && c.dify_api_key)).length

  /* ── 加载中 ── */
  if (loading) {
    return (
      <div className="settings-page" style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
          <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>加载设置中...</span>
        </div>
      </div>
    )
  }

  /* ── 渲染 ── */
  return (
    <>
      <div className="settings-page" style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ background: "var(--primary)", borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <button onClick={handleBack} className="flex h-[36px] w-[36px] items-center justify-center rounded-xl transition-all hover:bg-white/10" style={{ color: "var(--text-secondary)" }} aria-label="返回">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <div>
              <h3 className="text-[16px] font-bold flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                API 设置
              </h3>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                {admin ? "管理员模式 · " : "只读模式 · "}
                {totalConfigured}/{agents.length} 个应用已配置
              </p>
            </div>
          </div>
          {/* 提示 toast */}
          {message && (
            <div className={`rounded-xl px-3 py-1.5 text-[12px] font-medium animate-fadeIn ${message.type === "success" ? "text-green-400 bg-green-500/10" : "text-red-400 bg-red-500/10"}`}>
              {message.text}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-col gap-5 px-6 py-5 max-w-[540px] mx-auto">
          {/* 应用管理 */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-[0.5px]" style={{ color: "var(--text-muted)" }}>
                应用列表
              </label>
              {admin && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{totalConfigured}/{agents.length} 已配置</span>
                  <button
                    onClick={handleAddAgent}
                    disabled={saving}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-50"
                    style={{ background: "var(--accent)", color: "var(--accent-foreground)", boxShadow: "var(--shadow-sm)" }}
                  >
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    新增
                  </button>
                </div>
              )}
            </div>

            {agents.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 rounded-xl border border-dashed" style={{ borderColor: "var(--border)", background: "var(--secondary)" }}>
                <span className="text-2xl">🤖</span>
                <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>暂无应用</p>
                {admin && <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>点击「新增」添加应用</p>}
              </div>
            ) : (
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="agents-list">
                  {(provided) => (
                    <div 
                      className="flex flex-col gap-2"
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                    >
                      {agents.map((agent, index) => {
                        const defaultCfg = agent.dify_configs?.find((c) => c.is_default)
                        const hasKey = !!defaultCfg?.dify_api_key
                        const isExpanded = expandedAgentId === agent.id
                        const configs = difyConfigsMap[agent.id] || agent.dify_configs || []

                        return (
                          <Draggable key={agent.id.toString()} draggableId={agent.id.toString()} index={index} isDragDisabled={!admin}>
                            {(provided, snapshot) => (
                              <div 
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                style={{ 
                                  borderRadius: "12px", 
                                  border: `1.5px solid ${isExpanded ? "var(--accent)" : "var(--border)"}`, 
                                  background: isExpanded ? "var(--secondary)" : "var(--card)", 
                                  transition: snapshot.isDragging ? "none" : "all 0.2s ease", 
                                  overflow: "hidden",
                                  boxShadow: snapshot.isDragging ? "0 10px 20px rgba(0,0,0,0.15)" : "none",
                                  ...provided.draggableProps.style
                                }}
                              >
                                {/* 行头部：可点击展开 */}
                                <div role="button" tabIndex={0}
                                  onClick={() => handleToggleExpand(agent.id)}
                                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleToggleExpand(agent.id) } }}
                                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all hover:bg-white/5 cursor-pointer select-none"
                                >
                                  {/* 拖拽手柄 */}
                                  {admin && (
                                    <div 
                                      {...provided.dragHandleProps}
                                      className="flex items-center justify-center w-6 h-6 rounded text-gray-400 hover:text-gray-600 hover:bg-black/5 transition-colors cursor-grab active:cursor-grabbing"
                                      onClick={(e) => e.stopPropagation()} // 防止触发展开
                                    >
                                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <circle cx="9" cy="5" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="19" r="1" />
                                        <circle cx="15" cy="5" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="19" r="1" />
                                      </svg>
                                    </div>
                                  )}
                                  <span className="flex items-center justify-center w-9 h-9 rounded-lg text-base flex-shrink-0" style={{ background: agent.gradient || "var(--gradient-1)", color: "white" }}>
                                    {agent.label?.slice(0, 1)}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>{agent.label}</span>
                                      {hasKey && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "var(--success)" }} />}
                                    </div>
                                    <span className="text-[11px] truncate block" style={{ color: "var(--text-muted)" }}>{agent.desc || agent.agent_id}{hasKey ? ` · 已配置` : " · 未配置"}</span>
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    {admin && <EditButton onClick={() => handleEditAgent(agent)} />}
                                    {admin && <DeleteButton onClick={() => handleDeleteClick(agent)} />}
                                  </div>
                                </div>

                                {/* 展开详情 */}
                                {isExpanded && (
                                  <div className="config-expand" style={{ padding: "0 16px 16px", animation: "expandDown 0.2s ease" }}>
                                    <div className="flex flex-col gap-3 rounded-lg border p-4" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
                                      <div className="flex items-center justify-between">
                                        <span className="text-[12px] font-semibold" style={{ color: "var(--foreground)" }}>Dify API 配置</span>
                                        {admin && (
                                          <button
                                            onClick={() => handleConfigClick(agent)}
                                            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold transition-all hover:-translate-y-0.5"
                                            style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
                                          >
                                            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                            {defaultCfg ? "编辑配置" : "添加配置"}
                                          </button>
                                        )}
                                      </div>

                                      {configs.length === 0 ? (
                                        <p className="text-[11px] text-center py-3" style={{ color: "var(--text-muted)" }}>
                                          {admin ? "点击上方按钮添加 Dify API 配置" : "暂无配置"}
                                        </p>
                                      ) : (
                                        <div className="flex flex-col gap-2">
                                          {configs.map((cfg) => (
                                            <div key={cfg.id} className="flex items-center gap-3 rounded-lg border px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.is_default ? "bg-green-400" : "bg-gray-400"}`} />
                                              <div className="flex-1 min-w-0">
                                                <div className="text-[11px] font-semibold" style={{ color: "var(--foreground)" }}>{cfg.env_label || "默认"}</div>
                                                <div className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
                                                  {cfg.dify_base_url || DEFAULT_DIFY_BASE_URL} · {cfg.dify_api_key.slice(0, 8)}...
                                                </div>
                                              </div>
                                              {cfg.is_default && <span className="text-[9px] rounded px-1.5 py-0.5 flex-shrink-0" style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}>默认</span>}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </Draggable>
                        )
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </div>

          {/* 提示信息 */}
          <div className="flex items-start gap-2 rounded-xl border px-4 py-3" style={{ background: "var(--secondary)", borderColor: "var(--border)" }}>
            <span className="text-xs mt-0.5 flex-shrink-0">💡</span>
            <div className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {admin ? (
                <>管理员可新增、编辑、删除应用，并为每个应用配置独立的 Dify API Key 和 Base URL。</>
              ) : (
                <>您以普通用户身份登录，仅可查看应用列表。如需管理应用和配置 API Key，请联系管理员。</>
              )}
            </div>
          </div>
        </div>

        {/* Footer 已移除 */}
      </div>

      {/* Agent 表单弹窗 */}
      {formOpen && (
        <AgentFormDialog
          editing={editingAgent}
          onSave={handleAgentFormSave}
          onCancel={() => { setFormOpen(false); setEditingAgent(null) }}
        />
      )}

      {/* 删除确认弹窗 */}
      {deleteConfirm && (
        <ConfirmDialog
          title="删除应用"
          message={`确定要删除「${deleteConfirm.label}」吗？相关的 Dify API 配置也会被清除。`}
          onConfirm={confirmDeleteAgent}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {/* Dify 配置弹窗 */}
      {configDialogOpen && configTargetAgent && (
        <DifyConfigDialog
          agentLabel={configTargetAgent.label}
          existingConfig={configEditing}
          onSave={handleConfigSave}
          onCancel={() => { setConfigDialogOpen(false); setConfigTargetAgent(null); setConfigEditing(null) }}
        />
      )}
    </>
  )
}
