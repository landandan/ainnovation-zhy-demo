"use client"

import React, { useState, useEffect, useRef } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import rehypeRaw from "rehype-raw"

interface ThinkingBlockProps {
  text: string
  /** 思考是否已停止（流已结束），停止后隐藏动画点图标 */
  isComplete?: boolean
  /** 默认是否展开 */
  defaultExpanded?: boolean
  /** 思考完成后是否自动折叠 */
  autoCollapse?: boolean
}

/**
 * Thinking 思考链组件（DeepSeek 风格）
 * 默认折叠，可展开查看模型的思考过程
 * 左侧带彩色强调线，视觉上独立于消息气泡
 */
export function ThinkingBlock({ text, isComplete, defaultExpanded = false, autoCollapse = false }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [hasUserToggled, setHasUserToggled] = useState(false) // 标记用户是否手动操作过
  
  // 当 isComplete 变为 true 且 autoCollapse 为 true 时，且用户没手动操作过，延迟一小段时间再自动折叠
  useEffect(() => {
    if (isComplete && autoCollapse && !hasUserToggled) {
      const timer = setTimeout(() => {
        setExpanded(false)
      }, 600) // 延迟 600ms 折叠，让用户看到"已思考"状态
      return () => clearTimeout(timer)
    }
  }, [isComplete, autoCollapse, hasUserToggled])

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: "var(--border)",
        borderLeftWidth: "3px",
        borderLeftColor: "var(--accent)",
        background: "var(--thinking-bg, rgba(var(--muted-rgb, 100, 100, 100), 0.06))",
      }}
    >
      <button
        onClick={() => {
          setExpanded(!expanded)
          setHasUserToggled(true)
        }}
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
          className="px-3.5 pb-3.5 pt-1 text-[12px] leading-relaxed prose-content kimi-style-markdown"
          style={{
            color: "var(--text-secondary)",
            borderTop: "1px solid var(--border)",
            maxHeight: "300px",
            overflowY: "auto",
          }}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex, rehypeRaw]}
          >
            {text.replace(/<\/?think>/g, '').trim()}
          </ReactMarkdown>
        </div>
      )}
    </div>
  )
}