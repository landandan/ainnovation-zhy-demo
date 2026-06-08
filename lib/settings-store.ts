"use client"

/**
 * 持久化设置 & 对话历史 Store
 * 使用 localStorage 存储
 */

/* ═══════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════ */

/** 单个应用的 API 配置 */
export interface AgentApiConfig {
  apiKey: string
  apiUrl?: string
}

/** 单个应用的定义（用户可增删改） */
export interface AgentDef {
  /** 唯一标识，如 "knowledge" */
  id: string
  /** 显示名称 */
  label: string
  /** 图标 emoji */
  icon: string
  /** 简要描述（副标题） */
  desc: string
  /** CSS 变量引用，如 "var(--gradient-1)" */
  gradient: string
}

/** 全局设置 */
export interface DifySettings {
  apiUrl: string
  useMock: boolean
  /** 所有应用定义（有序列表，用户可增删改） */
  agentDefs: AgentDef[]
  /** 各应用的 API Key 配置，key 为 agent.id */
  agents: Record<string, AgentApiConfig>
}

/* ═══════════════════════════════════════════════════
   默认 4 个内置应用
   ═══════════════════════════════════════════════════ */

export const DEFAULT_AGENT_DEFS: AgentDef[] = [
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

/* ═══════════════════════════════════════════════════
   存储 Key
   ═══════════════════════════════════════════════════ */

const SETTINGS_KEY = "dify-settings"
const CONVERSATIONS_KEY = "dify-conversations"
const ACTIVE_CONVERSATION_KEY = "dify-active-conversation"
const CONVERSATION_MESSAGES_PREFIX = "dify-msgs-"
const THEME_KEY = "dify-theme"

/* ═══════════════════════════════════════════════════
   设置读写
   ═══════════════════════════════════════════════════ */

export function loadSettings(): DifySettings {
  if (typeof window === "undefined") return { apiUrl: "", useMock: true, agentDefs: DEFAULT_AGENT_DEFS, agents: {} }
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return normalizeSettings(parsed)
    }
  } catch {
    // ignore
  }
  return { apiUrl: "", useMock: true, agentDefs: DEFAULT_AGENT_DEFS, agents: {} }
}

/** 向后兼容地规范化设置数据 */
function normalizeSettings(raw: Record<string, unknown>): DifySettings {
  const apiUrl = (raw.apiUrl as string) || ""
  const useMock = (raw.useMock as boolean) ?? true

  // 迁移 agentDefs
  let agentDefs: AgentDef[]
  if (Array.isArray(raw.agentDefs) && raw.agentDefs.length > 0) {
    agentDefs = raw.agentDefs as AgentDef[]
  } else {
    // 旧格式没有 agentDefs → 使用默认
    agentDefs = DEFAULT_AGENT_DEFS
  }

  // 迁移 agents (API Key 配置)
  let agents: Record<string, AgentApiConfig>
  if (raw.agents && typeof raw.agents === "object" && !Array.isArray(raw.agents)) {
    agents = raw.agents as Record<string, AgentApiConfig>
  } else {
    // 旧格式：apiKey 单字段 → 复制给所有默认应用
    if (raw.apiKey) {
      const cfg: AgentApiConfig = { apiKey: raw.apiKey as string }
      agents = {}
      for (const d of DEFAULT_AGENT_DEFS) {
        agents[d.id] = { ...cfg }
      }
    } else {
      agents = {}
    }
  }

  return { apiUrl, useMock, agentDefs, agents }
}

export function saveSettings(settings: DifySettings): void {
  if (typeof window === "undefined") return
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

/* ═══════════════════════════════════════════════════
   对话列表
   ═══════════════════════════════════════════════════ */

export interface ConversationMeta {
  id: string
  title: string
  /** agent id（字符串，非固定枚举） */
  agentType: string
  preview: string
  time: string
  updatedAt: number
}

export function loadConversations(): ConversationMeta[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(CONVERSATIONS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return []
}

export function saveConversations(list: ConversationMeta[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(list))
}

export function addConversation(conv: ConversationMeta): void {
  const list = loadConversations()
  const existing = list.findIndex((c) => c.id === conv.id)
  if (existing >= 0) {
    list[existing] = conv
  } else {
    list.unshift(conv)
  }
  saveConversations(list.slice(0, 50))
}

export function deleteConversation(id: string): void {
  const list = loadConversations().filter((c) => c.id !== id)
  saveConversations(list)
  if (typeof window !== "undefined") {
    localStorage.removeItem(CONVERSATION_MESSAGES_PREFIX + id)
  }
}

/* ═══════════════════════════════════════════════════
   活跃对话 ID
   ═══════════════════════════════════════════════════ */

export function loadActiveConversationId(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(ACTIVE_CONVERSATION_KEY)
}

export function saveActiveConversationId(id: string | null): void {
  if (typeof window === "undefined") return
  if (id) {
    localStorage.setItem(ACTIVE_CONVERSATION_KEY, id)
  } else {
    localStorage.removeItem(ACTIVE_CONVERSATION_KEY)
  }
}

/* ═══════════════════════════════════════════════════
   对话消息持久化
   ═══════════════════════════════════════════════════ */

import type { Message } from "@/app/page"

export function loadConversationMessages(conversationId: string): Message[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(CONVERSATION_MESSAGES_PREFIX + conversationId)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return []
}

export function saveConversationMessages(conversationId: string, messages: Message[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(CONVERSATION_MESSAGES_PREFIX + conversationId, JSON.stringify(messages))
  } catch {
    // ignore (quota exceeded, etc.)
  }
}

/* ═══════════════════════════════════════════════════
   生成对话 ID
   ═══════════════════════════════════════════════════ */

export function generateConversationId(): string {
  return "conv_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8)
}

/* ═══════════════════════════════════════════════════
   主题持久化
   ═══════════════════════════════════════════════════ */

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
