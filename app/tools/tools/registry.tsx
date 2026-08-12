"use client"

import type { ComponentType } from "react"
import dynamic from "next/dynamic"
import { FileText, Mic, FileCode2, Languages, type LucideIcon } from "lucide-react"

export const OVERVIEW_ID = "overview"

export interface ToolDef {
  id: string
  label: string
  desc: string
  icon: LucideIcon
  component: ComponentType
}

function ToolLoading() {
  return (
    <div className="flex items-center justify-center py-20 text-[13px]" style={{ color: "var(--text-muted)" }}>
      <div
        className="mr-3 h-5 w-5 animate-spin rounded-full border-2"
        style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }}
      />
      工具加载中…
    </div>
  )
}

export const tools: ToolDef[] = [
  {
    id: "pdf-to-word",
    label: "PDF 转 Word",
    desc: "上传 PDF，提取正文并导出为 Word 文档（离线可用）",
    icon: FileText,
    component: dynamic(() => import("./pdf-to-word"), { ssr: false, loading: () => <ToolLoading /> }),
  },
  {
    id: "speech-to-text",
    label: "语音转文字",
    desc: "实时语音识别，将麦克风语音转为文字",
    icon: Mic,
    component: dynamic(() => import("./speech-to-text"), { ssr: false, loading: () => <ToolLoading /> }),
  },
  {
    id: "doc-convert",
    label: "文档格式转换",
    desc: "Markdown / Word / Excel / CSV 等格式互转",
    icon: FileCode2,
    component: dynamic(() => import("./doc-convert"), { ssr: false, loading: () => <ToolLoading /> }),
  },
  {
    id: "en-to-zh",
    label: "英文转中文",
    desc: "英文文本一键翻译为中文（需联网）",
    icon: Languages,
    component: dynamic(() => import("./en-to-zh"), { ssr: false, loading: () => <ToolLoading /> }),
  },
]
