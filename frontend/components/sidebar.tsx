"use client"

import {useEffect, useMemo, useRef, useState} from "react"
import { usePathname, useRouter } from "next/navigation"
import type { ChatHistoryItem } from "@/app/page"
import type { UserInfo } from "@/lib/api-client"
import type { AgentDef } from "./agent-section"
import LoginModal, { LoginModalRef } from "@/components/login-modal"
import {isGuestUser} from "@/lib/auth";

type HistoryDeleteDialogState =
  | {
      mode: "single"
      sessionIds: string[]
      title: string
    }
  | {
      mode: "bulk"
      sessionIds: string[]
      title: string
      count: number
    }
  | null

type HistoryMenuState = {
  item: ChatHistoryItem
  top: number
  left: number
} | null

interface SidebarProps {
  open: boolean
  onClose: () => void
  onNewChat: () => void
  chatHistory: ChatHistoryItem[]
  agentNames: Record<string, string>
  onSelectHistory: (item: any) => void
  onDeleteHistory: (sessionId: string) => void | Promise<void>
  onBulkDeleteHistory?: (sessionIds: string[]) => void | Promise<void>
  onRenameHistory?: (sessionId: string, newTitle: string) => void | Promise<void>
  onOpenSettings: () => void
  activeConversationId: number | null
  user: UserInfo | null
  onLogout: () => void
  /** 智能体列表 */
  agentDefs?: AgentDef[]
  currentAgentId?: string
  onSelectAgent?: (agentId: string) => void
  /** 是否折叠 */
  collapsed?: boolean
  /** 切换折叠状态 */
  onToggleCollapse?: () => void
  searchQuery?: string
  /** 历史会话是否还有下一页 */
  hasMoreHistory?: boolean
  loadingMoreHistory?: boolean
  onLoadMoreHistory?: () => void | Promise<void>
}

