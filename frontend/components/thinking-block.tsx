"use client"

import React, { useState, useEffect, useRef } from "react"

interface ThinkingBlockProps {
  text: string
  /** 思考是否已停止（流已结束），停止后隐藏动画点图标 */
  isComplete?: boolean
}

/**
 * Thinking 思考链组件（DeepSeek 风格）
 * 默认折叠，可展开查看模型的思考过程
 * 左侧带彩色强调线，视觉上独立于消息气泡
 */
export function ThinkingBlock({ text, isComplete }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        border: "1px solid var(--border)",
        background: "var(--thinking-bg, rgba(var(--muted-rgb, 100, 100, 100), 0.06))",
        borderLeft: "3px solid var(--accent)",
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[12px] font-medium transition-colors hover:opacity-80"
        style={{ color: "var(--text-muted)" }}
      >
        {/* 思考图标：流式进行中显示动画点，停止后显示勾选 */}
        {!isComplete ? (
          <span className="flex items-center gap-0.5">
            <span className="thinking-dot-icon" style={{ animationDelay: "0s" }} />
            <span className="thinking-dot-icon" style={{ animationDelay: "0.2s" }} />
            <span className="thinking-dot-icon" style={{ animationDelay: "0.4s" }} />
          </span>
        ) : (
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ opacity: 0.6 }}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        <span className="flex-1 text-left">
          {isComplete ? "已思考" : "思考中..."}
        </span>
        <svg
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          style={{
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.25s ease",
            flexShrink: 0,
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div
          className="px-3.5 pb-3.5 pt-1 text-[12px] leading-relaxed whitespace-pre-wrap"
          style={{
            color: "var(--text-secondary)",
            borderTop: "1px solid var(--border)",
            maxHeight: "300px",
            overflowY: "auto",
          }}
        >
          {text}
        </div>
      )}
    </div>
  )
}