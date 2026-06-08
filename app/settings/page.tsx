"use client"

import { memo, useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { loadSettings, saveSettings } from "@/lib/settings-store"
import type { DifySettings, AgentApiConfig, AgentDef } from "@/lib/settings-store"

/* ───── 渐变色预设（供新增/编辑 Agent 选择） ───── */
const GRADIENT_PRESETS = [
  { value: "var(--gradient-1)", label: "蓝色", preview: "linear-gradient(135deg, #0052CC, #0082FF)" },
  { value: "var(--gradient-2)", label: "橙色", preview: "linear-gradient(135deg, #F97316, #FB923C)" },
  { value: "var(--gradient-3)", label: "绿色", preview: "linear-gradient(135deg, #10B981, #34D399)" },
  { value: "var(--gradient-4)", label: "紫色", preview: "linear-gradient(135deg, #8B5CF6, #A78BFA)" },
]

/* ───── 删除确认弹窗 ───── */
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
      <div
        className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div
        className="confirm-dialog"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 1101,
          width: "min(360px, calc(100vw - 32px))",
          background: "var(--card)",
          borderRadius: "16px",
          border: "1px solid var(--border)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          padding: "24px",
          animation: "fadeSlideUp 0.2s ease",
        }}
      >
        <h4 className="text-[15px] font-bold mb-2" style={{ color: "var(--foreground)" }}>
          {title}
        </h4>
        <p className="text-[13px] mb-6" style={{ color: "var(--text-secondary)" }}>
          {message}
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-xl px-4 py-2 text-[12px] font-medium transition-all hover:bg-white/10"
            style={{ color: "var(--text-secondary)" }}
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all hover:-translate-y-0.5"
            style={{ background: "#EF4444", boxShadow: "0 2px 8px rgba(239,68,68,0.3)" }}
          >
            确认删除
          </button>
        </div>
      </div>
    </>
  )
})

/* ───── 新增/编辑 Agent 弹窗 ───── */
const AgentFormDialog = memo(function AgentFormDialog({
  editing,
  initial,
  onSave,
  onCancel,
}: {
  editing: AgentDef | null
  initial: {
    label: string
    desc: string
    icon: string
    gradient: string
  }
  onSave: (def: AgentDef) => void
  onCancel: () => void
}) {
  const [label, setLabel] = useState(initial.label)
  const [desc, setDesc] = useState(initial.desc)
  const [icon, setIcon] = useState(initial.icon)
  const [gradient, setGradient] = useState(initial.gradient)
  const [error, setError] = useState("")

  const handleSubmit = () => {
    if (!label.trim()) {
      setError("请输入应用名称")
      return
    }
    const def: AgentDef = {
      id: editing?.id ?? `agent-${Date.now()}`,
      label: label.trim(),
      desc: desc.trim() || "自定义应用",
      icon: icon.trim() || "🤖",
      gradient: gradient || "var(--gradient-1)",
    }
    onSave(def)
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div
        className="agent-form-dialog"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 1101,
          width: "min(380px, calc(100vw - 32px))",
          background: "var(--card)",
          borderRadius: "16px",
          border: "1px solid var(--border)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          padding: "24px",
          animation: "fadeSlideUp 0.2s ease",
        }}
      >
        <h4
          className="text-[15px] font-bold mb-4"
          style={{ color: "var(--foreground)" }}
        >
          {editing ? "编辑应用" : "新增应用"}
        </h4>

        <div className="flex flex-col gap-3">
          {/* 名称 */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
              应用名称 *
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value)
                setError("")
              }}
              placeholder="例如：智能问答"
              maxLength={6}
              className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none transition-all focus:border-[var(--accent)]"
              style={{
                background: "var(--secondary)",
                color: "var(--foreground)",
                borderColor: error ? "#EF4444" : "var(--border)",
              }}
            />
            {error && <p className="text-[10px]" style={{ color: "#EF4444" }}>{error}</p>}
          </div>

          {/* 描述 */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
              描述
            </label>
            <input
              type="text"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="简短描述"
              className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none transition-all focus:border-[var(--accent)]"
              style={{
                background: "var(--secondary)",
                color: "var(--foreground)",
                borderColor: "var(--border)",
              }}
            />
          </div>

          {/* 图标 */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
              图标（Emoji）
            </label>
            <input
              type="text"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="🤖"
              maxLength={2}
              className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none transition-all focus:border-[var(--accent)]"
              style={{
                background: "var(--secondary)",
                color: "var(--foreground)",
                borderColor: "var(--border)",
              }}
            />
          </div>

          {/* 渐变色 */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
              主题色
            </label>
            <div className="flex gap-2">
              {GRADIENT_PRESETS.map((g) => (
                <button
                  key={g.value}
                  onClick={() => setGradient(g.value)}
                  className="w-9 h-9 rounded-lg border-2 transition-all hover:scale-110"
                  style={{
                    background: g.preview,
                    borderColor: gradient === g.value ? "var(--foreground)" : "transparent",
                    boxShadow: gradient === g.value ? "0 0 0 2px var(--glow)" : "none",
                  }}
                  title={g.label}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onCancel}
            className="rounded-xl px-4 py-2 text-[12px] font-medium transition-all hover:bg-white/10"
            style={{ color: "var(--text-secondary)" }}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all hover:-translate-y-0.5"
            style={{ background: "var(--accent)", boxShadow: "var(--shadow-sm)" }}
          >
            {editing ? "保存" : "添加"}
          </button>
        </div>
      </div>
    </>
  )
})

/* ───── 小按钮组件 ───── */

const EditButton = memo(function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="flex h-[28px] w-[28px] items-center justify-center rounded-lg transition-all hover:bg-white/10"
      style={{ color: "var(--text-secondary)" }}
      title="编辑"
    >
      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    </button>
  )
})