export function Sidebar({
  open,
  onClose,
  onNewChat,
  chatHistory,
  agentNames,
  onSelectHistory,
  onDeleteHistory,
  onBulkDeleteHistory,
  onRenameHistory,
  onOpenSettings,
  activeConversationId,
  user,
  onLogout,
  agentDefs = [],
  currentAgentId = "",
  onSelectAgent,
  collapsed = false,
  onToggleCollapse,
  searchQuery = "",
  hasMoreHistory = false,
  loadingMoreHistory = false,
  onLoadMoreHistory,
}: SidebarProps) {
  const displayName = user?.display_name || user?.username || "用户"
  const userInitial = displayName.charAt(0).toUpperCase()
  const [agentsExpanded, setAgentsExpanded] = useState(true)
  const [hoveredHistoryId, setHoveredHistoryId] = useState<number | null>(null)
  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null)
  const [historyMenu, setHistoryMenu] = useState<HistoryMenuState>(null)
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set())
  const [deleteDialog, setDeleteDialog] = useState<HistoryDeleteDialogState>(null)
  const [deletingHistory, setDeletingHistory] = useState(false)
  
  // 重命名状态（用 sessionId 对齐 /h5/chat/messages/rename）
  const [editingHistoryId, setEditingHistoryId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [renamingHistory, setRenamingHistory] = useState(false)

  const normalizedSearch = searchQuery.trim().toLowerCase()
  const filteredChatHistory = useMemo(() => {
    if (!normalizedSearch) return chatHistory
    return chatHistory.filter((item) => {
      const agentName = agentNames[item.agent] || ""
      return [item.query, item.preview, agentName, item.sessionId].some((value) =>
        value.toLowerCase().includes(normalizedSearch),
      )
    })
  }, [agentNames, chatHistory, normalizedSearch])

  const loginModalRef = useRef<LoginModalRef>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!historyMenu) return
    const closeMenu = () => setHistoryMenu(null)
    window.addEventListener("scroll", closeMenu, true)
    window.addEventListener("resize", closeMenu)
    return () => {
      window.removeEventListener("scroll", closeMenu, true)
      window.removeEventListener("resize", closeMenu)
    }
  }, [historyMenu])

  const openHistoryMenu = (e: React.MouseEvent<HTMLButtonElement>, item: ChatHistoryItem) => {
    e.stopPropagation()
    if (historyMenu?.item.id === item.id) {
      setHistoryMenu(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const menuWidth = 132
    setHistoryMenu({
      item,
      top: rect.bottom + 6,
      left: Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8)),
    })
  }

  const handleLogout = () => {
    onLogout()
    onClose()
  }

  const handleRenameSubmit = async (sessionId: string) => {
    if (!editTitle.trim() || !onRenameHistory || renamingHistory) {
      setEditingHistoryId(null)
      return
    }
    setRenamingHistory(true)
    try {
      await onRenameHistory(sessionId, editTitle.trim())
    } finally {
      setRenamingHistory(false)
      setEditingHistoryId(null)
    }
  }

  const onSelectAgentHandle = (agent: any) => {
      console.log("🚀 ~ onSelectAgentHandle ~ agent: ", agent);
    if (agent.visible === '1' && isGuestUser()) {
      loginModalRef.current?.open()
      return
    }
    onSelectAgent(agent.id)
  }

  const handleConfirmDelete = async () => {
    if (!deleteDialog || deletingHistory) return

    setDeletingHistory(true)
    try {
      if (deleteDialog.mode === "bulk" && onBulkDeleteHistory) {
        await onBulkDeleteHistory(deleteDialog.sessionIds)
      } else {
        for (const sid of deleteDialog.sessionIds) {
          await onDeleteHistory(sid)
        }
      }
      setDeleteDialog(null)
      if (deleteDialog.mode === "bulk") {
        setSelectedHistoryIds(new Set())
        setBulkMode(false)
      }
    } finally {
      setDeletingHistory(false)
    }
  }
  return (
    <>
      <aside
        className={`sidebar ${open ? "open" : ""} ${collapsed ? "collapsed" : ""}`}
        style={{
          background: "var(--sidebar)",
          borderColor: "var(--sidebar-border)",
        }}
      >
        {/* 顶部 */}
        <LoginModal ref={loginModalRef} />
        <div className="sidebar-header" style={{ padding: "12px 12px" }}>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2" style={{ opacity: collapsed ? 0 : 1, transition: "opacity 0.2s ease", overflow: "hidden" }}>
              <div
                className="flex h-[28px] w-[28px] items-center justify-center rounded-lg text-[14px] font-bold flex-shrink-0"
                style={{
                  background: "var(--gradient-accent)",
                  color: "white",
                }}
              >
                深
              </div>
              <div className="sidebar-text-brand whitespace-nowrap" style={{ color: "var(--sidebar-foreground, var(--foreground))" }}>
                深海智航
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={onToggleCollapse}
                className="expand-btn hidden h-[36px] w-[36px] items-center justify-center rounded-xl transition-all hover:bg-gray-100 dark:hover:bg-white/10 flex-shrink-0 lg:flex"
                style={{ color: "var(--text-muted)" }}
                aria-label={collapsed ? "展开侧边栏" : "折叠侧边栏"}
                title={collapsed ? "展开侧边栏" : "折叠侧边栏"}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 1024 1024" style={{ transform: collapsed ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.3s ease" }}>
                  <path d="M725.333333 132.266667A166.4 166.4 0 0 1 891.733333 298.666667v426.666666c0 91.904-74.496 166.4-166.4 166.4H298.666667A166.442667 166.442667 0 0 1 132.266667 725.333333V298.666667A166.4 166.4 0 0 1 298.666667 132.266667h426.666666z m-281.6 682.666666H725.333333a89.6 89.6 0 0 0 89.6-89.6V298.666667A89.6 89.6 0 0 0 725.333333 209.066667h-281.6v605.866666zM298.666667 209.066667A89.6 89.6 0 0 0 209.066667 298.666667v426.666666c0 49.493333 40.106667 89.6 89.6 89.6h68.266666V209.066667H298.666667z" fill="currentColor"></path>
                </svg>
              </button>
              <button
                onClick={onClose}
                className="flex h-[36px] w-[36px] items-center justify-center rounded-xl transition-all hover:bg-gray-100 dark:hover:bg-white/10 lg:hidden flex-shrink-0"
                style={{ color: "var(--text-muted)" }}
                aria-label="关闭菜单"
                title="关闭菜单"
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* 新对话按钮 */}
            <div className="sidebar-section" style={{ padding: "0 12px 12px" }}>
              <button
                onClick={onNewChat}
                className="sidebar-new-chat w-full"
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="flex-shrink-0">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span className="sidebar-text-new-chat">新建会话</span>
              </button>
            </div>

            {/* 工具集 导航入口 */}
            <div className="sidebar-section" style={{ padding: "0 12px 4px" }}>
              <button
                onClick={() => router.push("/tools")}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all cursor-pointer ${
                  pathname?.startsWith("/tools")
                    ? "bg-[var(--sidebar-accent)]"
                    : "bg-transparent hover:bg-[var(--hover)]"
                }`}
                style={{
                  color: pathname?.startsWith("/tools")
                    ? "var(--accent)"
                    : "var(--text-muted)",
                }}
                aria-label="工具集"
                title="工具集"
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="flex-shrink-0">
                  <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.1-2.1 2.5-2.5z" />
                </svg>
                <span className="sidebar-text-new-chat">工具集</span>
              </button>
            </div>

            {/* 分割线 */}
            {/* <div
              className="sidebar-divider mx-4"
              style={{ background: "var(--border)", height: "1px" }}
            /> */}

            {/* 智能体（可折叠）— 暂时隐藏，改由欢迎页胶囊标签选择 */}
            {false && agentDefs.length > 0 && onSelectAgent && (
              <div className="sidebar-section" style={{ padding: "16px 12px" }}>
              {/* 分类标题 - 点击收缩/展开 */}
              <button
                onClick={() => setAgentsExpanded(!agentsExpanded)}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all cursor-pointer"
                style={{ color: "var(--text-muted)" }}
              >
                <svg
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  style={{
                    transform: agentsExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                    flexShrink: 0,
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                <span className="sidebar-text-section" style={{ color: "var(--text-muted)" }}>智能助手</span>
              </button>

              {/* 智能体列表 */}
              {agentsExpanded && (
                <div className="mt-2 space-y-1.5">
                  {agentDefs.map((agent) => {
                    const isActive = currentAgentId === agent.id
                    const hovered = hoveredAgentId === agent.id
                    const activeStyle = {
                      background: "var(--card)",
                      color: "var(--foreground)",
                      border: "1px solid var(--border)",
                      borderRadius: "12px",
                      padding: "10px 12px",
                      outline: "none",
                      boxShadow: "var(--shadow-sm)",
                    } as React.CSSProperties
                    const hoverStyle = {
                      background: "var(--hover)",
                      color: "var(--foreground)",
                      border: "1px solid transparent",
                      borderRadius: "12px",
                      padding: "10px 12px",
                      outline: "none",
                    } as React.CSSProperties
                    const baseStyle = {
                      background: "transparent",
                      color: "var(--foreground)",
                      border: "1px solid transparent",
                      borderRadius: "12px",
                      padding: "10px 12px",
                      outline: "none",
                    } as React.CSSProperties
                    return (
                      <button
                        key={agent.id}
                        onClick={() => onSelectAgentHandle(agent)}
                        onMouseEnter={() => setHoveredAgentId(agent.id)}
                        onMouseLeave={() => setHoveredAgentId(null)}
                        className="flex items-center gap-3 w-full text-left transition-colors cursor-pointer group"
                        style={isActive ? activeStyle : hovered ? hoverStyle : baseStyle}
                      >
                        <span
                          className="flex-shrink-0 rounded-full"
                          style={{
                            width: 10,
                            height: 10,
                            background: isActive ? "var(--accent)" : "var(--text-muted)",
                            opacity: isActive ? 1 : hovered ? 1 : 0.35,
                            transition: "background .15s ease, opacity .15s ease",
                          }}
                          aria-hidden="true"
                        />
                        <span className="sidebar-text-item-lg flex-1 text-left truncate">{agent.label}</span>
                      </button>
                    )
                  })}
                </div>
              )}
              </div>
            )}

            {/* 分割线 — 随智能助手一并隐藏 */}
            {false && agentDefs.length > 0 && onSelectAgent && (
              <div
                className="sidebar-divider mx-4"
                style={{ background: "var(--border)", height: "1px" }}
              />
            )}

            {/* 聊天历史 */}
            <div className="sidebar-section flex-1 flex flex-col" style={{ padding: "16px 12px", minHeight: "0" }}>
            <div className="flex items-center justify-between px-3 py-2 mb-1">
              <div className="flex items-center gap-2.5" style={{ color: "var(--text-muted)" }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="sidebar-text-section-sm" style={{ color: "var(--text-muted)" }}>历史会话</span>
              </div>
              {chatHistory.length > 0 && !bulkMode && (
                <button
                  onClick={() => setBulkMode(true)}
                  className="sidebar-text-meta transition-colors hover:text-[var(--foreground)] cursor-pointer"
                  style={{ color: "var(--text-muted)" }}
                >
                  管理
                </button>
              )}
            </div>

            {normalizedSearch && (
              <div className="px-3 pb-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                {filteredChatHistory.length > 0
                  ? `匹配到 ${filteredChatHistory.length} 条会话`
                  : `没有找到与“${searchQuery.trim()}”相关的会话`}
              </div>
            )}

            {chatHistory.length === 0 ? (
              <div
                className="py-10 text-center rounded-2xl border-2 border-dashed"
                style={{ color: "var(--text-muted)", borderColor: "var(--border)" }}
              >
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: "var(--secondary)", color: "var(--text-muted)" }}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div className="text-[13px] font-medium">暂无对话记录</div>
                <div className="text-[12px] mt-1 opacity-70">点击「新建会话」开始</div>
              </div>
            ) : filteredChatHistory.length === 0 ? (
              <div
                className="py-10 text-center rounded-2xl border"
                style={{ color: "var(--text-muted)", borderColor: "var(--border)", background: "var(--card)" }}
              >
                <div className="text-[13px] font-medium">没有匹配结果</div>
                <div className="mt-1 text-[12px] opacity-70">试试搜索会话标题或所属助手</div>
              </div>
            ) : (
              <div className="sidebar-history-list space-y-1 overflow-y-auto flex-1 pr-1">
                {filteredChatHistory.map((item) => {
                  const hovered = hoveredHistoryId === item.id
                  const activeStyle = {
                    background: "var(--card)",
                    color: "var(--foreground)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "8px 10px",
                    outline: "none",
                    boxShadow: "var(--shadow-sm)",
                  } as React.CSSProperties
                  const hoverStyle = {
                    background: "var(--hover)",
                    color: "var(--foreground)",
                    border: "1px solid transparent",
                    borderRadius: "8px",
                    padding: "8px 10px",
                    outline: "none",
                  } as React.CSSProperties
                  const baseStyle = {
                    background: "transparent",
                    color: "var(--foreground)",
                    border: "1px solid transparent",
                    borderRadius: "8px",
                    padding: "8px 10px",
                    outline: "none",
                  } as React.CSSProperties
                  return (
                    <div
                      key={item.id}
                      data-session-id={item.sessionId}
                      onClick={() => {
                        if (bulkMode) {
                          const next = new Set(selectedHistoryIds)
                          if (next.has(item.sessionId)) next.delete(item.sessionId)
                          else next.add(item.sessionId)
                          setSelectedHistoryIds(next)
                        } else {
                          onSelectHistory(item)
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          if (bulkMode) {
                            const next = new Set(selectedHistoryIds)
                            if (next.has(item.sessionId)) next.delete(item.sessionId)
                            else next.add(item.sessionId)
                            setSelectedHistoryIds(next)
                          } else {
                            onSelectHistory(item)
                          }
                        }
                      }}
                      onMouseEnter={() => setHoveredHistoryId(item.id)}
                      onMouseLeave={() => setHoveredHistoryId(null)}
                      className={`sidebar-history-item ${item.active ? "active" : ""} w-full text-left group`}
                      title={item.title}
                      role="button"
                      tabIndex={0}
                      style={item.active ? activeStyle : hovered ? hoverStyle : baseStyle}
                    >
                      <div className="flex items-center gap-1.5">
                        {bulkMode && (
                          <input
                            type="checkbox"
                            checked={selectedHistoryIds.has(item.sessionId)}
                            onChange={(e) => {
                              const next = new Set(selectedHistoryIds)
                              if (e.target.checked) next.add(item.sessionId)
                              else next.delete(item.sessionId)
                              setSelectedHistoryIds(next)
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                        <span
                          className="flex-shrink-0 rounded-full"
                          style={{
                            width: 10,
                            height: 10,
                            background: item.active
                              ? "var(--accent)"
                              : hovered
                              ? "var(--text-muted)"
                              : "var(--text-muted)",
                            opacity: item.active ? 1 : hovered ? 1 : 0.35,
                            transition: "background .15s ease, opacity .15s ease",
                          }}
                          aria-hidden="true"
                        />
                        {editingHistoryId === item.sessionId ? (
                          <input
                            type="text"
                            value={editTitle}
                            disabled={renamingHistory}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onBlur={() => handleRenameSubmit(item.sessionId)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault()
                                void handleRenameSubmit(item.sessionId)
                              } else if (e.key === "Escape") {
                                setEditingHistoryId(null)
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                            className="flex-1 text-[12px] font-medium bg-transparent border-b border-[var(--accent)] outline-none"
                            style={{ color: "var(--foreground)" }}
                          />
                        ) : (
                          <span className="sidebar-text-item truncate flex-1" title={item.title}>{item.title}</span>
                        )}
                        <div className="relative ml-1 flex-shrink-0">
                          {!bulkMode && (
                            <button
                              type="button"
                              onClick={(e) => openHistoryMenu(e, item)}
                              className="transition-all cursor-pointer rounded-md flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10"
                              style={{
                                width: "24px",
                                height: "24px",
                                color: "var(--text-muted)",
                                opacity: hovered || item.active || historyMenu?.item.id === item.id ? 0.9 : 0,
                                pointerEvents: hovered || item.active || historyMenu?.item.id === item.id ? "auto" : "none",
                              }}
                              title="更多"
                              aria-label="更多"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {hasMoreHistory && onLoadMoreHistory && (
                  <button
                    type="button"
                    className="sidebar-load-more w-full mt-2 py-2.5 rounded-lg text-[12px] transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                    style={{
                      color: "var(--text-muted)",
                      background: "transparent",
                      border: "1px dashed var(--border)",
                    }}
                    disabled={loadingMoreHistory}
                    onClick={(e) => {
                      e.stopPropagation()
                      onLoadMoreHistory()
                    }}
                  >
                    {loadingMoreHistory ? "加载中..." : "加载更多"}
                  </button>
                )}
              </div>
            )}
            {bulkMode && (
              <div
                className="flex items-center gap-3 px-3 py-2 mt-2 rounded-md"
                style={{ background: "var(--primary)", border: "1px solid var(--border)" }}
              >
                <label className="flex items-center gap-2 text-[12px]" style={{ color: "var(--text-secondary)" }}>
                  <input
                    type="checkbox"
                    checked={selectedHistoryIds.size === filteredChatHistory.length && filteredChatHistory.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedHistoryIds(new Set(filteredChatHistory.map((c) => c.sessionId)))
                      } else {
                        setSelectedHistoryIds(new Set())
                      }
                    }}
                  />
                  全选
                </label>
                <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                  已选 {selectedHistoryIds.size} 项
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    className="px-3 py-1.5 rounded-md text-[12px]"
                    style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                    onClick={() => {
                      setBulkMode(false)
                      setSelectedHistoryIds(new Set())
                    }}
                  >
                    取消
                  </button>
                  <button
                    className="px-3 py-1.5 rounded-md text-[12px] disabled:opacity-50"
                    style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
                    disabled={selectedHistoryIds.size === 0}
                    onClick={() => {
                      const sessionIds = [...new Set(Array.from(selectedHistoryIds).filter(Boolean))]
                      if (sessionIds.length === 0) return
                      setDeleteDialog({
                        mode: "bulk",
                        sessionIds,
                        count: sessionIds.length,
                        title: sessionIds.length === 1
                          ? (chatHistory.find((item) => item.sessionId === sessionIds[0])?.title || "该会话")
                          : "这些会话",
                      })
                    }}
                  >
                    删除
                  </button>
                </div>
              </div>
            )}
            </div>

            {/* 底部信息 */}
            <div className="sidebar-section" style={{ padding: "12px 12px 16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-3 px-3 py-3 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div
                className="flex h-[40px] w-[40px] items-center justify-center rounded-xl flex-shrink-0 text-sm font-bold text-white"
                style={{
                  background: "var(--gradient-accent)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                }}
              >
                {userInitial}
              </div>
              <div
                className="min-w-0 flex-1 cursor-pointer"
                onClick={() => loginModalRef.current?.open()}
              >
                <div className="text-[13px] font-semibold truncate" style={{ color: "var(--foreground)" }} >
                  {displayName}
                </div>
                <div className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                  {isGuestUser() ? "点击登录" : user?.roles?.includes("admin") ? "管理员" : "普通用户"}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* <button
                  onClick={onOpenSettings}
                  className="flex h-[36px] w-[36px] items-center justify-center rounded-xl transition-all flex-shrink-0 cursor-pointer"
                  style={{ color: "var(--text-muted)" }}
                  aria-label="设置"
                  title="设置"
                >
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </button> */}
                {
                  isGuestUser() &&
                    <button
                        onClick={() => loginModalRef.current?.open()}
                        className="flex h-[36px] w-[36px] items-center justify-center rounded-xl transition-all flex-shrink-0 cursor-pointer"
                        style={{ color: "var(--text-muted)" }}
                        aria-label="登录"
                        title="登录"
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                        <polyline points="10 17 15 12 10 7" />
                        <line x1="15" y1="12" x2="3" y2="12" />
                      </svg>
                    </button>
                }
                {
                  !isGuestUser() &&
                    <button
                        onClick={handleLogout}
                        className="flex h-[36px] w-[36px] items-center justify-center rounded-xl transition-all flex-shrink-0 cursor-pointer"
                        style={{ color: "var(--text-muted)" }}
                        aria-label="登出"
                        title="登出"
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                    </button>
                }
              </div>
            </div>
            </div>
      </aside>

      {historyMenu && (
        <>
          <div className="fixed inset-0 z-[1000]" onClick={() => setHistoryMenu(null)} />
          <div
            className="sidebar-history-dropdown"
            style={{
              position: "fixed",
              top: historyMenu.top,
              left: historyMenu.left,
              zIndex: 1001,
            }}
          >
            <button
              type="button"
              className="sidebar-history-dropdown-item"
              onClick={(e) => {
                e.stopPropagation()
                setHistoryMenu(null)
                setEditingHistoryId(historyMenu.item.sessionId)
                setEditTitle(historyMenu.item.title || "")
              }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              <span>重命名</span>
            </button>
            <button
              type="button"
              className="sidebar-history-dropdown-item sidebar-history-dropdown-item--danger"
              onClick={(e) => {
                e.stopPropagation()
                setHistoryMenu(null)
                setDeleteDialog({
                  mode: "single",
                  sessionIds: [historyMenu.item.sessionId],
                  title: historyMenu.item.title,
                })
              }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              <span>删除</span>
            </button>
          </div>
        </>
      )}

      {deleteDialog && (
        <>
          <div
            className="confirm-dialog-overlay"
            onClick={() => {
              if (!deletingHistory) {
                setDeleteDialog(null)
              }
            }}
          />
          <div className="confirm-dialog-panel">
            <h4 className="confirm-dialog-title">
              {deleteDialog.mode === "bulk" ? "删除历史会话" : "删除会话"}
            </h4>
            <p className="confirm-dialog-message">
              {deleteDialog.mode === "bulk"
                ? `确定要删除已选中的 ${deleteDialog.count} 条历史会话吗？删除后将无法恢复。`
                : `确定要删除「${deleteDialog.title}」吗？删除后将无法恢复。`}
            </p>
            <div className="confirm-dialog-actions">
              <button
                type="button"
                onClick={() => setDeleteDialog(null)}
                disabled={deletingHistory}
                className="confirm-dialog-cancel"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deletingHistory}
                className="confirm-dialog-danger"
              >
                {deletingHistory ? "删除中..." : "确认删除"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
