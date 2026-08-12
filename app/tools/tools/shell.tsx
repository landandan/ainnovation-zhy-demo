"use client"

import type { ReactNode } from "react"

export function ToolShell({
  title,
  desc,
  children,
}: {
  title: string
  desc: string
  children: ReactNode
}) {
  return (
    <div className="mx-auto max-w-[880px]">
      <h2 className="text-[20px] font-bold" style={{ color: "var(--foreground)" }}>
        {title}
      </h2>
      <p className="mb-5 mt-1 text-[13px]" style={{ color: "var(--text-muted)" }}>
        {desc}
      </p>
      <div
        className="rounded-2xl border p-5"
        style={{ background: "var(--card)", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}
      >
        {children}
      </div>
    </div>
  )
}

export function ToolToast({
  toast,
}: {
  toast: { type: "success" | "error" | "info"; text: string } | null
}) {
  if (!toast) return null
  const color =
    toast.type === "success" ? "#22C55E" : toast.type === "error" ? "#EF4444" : "var(--text-secondary)"
  const bg =
    toast.type === "success"
      ? "rgba(34,197,94,0.1)"
      : toast.type === "error"
        ? "rgba(239,68,68,0.1)"
        : "var(--secondary)"
  return (
    <div
      className="fixed left-1/2 top-4 z-[1200] -translate-x-1/2 rounded-xl px-4 py-2 text-[13px] font-medium"
      style={{ background: bg, color, boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }}
    >
      {toast.text}
    </div>
  )
}

/** 通用主按钮 */
export function PrimaryButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
      style={{ background: "var(--accent)", boxShadow: "var(--shadow-sm)" }}
    >
      {children}
    </button>
  )
}
