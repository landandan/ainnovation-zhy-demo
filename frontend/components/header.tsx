"use client"

import { useState, useRef, useEffect } from "react"
import { THEMES, type ThemeId } from "@/app/page"

interface HeaderProps {
  onMenuToggle: () => void
  currentTheme: ThemeId
  onThemeChange: (theme: ThemeId) => void
  searchQuery: string
  onSearchChange: (value: string) => void
}

export function Header({ onMenuToggle, currentTheme, onThemeChange, searchQuery, onSearchChange }: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // 聚焦搜索框
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [searchOpen])

  useEffect(() => {
    if (searchQuery && !searchOpen) {
      setSearchOpen(true)
    }
  }, [searchQuery, searchOpen])

  const currentThemeData = THEMES.find((t) => t.id === currentTheme)

  // 直接点击循环切换：默认 → 深海 → 极光 → 默认
  const THEME_CYCLE_ORDER: ThemeId[] = ["", "deep-ocean", "aurora-blue"]
  const handleCycleTheme = () => {
    const currentIndex = THEME_CYCLE_ORDER.indexOf(currentTheme)
    const nextIndex = (currentIndex + 1) % THEME_CYCLE_ORDER.length
    onThemeChange(THEME_CYCLE_ORDER[nextIndex])
  }

  return (
    <header
      className="header flex items-center gap-3 px-5 py-3 flex-shrink-0"
      style={{
        background: "var(--background)",
      }}
    >
      {/* 汉堡菜单按钮 */}
      <button
        onClick={onMenuToggle}
        className="flex h-[38px] w-[38px] items-center justify-center rounded-xl transition-all hover:bg-white/10 lg:hidden"
        style={{ color: "var(--foreground)" }}
        aria-label="打开菜单"
      >
        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* 中间占位 */}
      <div className="flex-1" />

      {/* 搜索按钮 */}
      <div className={`flex items-center gap-2 transition-all duration-300 ${searchOpen ? "w-[240px]" : "w-auto"}`}>
        <button
          onClick={() => {
            if (searchOpen && !searchQuery) {
              setSearchOpen(false)
              return
            }
            setSearchOpen(true)
          }}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-xl transition-all hover:bg-white/10"
          style={{ color: "var(--text-secondary)" }}
          aria-label="搜索"
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
        {searchOpen && (
          <div
            className="flex h-[38px] flex-1 items-center rounded-xl px-2"
            style={{
              background: "var(--secondary)",
              color: "var(--foreground)",
            }}
          >
            <input
              ref={searchInputRef}
              type="text"
              placeholder="搜索历史会话..."
              className="h-full flex-1 min-w-0 border-none bg-transparent px-1 text-sm outline-none transition-all"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  if (searchQuery) {
                    onSearchChange("")
                  } else {
                    setSearchOpen(false)
                  }
                }
              }}
            />
            {searchQuery && (
              <button
                onClick={() => {
                  onSearchChange("")
                  searchInputRef.current?.focus()
                }}
                className="flex h-7 w-7 items-center justify-center rounded-lg transition-all hover:bg-white/10"
                style={{ color: "var(--text-muted)" }}
                aria-label="清空搜索"
                title="清空搜索"
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 主题切换 - 直接点击循环 */}
      <button
        onClick={handleCycleTheme}
        className="flex h-[38px] items-center justify-center rounded-xl px-3 gap-2 transition-all hover:bg-white/10"
        style={{ color: "var(--text-secondary)" }}
        aria-label="切换主题"
        title={`当前：${currentThemeData?.label ?? "Kimi 默认"}（点击切换）`}
      >
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
        <span className="text-[12px] font-medium hidden sm:inline">
          {currentThemeData?.label === "Kimi 默认" ? "默认" : currentThemeData?.label?.replace("蓝", "") ?? "Kimi"}
        </span>
      </button>
    </header>
  )
}
