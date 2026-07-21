"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { LayoutGrid, type LucideIcon } from "lucide-react"
import { tools, OVERVIEW_ID } from "./tools/registry"
import Overview from "./tools/overview"

function ToolNavItem({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string
  icon: LucideIcon
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition-all"
      style={
        active
          ? {
              background: "var(--card)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-sm)",
            }
          : { background: "transparent", color: "var(--sidebar-foreground, var(--foreground))", border: "1px solid transparent" }
      }
    >
      <Icon size={18} className="flex-shrink-0" style={{ color: active ? "var(--accent)" : "var(--text-muted)" }} />
      <span className="truncate">{label}</span>
    </button>
  )
}

export default function ToolsPage() {
  const router = useRouter()
  const [active, setActive] = useState<string>(OVERVIEW_ID)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleBack = useCallback(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("app-route-transition-start"))
      setTimeout(() => router.push("/"), 120)
    } else {
      router.push("/")
    }
  }, [router])

  const activeTool = tools.find((t) => t.id === active)

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)", display: "flex", flexDirection: "column" }}>
      {/* 顶部栏 */}
      <div className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: "1px solid var(--border)", background: "var(--primary)" }}>
        <button
          onClick={handleBack}
          className="flex h-9 w-9 items-center justify-center rounded-xl transition-all hover:bg-white/10"
          style={{ color: "var(--text-secondary)" }}
          aria-label="返回对话"
          title="返回对话"
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div>
          <h1 className="text-[16px] font-bold" style={{ color: "var(--foreground)" }}>
            工具集
          </h1>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            实用小工具集合 · 纯前端
          </p>
        </div>
      </div>

      {/* 主体：左侧工具列表 + 右侧内容 */}
      <div className="flex flex-1" style={{ minHeight: 0 }}>
        <aside
          className="flex-shrink-0"
          style={{ width: 224, borderRight: "1px solid var(--border)", background: "var(--sidebar)", padding: "12px 8px", overflowY: "auto" }}
        >
          <ToolNavItem label="概览" icon={LayoutGrid} active={active === OVERVIEW_ID} onClick={() => setActive(OVERVIEW_ID)} />
          <div style={{ height: 1, background: "var(--border)", margin: "10px 8px" }} />
          {tools.map((t) => (
            <ToolNavItem
              key={t.id}
              label={t.label}
              icon={t.icon}
              active={active === t.id}
              onClick={() => setActive(t.id)}
            />
          ))}
        </aside>

        <main style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          {!mounted ? null : active === OVERVIEW_ID ? (
            <Overview onSelect={(id) => setActive(id)} />
          ) : activeTool ? (
            <activeTool.component />
          ) : null}
        </main>
      </div>
    </div>
  )
}
