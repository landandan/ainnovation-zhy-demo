"use client"

import React, { useState, useCallback } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import rehypeRaw from "rehype-raw"
import { DownloadLink } from "./download-link"
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vs, vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ChevronDownIcon, ClipboardDocumentIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

interface BubbleAttachment {
  name: string
  size?: number
  original_url?: string
  file_id?: string
  mime_type?: string
  type?: string
}

interface MessageBubbleProps {
  role: "user" | "ai"
  text: string
  time: string
  agentId?: string
  attachments?: BubbleAttachment[]
}

/* ───── 消息气泡（Markdown + LaTeX 格式支持 + 一键复制） ───── */

// 新增 ThinkComponent
function ThinkComponent({ content }: { content: string }) {
  const [isOpen, setIsOpen] = useState(false) // 默认折叠

  return (
    <div
      className="think-block mb-4"
      style={{
        background: "var(--think-block-bg)",
        border: "1px solid var(--think-block-border)",
        borderRadius: "12px",
        padding: "12px 16px",
      }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full text-left"
        style={{ color: "var(--text-muted)", fontWeight: 600 }}
      >
        {/* 勾图标 */}
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ opacity: 0.6 }}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span>已思考</span>
        <div className="flex-1" />
        <ChevronDownIcon
          className="w-4 h-4 transition-transform flex-shrink-0"
          style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
      </button>
      {isOpen && (
        <div
          className="think-content mt-2"
          style={{
            borderLeft: "2px solid var(--think-content-border-left)",
            paddingLeft: "12px",
            marginLeft: "8px",
            color: "var(--text-secondary)",
          }}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex, rehypeRaw]}
            components={{
              think: () => null // 忽略 think 标签
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      )}
    </div>
  )
}

/* ───── 消息气泡（Markdown + LaTeX 格式支持 + 一键复制） ───── */
export function MessageBubble({ role, text, time, agentId, attachments }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)

  // 解析 <think> 标签 - 只移除思考标签，内容已经在外部处理
  const mainText = text.replace(/<think>[\s\S]*?<\/think>/, '').trim();

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

      {!!attachments?.length && (
        <div
          className="mb-3 flex flex-col gap-2"
          style={{
            paddingRight: role === "ai" ? "56px" : 0,
          }}
        >
          {attachments.map((attachment, index) => {
            const href = attachment.original_url || (attachment.file_id ? `/files/${attachment.file_id}` : "#")
            return (
              <div
                key={`${attachment.file_id || attachment.original_url || attachment.name}-${index}`}
                className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  borderColor: "var(--border)",
                }}
              >
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium">{attachment.name}</div>
                  <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {attachment.type || attachment.mime_type || "附件"}
                  </div>
                </div>
                <DownloadLink
                  href={href}
                  label={attachment.name}
                  agentId={agentId}
                  fileId={attachment.file_id}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* Markdown 渲染主要内容 */}
      {mainText && (
        <article
          className={`prose-content ${role === "ai" ? "kimi-style-markdown" : ""}`}
          style={role === "user" ? { color: "inherit" } : undefined}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex, rehypeRaw]}
            components={{
              think: () => null, // 忽略 think 标签
              p: ({ node, ...props }) => <div className="paragraph" dir="auto" {...props} />,
              h1: ({ node, ...props }) => <h1 className="heading-1" {...props} />,
              h2: ({ node, ...props }) => <h2 className="heading-2" {...props} />,
              h3: ({ node, ...props }) => <h3 className="heading-3" {...props} />,
              ul: ({ node, ...props }) => <ul className="list-disc" {...props} />,
              ol: ({ node, ...props }) => <ol className="list-decimal" {...props} />,
              li: ({ node, ...props }) => <li><div className="paragraph" dir="auto" {...props} /></li>,
              blockquote: ({ node, ...props }) => <blockquote className="blockquote" {...props} />,
              // 自定义代码块渲染
            code({ className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || "")
              const isInline = !match
              
              if (isInline) {
                return (
                  <code
                    className="segment-code-inline"
                    {...props}
                  >
                    {children}
                  </code>
                )
              }

              // 代码块
              const [blockCopied, setBlockCopied] = useState(false)
              const codeStr = String(children).replace(/\n$/, "")
              const isDarkTheme = document.documentElement.dataset.theme === "deep-ocean"

              const handleBlockCopy = () => {
                navigator.clipboard.writeText(codeStr).then(() => {
                  setBlockCopied(true)
                  setTimeout(() => setBlockCopied(false), 2000)
                })
              }

              return (
                <div className="segment-code">
                  <header className="segment-code-header" style={{ position: 'sticky', left: 0, top: 0 }}>
                    <div className="segment-code-header-content">
                      <span className="segment-code-lang">{match[1] || "text"}</span>
                      <div
                        className="icon-button"
                        onClick={handleBlockCopy}
                        title="复制"
                      >
                        {blockCopied ? (
                          <span className="text-xs text-green-500">已复制</span>
                        ) : (
                          <ClipboardDocumentIcon className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                  </header>
                  <div className={`segment-code-content syntax-highlighter ${isDarkTheme ? "dark" : "light"}`}>
                    <SyntaxHighlighter
                      style={isDarkTheme ? vscDarkPlus : vs}
                      language={match[1]}
                      PreTag="div"
                      customStyle={{
                        margin: 0,
                        padding: "12px 16px",
                        background: "transparent",
                        fontSize: "13px",
                        lineHeight: "1.5",
                      }}
                      {...props}
                    >
                      {codeStr}
                    </SyntaxHighlighter>
                  </div>
                </div>
              )
            },

            // 忽略残留的 think 标签，避免 React 警告
            think({ children }) {
              return <div className="think-residual">{children}</div>
            },

            // 表格渲染
            table({ children, ...props }) {
              return (
                <div className="table-container markdown-table">
                  <header className="table-actions" style={{ position: 'sticky', left: 0, top: 0 }}>
                    <div className="table-actions-content">
                      <span className="table-title">表格</span>
                      <div className="flex gap-2">
                        <div className="icon-button" title="复制">
                          <ClipboardDocumentIcon className="w-4 h-4" />
                        </div>
                        <div className="icon-button" title="下载">
                          <ArrowDownTrayIcon className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </header>
                  <div className="table-wrapper">
                    <table {...props}>
                      {children}
                    </table>
                  </div>
                </div>
              )
            },
            thead({ children }) {
              return (
                <thead>
                  {children}
                </thead>
              )
            },
            th({ children, ...props }) {
              return (
                <th align="left" {...props}>
                  {children}
                </th>
              )
            },
            td({ children, ...props }) {
              return (
                <td align="left" {...props}>
                  {children}
                </td>
              )
            },

            // 引用块
            blockquote({ children }) {
              return (
                <blockquote>
                  {children}
                </blockquote>
              )
            },

            // 链接
            a({ href, children }) {
              const label = Array.isArray(children) ? String(children.join("")).trim() : String(children as any)
              const isAttachment = !!href && (
                /\/files\//i.test(href) ||
                /\.(csv|tsv|txt|md|json|log|pdf|png|jpg|jpeg|gif|webp)$/i.test(href)
              )
              if (isAttachment) {
                return <DownloadLink href={href!} label={label} agentId={agentId} />
              }
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
                <ul>
                  {children}
                </ul>
              )
            },
            ol({ children }) {
              return (
                <ol>
                  {children}
                </ol>
              )
            },
          }}
        >
          {mainText}
        </ReactMarkdown>
      </article>
      )}

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
