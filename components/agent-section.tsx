"use client"

import type { AgentType } from "@/app/page"

interface AgentSectionProps {
  currentAgent: AgentType
  onSelectAgent: (agent: AgentType) => void
}

interface AgentCard {
  id: AgentType
  label: string
  icon: string
  desc: string
  gradient: string
}

const agents: AgentCard[] = [
  {
    id: "knowledge",
    label: "海油知识库",
    icon: "📚",
    desc: "标准法规 · 安全规程",
    gradient: "var(--gradient-1)",
  },
  {
    id: "inspection",
    label: "无纸化巡检",
    icon: "📸",
    desc: "AI视觉 · 隐患识别",
    gradient: "var(--gradient-2)",
  },
  {
    id: "repair",
    label: "维修知识库",
    icon: "🔧",
    desc: "设备诊断 · 随身师傅",
    gradient: "var(--gradient-3)",
  },
  {
    id: "report",
    label: "日报填报",
    icon: "📊",
    desc: "数据校验 · 自动填报",
    gradient: "var(--gradient-4)",
  },
]

export function AgentSection({ currentAgent, onSelectAgent }: AgentSectionProps) {
  return (
    <div
      className="flex-shrink-0 border-b px-5 py-3"
      style={{
        background: "var(--primary)",
        borderColor: "var(--border)",
      }}
    >
      {/* 桌面标签 */}
      <div className="hidden sm:flex gap-2 overflow-x-auto pb-0.5">
        {agents.map((agent) => {
          const isActive = currentAgent === agent.id
          return (
            <button
              key={agent.id}
              onClick={() => onSelectAgent(agent.id)}
              className={`agent-tab group ${isActive ? "active" : ""}`}
              style={
                isActive
                  ? {
                      background: agent.gradient,
                      color: "white",
                      boxShadow: `0 2px 12px ${agent.gradient.replace("var(", "").replace(")", "").replace("--gradient-1", "rgba(0,82,204,0.4)")
                        .replace("--gradient-2", "rgba(249,115,22,0.4)")
                        .replace("--gradient-3", "rgba(16,185,129,0.4)")
                        .replace("--gradient-4", "rgba(139,92,246,0.4)")}`,
                    }
                  : {
                      background: "var(--card)",
                      borderColor: "var(--border)",
                      color: "var(--text-secondary)",
                    }
              }
            >
              <span className="agent-tab-icon">{agent.icon}</span>
              <div className="agent-tab-text">
                <div
                  className="agent-tab-label"
                  style={{ color: isActive ? "white" : "var(--foreground)" }}
                >
                  {agent.label}
                </div>
                <div
                  className="agent-tab-desc"
                  style={{ color: isActive ? "rgba(255,255,255,0.7)" : "var(--text-muted)" }}
                >
                  {agent.desc}
                </div>
              </div>
              {isActive && (
                <div
                  className="agent-tab-badge"
                  style={{
                    background: "rgba(255,255,255,0.25)",
                    color: "white",
                  }}
                >
                  ●
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* 移动端下拉 */}
      <div className="sm:hidden">
        <select
          className="w-full rounded-xl border px-4 py-2.5 text-sm font-semibold outline-none appearance-none cursor-pointer"
          style={{
            background: "var(--card)",
            color: "var(--foreground)",
            borderColor: "var(--border)",
          }}
          value={currentAgent}
          onChange={(e) => onSelectAgent(e.target.value as AgentType)}
        >
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.icon} {agent.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}