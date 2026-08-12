"use client"

export interface AgentDef {
  id: string
  label: string
  icon: string
  desc: string
  gradient: string
  sortOrder: number
  isActive: boolean
}

interface AgentSectionProps {
  agentDefs: AgentDef[]
  currentAgentId: string
  onSelectAgent: (agentId: string) => void
  /** tabs：顶部标签；cards：欢迎页卡片列表 */
  variant?: "tabs" | "cards"
}

export function AgentSection({
  agentDefs,
  currentAgentId,
  onSelectAgent,
  variant = "tabs",
}: AgentSectionProps) {
  if (variant === "cards") {
    if (agentDefs.length === 0) {
      return (
        <div className="welcome-agent-section">
          <div className="welcome-agent-empty">暂无应用，请在智能中台添加</div>
        </div>
      )
    }

    return (
      <div className="welcome-agent-section">
        <div className="welcome-agent-grid">
          {agentDefs.map((agent) => {
            const isActive = currentAgentId === agent.id
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => onSelectAgent(agent.id)}
                className={`welcome-agent-card${isActive ? " active" : ""}`}
                aria-pressed={isActive}
                title={agent.desc || agent.label}
              >
                <span className="welcome-agent-card-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15z" />
                    <path d="M8 7h8" />
                    <path d="M8 11h6" />
                  </svg>
                </span>
                <span className="welcome-agent-card-label">{agent.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // if (agentDefs.length === 0) {
  //   return (
  //     <div
  //       className="flex-shrink-0 border-b px-5 py-4 text-center text-sm"
  //       style={{
  //         background: "var(--primary)",
  //         borderColor: "var(--border)",
  //         color: "var(--text-muted)",
  //       }}
  //     >
  //       暂无应用，请在设置中添加
  //     </div>
  //   )
  // }

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
        {agentDefs.map((agent) => {
          const isActive = currentAgentId === agent.id
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
          value={currentAgentId}
          onChange={(e) => onSelectAgent(e.target.value)}
        >
          {agentDefs.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.icon} {agent.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
