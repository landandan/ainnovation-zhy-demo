"use client"

import React, { useState, useCallback } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"

interface MessageBubbleProps {
  role: "user" | "ai"
  text: string
  time: string
}

/* ───── 消息气泡（Markdown + LaTeX 格式支持 + 一键复制） ───── */
export function MessageBubble({ role, text, time }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 降级：使用传统方法
      const textarea = document.createElement("textarea")
      textarea.value = text
      textarea.style.position = "fixed"
      textarea.style.opacity = "0"
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [text])

  return (
    <div
      className="rounded-2xl px-4 py-3.5 text-sm leading-relaxed relative group"
      style={{
        background:
          role === "user" ? "var(--accent)" : "var(--card)",
        color:
          role === "user" ? "var(--accent-foreground)" : "var(--foreground)",
        border: role === "ai" ? "1px solid var(--border)" : "none",
        borderBottomRightRadius: role === "user" ? "8px" : undefined,
        borderBottomLeftRadius: role === "ai" ? "8px" : undefined,
        boxShadow:
          role === "user" ? "var(--shadow-md)" : "var(--shadow-sm)",
        wordBreak: "break-word",
      }}
    >
      {/* AI 消息的复制按钮 */}
      {role === "ai" && (
        <button
          onClick={handleCopy}
          className="absolute right-2 top-2 flex items-center gap-1 rounded-md px-2 py-1 text-[11px] opacity-0 group-hover:opacity-100 transition-all hover:bg-white/10"
          style={{ color: "var(--text-muted)" }}
          title="复制全文"
        >
          {copied ? (
            <>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              已复制
            </>
          ) : (
            <>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              复制
            </>
          )}
        </button>
      )}

      {/* Markdown 渲染内容 */}
      <article
        className="prose-content"
        style={role === "user" ? { color: "inherit" } : undefined}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            // 自定义代码块渲染
            code({ className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || "")
              const isInline = !match
              
              if (isInline) {
                return (
                  <code
                    className={className}
                    style={{
                      background: "var(--inline-code-bg)",
                      color: "var(--inline-code-color)",
                      padding: "0.15em 0.4em",
                      borderRadius: "4px",
                      fontSize: "0.85em",
                      fontFamily: "var(--font-mono), monospace",
                    }}
                    {...props}
                  >
                    {children}
                  </code>
                )
              }

              // 代码块
              const [blockCopied, setBlockCopied] = useState(false)
              const codeStr = String(children).replace(/\n$/, "")

              const handleBlockCopy = () => {
                navigator.clipboard.writeText(codeStr).then(() => {
                  setBlockCopied(true)
                  setTimeout(() => setBlockCopied(false), 2000)
                })
              }

              return (
                <div
                  className="code-block-wrapper"
                  style={{
                    margin: "0.75em 0",
                    borderRadius: "12px",
                    overflow: "hidden",
                    border: "1px solid var(--border)",
                    background: "var(--code-block-bg)",
                  }}
                >
                  <div
                    className="flex items-center justify-between px-4 py-2"
                    style={{
                      background: "var(--code-header-bg)",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <span
                      className="text-[11px] font-medium uppercase tracking-wider"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {match[1]}
                    </span>
                    <button
                      onClick={handleBlockCopy}
                      className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] transition-all hover:bg-white/10"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {blockCopied ? (
                        <>
                          <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          已复制
                        </>
                      ) : (
                        <>
                          <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <rect x="9" y="9" width="13" height="13" rx="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                          复制
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed" style={{ background: "transparent" }}>
                    <code className={className} {...props}>
                      {children}
                    </code>
                  </pre>
                </div>
              )
            },

            // 表格渲染
            table({ children }) {
              return (
                <div
                  className="overflow-x-auto my-3 rounded-xl"
                  style={{ border: "1px solid var(--border)" }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "0.875em",
                    }}
                  >
                    {children}
                  </table>
                </div>
              )
            },
            thead({ children }) {
              return (
                <thead style={{ background: "var(--table-header-bg)" }}>
                  {children}
                </thead>
              )
            },
            th({ children }) {
              return (
                <th
                  style={{
                    padding: "10px 16px",
                    textAlign: "left",
                    fontWeight: 600,
                    fontSize: "0.85em",
                    color: "var(--foreground)",
                    borderBottom: "2px solid var(--border)",
                  }}
                >
                  {children}
                </th>
              )
            },
            td({ children }) {
              return (
                <td
                  style={{
                    padding: "8px 16px",
                    borderBottom: "1px solid var(--border)",
                    color: "var(--foreground)",
                  }}
                >
                  {children}
                </td>
              )
            },

            // 引用块
            blockquote({ children }) {
              return (
                <blockquote
                  style={{
                    margin: "0.75em 0",
                    padding: "0.5em 1em",
                    borderLeft: "3px solid var(--accent)",
                    background: "var(--blockquote-bg)",
                    borderRadius: "0 8px 8px 0",
                    color: "var(--text-secondary)",
                    fontStyle: "italic",
                  }}
                >
                  {children}
                </blockquote>
              )
            },

            // 链接
            a({ href, children }) {
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "var(--accent)",
                    textDecoration: "underline",
                    textUnderlineOffset: "2px",
                    textDecorationColor: "var(--accent)",
                    textDecorationThickness: "1px",
                  }}
                >
                  {children}
                </a>
              )
            },

            // 图片
            img({ src, alt }) {
              return (
                <img
                  src={src}
                  alt={alt}
                  className="my-3 max-w-full rounded-xl"
                  style={{ border: "1px solid var(--border)" }}
                  loading="lazy"
                />
              )
            },

            // 分割线
            hr() {
              return (
                <hr
                  style={{
                    margin: "1em 0",
                    border: "none",
                    borderTop: "1px solid var(--border)",
                  }}
                />
              )
            },

            // 有序/无序列表样式优化
            ul({ children }) {
              return (
                <ul style={{ paddingLeft: "1.5em", margin: "0.5em 0" }}>
                  {children}
                </ul>
              )
            },
            ol({ children }) {
              return (
                <ol style={{ paddingLeft: "1.5em", margin: "0.5em 0" }}>
                  {children}
                </ol>
              )
            },
          }}
        >
          {text}
        </ReactMarkdown>
      </article>

      {/* 用户消息的复制按钮 */}
      {role === "user" && (
        <button
          onClick={handleCopy}
          className="absolute -left-2 top-2 -translate-x-full flex items-center gap-1 rounded-md px-2 py-1 text-[11px] opacity-0 group-hover:opacity-100 transition-all hover:bg-white/10"
          style={{ color: "var(--text-muted)" }}
          title="复制"
        >
          {copied ? (
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
      )}
    </div>
  )
}