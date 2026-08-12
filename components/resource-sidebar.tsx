"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import rehypeRaw from "rehype-raw"

interface ResourceItem {
  document_name: string
  content: string
}

interface ResourceSidebarProps {
  isOpen: boolean
  onClose: () => void
  resources: ResourceItem[]
}

export function ResourceSidebar({ isOpen, onClose, resources }: ResourceSidebarProps) {
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set([0]))
  const [isTransitioning, setIsTransitioning] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const resizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastResourcesRef = useRef<string>("")

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
    }

    return () => {
      document.removeEventListener("keydown", handleEscape)
    }
  }, [isOpen, onClose])

  useEffect(() => {
    setIsTransitioning(true)
  }, [isOpen])

  useEffect(() => {
    const currentResourcesKey = JSON.stringify(resources)
    if (currentResourcesKey !== lastResourcesRef.current) {
      lastResourcesRef.current = currentResourcesKey
      setExpandedIndices(new Set([0]))
    }
  }, [resources])

  const handleResize = useCallback(() => {
    setIsTransitioning(false)

    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current)
    }

    resizeTimeoutRef.current = setTimeout(() => {
      requestAnimationFrame(() => {
        setIsTransitioning(true)
      })
    }, 150)
  }, [])

  useEffect(() => {
    window.addEventListener("resize", handleResize, { passive: true })

    return () => {
      window.removeEventListener("resize", handleResize)
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
      }
    }
  }, [handleResize])

  const toggleExpand = (index: number) => {
    setExpandedIndices((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }

  const truncateContent = (content: string) => {
    return content.replace(/<\/?think>/g, '').trim()
    // const plainText = content.replace(/[#*`>\[\]]/g, "").trim()
    // return plainText.length > maxLength ? plainText.slice(0, maxLength) + "..." : plainText
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 lg:hidden ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{
          background: "#0009",
          transition: isTransitioning && isOpen ? "opacity 0.3s ease" : "none",
        }}
        onClick={onClose}
      />

      <div
        ref={sidebarRef}
        className={`flex flex-col resource-sidebar-container ${
          isOpen ? "resource-sidebar-open" : ""
        }`}
        style={{
          background: "var(--background)",
          transition: isTransitioning ? "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)" : "none",
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <span className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
            引用来源 {resources.length}
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--secondary)] transition-colors"
            style={{ color: "var(--text-secondary)" }}
            title="关闭"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {resources.map((resource, index) => (
            <div
              key={index}
              className="border-b border-[var(--border)] last:border-b-0"
            >
              <button
                onClick={() => toggleExpand(index)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--secondary)] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: "var(--accent)" }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="8" y1="13" x2="16" y2="13" />
                    <line x1="8" y1="17" x2="13" y2="17" />
                  </svg>
                  <span className="text-base font-medium" style={{ color: "var(--foreground)" }}>
                    {resource.document_name}
                  </span>
                </div>
                <svg
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  className={`transition-transform duration-300 ${expandedIndices.has(index) ? "rotate-180" : ""}`}
                  style={{ color: "var(--text-muted)" }}
                >
                  <path d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ${
                  expandedIndices.has(index) ? "max-h-[500px]" : "max-h-0"
                }`}
              >
                <div className="px-4 pb-4">
                  <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    {/* {truncateContent(resource.content, 200)} */}
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex, rehypeRaw]}
                    >
                      {resource.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}