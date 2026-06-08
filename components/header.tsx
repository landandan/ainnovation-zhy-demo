"use client"

import { useState, useRef, useEffect } from "react"
import { THEMES, type ThemeId } from "@/app/page"

interface HeaderProps {
  onMenuToggle: () => void
  currentTheme: ThemeId
  onThemeChange: (theme: ThemeId) => void
}

export function Header({ onMenuToggle, currentTheme, onThemeChange }: HeaderProps) {
  const [themeMenuOpen, setThemeMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // 点击外部关闭菜单
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setThemeMenuOpen(false)
      }
    }
    if (themeMenuOpen) {
      document.addEventListener("mousedown", handleClick)
      return () => document.removeEventListener("mousedown", handleClick)
    }
  }, [themeMenuOpen])

  // 聚焦搜索框
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [searchOpen])

  const currentThemeData = THEMES.find((t) => t.id === currentTheme)
  const darkThemes = THEMES.filter((t) => t.dark)
  const lightThemes = THEMES.filter((t) => !t.dark)

  return (
    <header
      className="header flex items-center gap-3 px-5 py-3 flex-shrink-0 border-b"
      style={{
        background: "var(--primary)",
        borderColor: "var(--border)",
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

      {/* Logo */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <div
          className="flex h-[36px] w-[36px] items-center justify-center rounded-[10px] text-lg"
          style={{
            background: "var(--gradient-accent)",
            boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
          }}
        >
          🌊
        </div>
        <div className="hidden sm:block">
          <div className="text-[15px] font-bold leading-tight" style={{ color: "var(--foreground)" }}>
            深海智航
          </div>
          <div className="text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>
            CNOOC AI Platform
          </div>
        </div>
      </div>

      {/* 中间占位 */}
      <div className="flex-1" />

      {/* 搜索按钮 */}
      <div className={`flex items-center gap-2 transition-all duration-300 ${searchOpen ? "w-[240px]" : "w-auto"}`}>
        <button
          onClick={() => setSearchOpen(!searchOpen)}
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
          <input
            ref={searchInputRef}
            type="text"
            placeholder="搜索对话..."
            className="h-[38px] flex-1 min-w-0 rounded-xl border-none px-3 text-sm outline-none transition-all"
            style={{
              background: "var(--secondary)",
              color: "var(--foreground)",
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSearchOpen(false)
            }}
          />
        )}
      </div>

      {/* 主题切换按钮 */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setThemeMenuOpen(!themeMenuOpen)}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-xl transition-all hover:bg-white/10"
          style={{ color: "var(--text-secondary)" }}
          aria-label="切换主题"
          title={`当前：${currentThemeData?.label ?? currentTheme}`}
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
          <span
            className="absolute -top-0.5 -right-0.5 flex h-[7px] w-[7px] rounded-full ring-2 ring-[var(--primary)]"
            style={{ background: currentThemeData?.dark ? "#1a1a2e" : "#f8f9fa" }}
          />
        </button>

        {/* 主题下拉菜单 */}
        {themeMenuOpen && (
          <div
            className="theme-menu"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div className="theme-category-label" style={{ color: "var(--text-muted)" }}>
              🌙 暗色主题
            </div>
            <div className="theme-grid">
              {darkThemes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    onThemeChange(t.id)
                    setThemeMenuOpen(false)
                  }}
                  className={`theme-chip ${t.id === currentTheme ? "active" : ""}`}
                  style={
                    t.id === currentTheme
                      ? {
                          background: "var(--accent)",
                          color: "var(--accent-foreground)",
                        }
                      : {
                          background: "var(--secondary)",
                          color: "var(--text-secondary)",
                        }
                  }
                >
                  {t.label}
                  {t.id === currentTheme && <span className="theme-chip-check">✓</span>}
                </button>
              ))}
            </div>

            <div className="theme-category-label" style={{ color: "var(--text-muted)" }}>
              ☀️ 浅色主题
            </div>
            <div className="theme-grid">
              {lightThemes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    onThemeChange(t.id)
                    setThemeMenuOpen(false)
                  }}
                  className={`theme-chip ${t.id === currentTheme ? "active" : ""}`}
                  style={
                    t.id === currentTheme
                      ? {
                          background: "var(--accent)",
                          color: "var(--accent-foreground)",
                        }
                      : {
                          background: "var(--secondary)",
                          color: "var(--text-secondary)",
                        }
                  }
                >
                  {t.label}
                  {t.id === currentTheme && <span className="theme-chip-check">✓</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 用户头像 */}
      <div
        className="flex h-[38px] w-[38px] items-center justify-center rounded-full flex-shrink-0 text-sm font-bold text-white"
        style={{
          background: "var(--gradient-4)",
          boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
        }}
      >
        A
      </div>
    </header>
  )
}