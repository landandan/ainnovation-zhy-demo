"use client"

/**
 * 持久化设置 & 对话历史 Store
 * 使用 localStorage 存储
 */

export interface DifySettings {
  apiUrl: string
  apiKey: string
  useMock: boolean
}

export interface ConversationMeta {
  id: string
  title: string
  agentType: string
  preview: string
  time: string
  updatedAt: number
}

const SETTINGS_KEY = "dify-settings"
const CONVERSATIONS_KEY = "dify-conversations"
const ACTIVE_CONVERSATION_KEY = "dify-active-conversation"
const CONVERSATION_MESSAGES_PREFIX = "dify-msgs-"

/* ───── 设置 ───── */

export function loadSettings(): DifySettings {
  if (typeof window === "undefined") return { apiUrl: "", apiKey: "", useMock: true }
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return { apiUrl: "", apiKey: "", useMock: true }
}

export function saveSettings(settings: DifySettings): void {
  if (typeof window === "undefined") return
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

/* ───── 对话列表 ───── */

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
  // 最多保留 50 条
  saveConversations(list.slice(0, 50))
}

export function deleteConversation(id: string): void {
  const list = loadConversations().filter((c) => c.id !== id)
  saveConversations(list)
  // 同时删除消息
  if (typeof window !== "undefined") {
    localStorage.removeItem(CONVERSATION_MESSAGES_PREFIX + id)
  }
}

/* ───── 活跃对话 ID ───── */

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

/* ───── 对话消息（持久化） ───── */

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

/* ───── 生成对话 ID ───── */

export function generateConversationId(): string {
  return "conv_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8)
}