"use client"

import type { ChatHistoryItem } from "@/app/page"
import type { UserInfo } from "@/lib/api-client"

interface SidebarProps {
  open: boolean
  onClose: () => void
  onNewChat: () => void
  chatHistory: ChatHistoryItem[]
  agentNames: Record<string, string>
  onSelectHistory: (id: number) => void
  onDeleteHistory: (id: number) => void
  onOpenSettings: () => void
  activeConversationId: number | null
  user: UserInfo | null
  onLogout: () => void
}

export function Sidebar({
  open,
  onClose,
  onNewChat,
  chatHistory,
  agentNames,
  onSelectHistory,
  onDeleteHistory,
  onOpenSettings,
  activeConversationId,
  user,
  onLogout,
}: SidebarProps) {
  const displayName = user?.display_name || user?.username || "用户"
  const userInitial = displayName.charAt(0).toUpperCase()
  const userRole = user?.roles?.[0] || "用户"

  const handleLogout = () => {
    onLogout()
    onClose()
  }
  return (
    <aside
      className={`sidebar ${open ? "open" : ""}`}
      style={{
        background: "var(--sidebar)",
        borderColor: "var(--sidebar-border)",
      }}
    >
      {/* 顶部 */}
      <div className="sidebar-header">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-[36px] w-[36px] items-center justify-center rounded-[10px] text-lg"
            style={{
              background: "var(--gradient-accent)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            🌊
          </div>
          <div>
            <div className="text-[15px] font-bold leading-tight" style={{ color: "var(--foreground)" }}>
              深海智航
            </div>
            <div className="text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>
              Co-Work AI Platform
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex h-[32px] w-[32px] items-center justify-center rounded-lg transition-all hover:bg-white/10 lg:hidden"
          style={{ color: "var(--text-secondary)" }}
          aria-label="关闭菜单"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* 新对话按钮 */}
      <div className="sidebar-section">
        <button
          onClick={onNewChat}
          className="sidebar-new-chat"
          style={{
            background: "var(--gradient-2)",
            color: "white",
            boxShadow: "0 2px 12px rgba(249, 115, 22, 0.3)",
          }}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>新对话</span>
        </button>
      </div>

      {/* 分割线 */}
      <div
        className="sidebar-divider"
        style={{ background: "var(--border)" }}
      />

      {/* 聊天历史 */}
      <div className="sidebar-section">
        <div className="sidebar-label" style={{ color: "var(--text-muted)" }}>
          最近对话
        </div>

        {chatHistory.length === 0 ? (
          <div
            className="py-8 text-center text-[12px]"
            style={{ color: "var(--text-muted)" }}
          >
            暂无对话记录
            <br />
            点击「新对话」开始
          </div>
        ) : (
          <div className="sidebar-history-list">
            {chatHistory.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onSelectHistory(item.id)
                }}
                className={`sidebar-history-item ${item.active ? "active" : ""}`}
                style={
                  item.active
                    ? {
                        background: "var(--accent)",
                        color: "var(--accent-foreground)",
                      }
                    : {
                        background: "transparent",
                        color: "var(--foreground)",
                      }
                }
              >
                <div className="sidebar-history-top">
                  <span className="sidebar-history-title">{item.title}</span>
                  <span
                    className="sidebar-history-time"
                    style={{ color: item.active ? "var(--accent-foreground)" : "var(--text-muted)" }}
                  >
                    {item.time}
                  </span>
                </div>
                <div className="sidebar-history-meta">
                  <span
                    className="sidebar-history-agent-tag"
                    style={
                      item.active
                        ? { background: "rgba(255,255,255,0.2)", color: "var(--accent-foreground)" }
                        : {
                            background: "var(--secondary)",
                            color: "var(--text-muted)",
                          }
                    }
                  >
                    {agentNames[item.agent]}
                  </span>
                  <span
                    className="sidebar-history-preview"
                    style={{ color: item.active ? "rgba(255,255,255,0.7)" : "var(--text-muted)" }}
                  >
                    {item.preview}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 底部信息 */}
      <div className="sidebar-section" style={{ marginTop: "auto" }}>
        <div
          className="sidebar-divider"
          style={{ background: "var(--border)", marginBottom: 12 }}
        />
        <div className="sidebar-footer">
          <div
            className="flex items-center gap-2 px-1 py-1.5 rounded-lg text-[11px] transition-all hover:bg-white/5 cursor-pointer"
            style={{ color: "var(--text-muted)" }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            帮助与文档
          </div>
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-2 px-1 py-1.5 rounded-lg text-[11px] transition-all hover:bg-white/5 cursor-pointer w-full text-left"
            style={{ color: "var(--text-muted)" }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            API 设置
          </button>
        </div>
        <div
          className="mt-3 flex items-center gap-2.5 px-2 py-2 rounded-xl"
          style={{ background: "var(--secondary)" }}
        >
          <div
            className="flex h-[36px] w-[36px] items-center justify-center rounded-full flex-shrink-0 text-sm font-bold text-white"
            style={{
              background: "var(--gradient-4)",
            }}
          >
            {userInitial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold truncate" style={{ color: "var(--foreground)" }}>
              {displayName}
            </div>
            <div className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
              {userRole}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex h-[28px] w-[28px] items-center justify-center rounded-lg transition-all hover:bg-white/10 flex-shrink-0 cursor-pointer"
            style={{ color: "var(--text-muted)" }}
            aria-label="登出"
            title="登出"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )
}