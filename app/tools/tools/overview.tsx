"use client"

import { tools } from "./registry"

export default function Overview({ onSelect }: { onSelect: (id: string) => void }) {
  return (
    <div className="mx-auto max-w-[960px]">
      <div className="mb-6">
        <h2 className="text-[20px] font-bold" style={{ color: "var(--foreground)" }}>
          选择一个工具
        </h2>
        <p className="mt-1 text-[13px]" style={{ color: "var(--text-muted)" }}>
          纯前端实现，无需上传到服务器 · 部分工具依赖浏览器能力或网络
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
        {tools.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className="group flex items-start gap-4 rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5"
              style={{
                background: "var(--card)",
                borderColor: "var(--border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <span
                className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl"
                style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
              >
                <Icon size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
                  {t.label}
                </div>
                <div className="mt-1 text-[12px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {t.desc}
                </div>
                <div
                  className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ color: "var(--accent)" }}
                >
                  打开
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
