"use client"

/**
 * 客户端持久化 —— 仅保留主题
 *
 * ⚠️ 所有 Dify API Key / 配置由后端数据库管理，前端不再存储任何敏感信息。
 * 管理员通过 Settings 页面的 Agent 管理面板调用后端 API 进行 CRUD。
 * 普通用户仅能修改主题和个人设置。
 */

const THEME_KEY = "dify-theme"

/* ───── 主题持久化 ───── */

export function loadTheme(defaultTheme: string): string {
  if (typeof window === "undefined") return defaultTheme
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored) return stored
  } catch {
    // ignore
  }
  return defaultTheme
}

export function saveTheme(theme: string): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // ignore
  }
}