const DeleteButton = memo(function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="flex h-[28px] w-[28px] items-center justify-center rounded-lg transition-all hover:bg-red-500/10 hover:text-red-400"
      style={{ color: "var(--text-muted)" }}
      title="删除"
    >
      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
      </svg>
    </button>
  )
})

/* ───── 设置页面 ───── */

export default function SettingsPage() {
  const router = useRouter()

  const [apiUrl, setApiUrl] = useState("")
  const [useMock, setUseMock] = useState(true)
  const [agents, setAgents] = useState<Record<string, AgentApiConfig>>({})
  const [agentDefs, setAgentDefs] = useState<AgentDef[]>([])
  const [activeAgent, setActiveAgent] = useState<string>("")
  const [saved, setSaved] = useState(false)
  const [showKey, setShowKey] = useState(false)

  // 新增/编辑 Agent 弹窗
  const [formOpen, setFormOpen] = useState(false)
  const [editingAgent, setEditingAgent] = useState<AgentDef | null>(null)

  // 删除确认弹窗
  const [deleteConfirm, setDeleteConfirm] = useState<AgentDef | null>(null)

  // 加载已有设置（页面加载时）
  useEffect(() => {
    const s = loadSettings()
    setApiUrl(s.apiUrl || "")
    setUseMock(s.useMock ?? true)
    setAgents(s.agents || {})
    setAgentDefs(s.agentDefs || [])
    setSaved(false)
    // 默认选中第一个，或第一个已配置的
    const configured = (s.agentDefs || []).find((d) => s.agents?.[d.id]?.apiKey)
    setActiveAgent(configured?.id ?? (s.agentDefs || [])[0]?.id ?? "")
  }, [])

  const currentAgentCfg = agents[activeAgent]
  const currentAgentKey = currentAgentCfg?.apiKey || ""
  const currentAgentUrl = currentAgentCfg?.apiUrl || ""

  const handleAgentKeyChange = useCallback((val: string) => {
    setAgents((prev) => ({
      ...prev,
      [activeAgent]: { ...prev[activeAgent], apiKey: val, apiUrl: prev[activeAgent]?.apiUrl },
    }))
  }, [activeAgent])

  const handleAgentUrlChange = useCallback((val: string) => {
    setAgents((prev) => ({
      ...prev,
      [activeAgent]: { ...prev[activeAgent], apiUrl: val, apiKey: prev[activeAgent]?.apiKey || "" },
    }))
  }, [activeAgent])

  const handleSave = useCallback(() => {
    const settings: DifySettings = {
      apiUrl: apiUrl.trim(),
      useMock,
      agents,
      agentDefs,
    }
    saveSettings(settings)
    setSaved(true)
    setTimeout(() => {
      router.push("/")
    }, 800)
  }, [apiUrl, useMock, agents, agentDefs, router])

  const handleReset = useCallback(() => {
    setApiUrl("")
    setUseMock(true)
    setAgents({})
    setAgentDefs([])
    setShowKey(false)
    setActiveAgent("")
    saveSettings({ apiUrl: "", useMock: true, agents: {}, agentDefs: [] })
  }, [])

  const handleBack = useCallback(() => {
    router.push("/")
  }, [router])

  // Agent CRUD
  const handleAddAgent = useCallback(() => {
    setEditingAgent(null)
    setFormOpen(true)
  }, [])

  const handleEditAgent = useCallback((def: AgentDef) => {
    setEditingAgent(def)
    setFormOpen(true)
  }, [])

  const handleAgentFormSave = useCallback((def: AgentDef) => {
    if (editingAgent) {
      // 编辑模式
      setAgentDefs((prev) => prev.map((d) => (d.id === def.id ? def : d)))
    } else {
      // 新增
      setAgentDefs((prev) => [...prev, def])
      setActiveAgent(def.id)
    }
    setFormOpen(false)
    setEditingAgent(null)
  }, [editingAgent])

  const handleDeleteAgent = useCallback((def: AgentDef) => {
    setDeleteConfirm(def)
  }, [])

  const confirmDeleteAgent = useCallback(() => {
    if (!deleteConfirm) return
    const id = deleteConfirm.id
    setAgentDefs((prev) => prev.filter((d) => d.id !== id))
    // 清理对应的 API 配置
    setAgents((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    // 如果删除的是当前选中的，切换到第一个
    if (activeAgent === id) {
      const remaining = agentDefs.filter((d) => d.id !== id)
      setActiveAgent(remaining[0]?.id ?? "")
    }
    setDeleteConfirm(null)
  }, [deleteConfirm, activeAgent, agentDefs])

  const currentConfigured = !!currentAgentKey.trim()
  const anyConfigured = Object.values(agents).some((a) => !!a?.apiKey?.trim())
  const totalConfigured = Object.values(agents).filter((a) => !!a?.apiKey?.trim()).length

  return (
    <>
      {/* 页面容器 */}
      <div
        className="settings-page"
        style={{
          minHeight: "100vh",
          background: "var(--background)",
          color: "var(--foreground)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{
            background: "var(--primary)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="flex h-[36px] w-[36px] items-center justify-center rounded-xl transition-all hover:bg-white/10"
              style={{ color: "var(--text-secondary)" }}
              aria-label="返回"
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
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
                配置 Dify API 连接信息 · {totalConfigured}/{agentDefs.length} 个应用已配置
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-5 px-6 py-5 max-w-[520px] mx-auto">
          {/* ─── 全局配置 ─── */}
          <div className="flex flex-col gap-3">
            <label
              className="text-[11px] font-bold uppercase tracking-[0.5px]"
              style={{ color: "var(--text-muted)" }}
            >
              全局设置
            </label>

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
                各应用可单独覆盖此地址，留空则使用此全局地址
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
                  className="toggle-knob"
                  style={{
                    position: "absolute",
                    top: "3px",
                    height: "22px",
                    width: "22px",
                    borderRadius: "50%",
                    background: "white",
                    left: useMock ? "calc(100% - 25px)" : "3px",
                    transition: "left 0.2s ease",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }}
                />
              </button>
            </div>
          </div>

          {/* ─── 分隔线 ─── */}
          <div style={{ height: 1, background: "var(--border)", margin: "0 -24px" }} />

          {/* ─── 应用管理 ─── */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label
                className="text-[11px] font-bold uppercase tracking-[0.5px]"
                style={{ color: "var(--text-muted)" }}
              >
                应用管理
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {totalConfigured}/{agentDefs.length} 已配置
                </span>
                <button
                  onClick={handleAddAgent}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all hover:-translate-y-0.5"
                  style={{
                    background: "var(--accent)",
                    color: "var(--accent-foreground)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  新增
                </button>
              </div>
            </div>

            {/* Agent 列表 */}
            {agentDefs.length === 0 ? (
              <div
                className="flex flex-col items-center gap-2 py-6 rounded-xl border border-dashed"
                style={{ borderColor: "var(--border)", background: "var(--secondary)" }}
              >
                <span className="text-2xl">🤖</span>
                <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                  暂无应用，点击「新增」添加
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {agentDefs.map((agent) => {
                  const cfg = agents[agent.id]
                  const hasKey = !!cfg?.apiKey?.trim()
                  const isActive = activeAgent === agent.id

                  return (
                    <div
                      key={agent.id}
                      className="agent-settings-row"
                      style={{
                        borderRadius: "12px",
                        border: `1.5px solid ${isActive ? "var(--accent)" : "var(--border)"}`,
                        background: isActive ? "var(--secondary)" : "var(--card)",
                        transition: "all 0.2s ease",
                        overflow: "hidden",
                      }}
                    >
                      {/* Row header: select & actions */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setActiveAgent(agent.id)
                          setShowKey(false)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            setActiveAgent(agent.id)
                            setShowKey(false)
                          }
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all hover:bg-white/5 cursor-pointer select-none"
                      >
                        <span
                          className="flex items-center justify-center w-9 h-9 rounded-lg text-base flex-shrink-0"
                          style={{
                            background: agent.gradient,
                            color: "white",
                          }}
                        >
                          {agent.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="text-[13px] font-semibold"
                              style={{ color: "var(--foreground)" }}
                            >
                              {agent.label}
                            </span>
                            {hasKey && (
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ background: "var(--success)" }}
                              />
                            )}
                          </div>
                          <span
                            className="text-[11px] truncate block"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {agent.desc}
                            {hasKey ? ` · ${cfg!.apiKey!.slice(0, 8)}...` : " · 未配置"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <EditButton onClick={() => handleEditAgent(agent)} />
                          <DeleteButton onClick={() => handleDeleteAgent(agent)} />
                        </div>
                      </div>

                      {/* Expanded config */}
                      {isActive && (
                        <div
                          className="config-expand"
                          style={{
                            padding: "0 16px 16px",
                            animation: "expandDown 0.2s ease",
                          }}
                        >
                          <div className="flex flex-col gap-3 rounded-lg border p-4" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
                            {/* Agent 独立 URL */}
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
                                应用专属 URL（可选）
                              </label>
                              <input
                                type="text"
                                value={currentAgentUrl}
                                onChange={(e) => handleAgentUrlChange(e.target.value)}
                                placeholder={apiUrl || "使用全局 URL"}
                                className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none transition-all focus:border-[var(--accent)]"
                                style={{
                                  background: "var(--secondary)",
                                  color: "var(--foreground)",
                                  borderColor: "var(--border)",
                                }}
                              />
                            </div>

                            {/* API Key */}
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[12px] font-semibold" style={{ color: "var(--foreground)" }}>
                                API Key
                              </label>
                              <div className="relative">
                                <input
                                  type={showKey ? "text" : "password"}
                                  value={currentAgentKey}
                                  onChange={(e) => handleAgentKeyChange(e.target.value)}
                                  placeholder="app-xxxxxxxxxxxxxxxx"
                                  className="w-full rounded-lg border px-3 py-2.5 pr-10 text-[13px] font-mono outline-none transition-all focus:border-[var(--accent)]"
                                  style={{
                                    background: "var(--secondary)",
                                    color: "var(--foreground)",
                                    borderColor: currentConfigured ? "var(--success)" : "var(--border)",
                                  }}
                                />
                                <button
                                  onClick={() => setShowKey(!showKey)}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 flex h-[28px] w-[28px] items-center justify-center rounded-lg transition-all hover:bg-white/10"
                                  style={{ color: "var(--text-secondary)" }}
                                  title={showKey ? "隐藏" : "显示"}
                                >
                                  {showKey ? (
                                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                      <line x1="1" y1="1" x2="23" y2="23" />
                                    </svg>
                                  ) : (
                                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                      <circle cx="12" cy="12" r="3" />
                                    </svg>
                                  )}
                                </button>
                              </div>
                              {currentConfigured ? (
                                <p className="text-[10px]" style={{ color: "var(--success)" }}>
                                  ✓ 已配置（{currentAgentKey.slice(0, 8)}...）
                                </p>
                              ) : (
                                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                                  在 Dify 对应应用「API 访问」页面中获取
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 提示 */}
          <div
            className="flex items-start gap-2 rounded-xl border px-4 py-3"
            style={{
              background: "var(--secondary)",
              borderColor: "var(--border)",
            }}
          >
            <span className="text-xs mt-0.5 flex-shrink-0">💡</span>
            <div className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
              每个应用对应 Dify 中的一个独立应用，请为每个应用配置独立的 API Key。
              可随时新增、编辑或删除应用。
              {!anyConfigured && !useMock && (
                <span className="block mt-1 font-semibold" style={{ color: "var(--warning)" }}>
                  ⚠️ 未配置任何 API Key 且关闭 Mock 模式将无法使用
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between gap-3 px-6 py-4"
          style={{
            background: "var(--primary)",
            borderTop: "1px solid var(--border)",
          }}
        >
          <button
            onClick={handleReset}
            className="rounded-xl px-3 py-2 text-[12px] font-medium transition-all hover:bg-white/10"
            style={{ color: "var(--text-muted)" }}
          >
            重置全部
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBack}
              className="rounded-xl px-5 py-2 text-[12px] font-medium transition-all hover:bg-white/10"
              style={{ color: "var(--text-secondary)" }}
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 rounded-xl px-5 py-2 text-[12px] font-semibold text-white transition-all hover:-translate-y-0.5"
              style={{
                background: saved ? "var(--gradient-4)" : "var(--accent)",
                boxShadow: "var(--shadow-sm)",
                opacity: useMock || anyConfigured ? 1 : 0.5,
              }}
              disabled={!useMock && !anyConfigured}
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

      {/* 新增/编辑弹窗（仍为模态浮层） */}
      {formOpen && (
        <AgentFormDialog
          editing={editingAgent}
          initial={
            editingAgent
              ? { label: editingAgent.label, desc: editingAgent.desc, icon: editingAgent.icon, gradient: editingAgent.gradient }
              : { label: "", desc: "", icon: "🤖", gradient: "var(--gradient-1)" }
          }
          onSave={handleAgentFormSave}
          onCancel={() => {
            setFormOpen(false)
            setEditingAgent(null)
          }}
        />
      )}

      {/* 删除确认弹窗（仍为模态浮层） */}
      {deleteConfirm && (
        <ConfirmDialog
          title="删除应用"
          message={`确定要删除「${deleteConfirm.label}」吗？相关的 API 配置也会被清除。`}
          onConfirm={confirmDeleteAgent}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </>
  )
}