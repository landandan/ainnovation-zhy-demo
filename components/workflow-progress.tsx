'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { WorkflowProgress, type WorkflowNode, formatDuration } from '@/lib/workflow-progress'
import { Button } from '@/components/ui/button'

interface WorkflowProgressProps {
  progress: WorkflowProgress
  onRetry?: () => void
  onStop?: () => void
}

export function WorkflowProgressComponent({
  progress,
  onRetry,
  onStop,
}: WorkflowProgressProps) {
  const [expanded, setExpanded] = useState(false)
  const [contentHeight, setContentHeight] = useState(0)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setExpanded(false)
  }, [progress.taskId, progress.startedAt])

  useEffect(() => {
    const element = contentRef.current
    if (!element) return

    const updateHeight = () => {
      setContentHeight(element.scrollHeight)
    }

    updateHeight()
    const frameId = window.requestAnimationFrame(updateHeight)

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [expanded, progress.nodes.length, progress.status, progress.errorMessage, progress.progressPercent])

  const completedCount = progress.nodes.filter((node) => node.status === 'completed').length
  const currentNode = useMemo(() => {
    if (progress.nodes.length === 0) return null
    const runningNode = progress.nodes.find((node) => node.status === 'running')
    if (runningNode) return runningNode
    if (progress.status === 'completed') return progress.nodes[progress.nodes.length - 1]
    if (progress.currentNodeIndex >= 0 && progress.currentNodeIndex < progress.nodes.length) {
      return progress.nodes[progress.currentNodeIndex]
    }
    return progress.nodes[progress.nodes.length - 1]
  }, [progress])

  const visibleNodes = useMemo(() => {
    if (progress.nodes.length === 0) return []

    const runningIndex = progress.nodes.findIndex((node) => node.status === 'running')
    const activeIndex =
      runningIndex >= 0
        ? runningIndex
        : progress.currentNodeIndex >= 0 && progress.currentNodeIndex < progress.nodes.length
          ? progress.currentNodeIndex
          : progress.nodes.length - 1
    const endIndex = Math.min(activeIndex, progress.nodes.length - 1)
    const startIndex = Math.max(0, endIndex - 2)

    return progress.nodes.slice(startIndex, endIndex + 1).map((node, offset) => ({
      node,
      index: startIndex + offset,
    }))
  }, [progress.nodes, progress.currentNodeIndex])

  const summaryText = useMemo(() => {
    const parts = [`已完成 ${completedCount}/${Math.max(progress.totalNodes, progress.nodes.length || 0)} 个节点`]
    if (progress.status === 'running' && progress.estimatedRemainingTime) {
      parts.push(`预计剩余 ${formatDuration(progress.estimatedRemainingTime)}`)
    }
    if (progress.status === 'completed') {
      parts.push('链路已完成')
    }
    if (progress.status === 'error' && progress.errorMessage) {
      parts.push(progress.errorMessage)
    }
    return parts.join(' · ')
  }, [completedCount, progress])

  const getStatusIcon = (status: WorkflowNode['status']) => {
    switch (status) {
      case 'pending':
        return (
          <div className="h-4 w-4 rounded-full border border-slate-300 dark:border-slate-600" />
        )
      case 'running':
        return (
          <div className="flex h-4 w-4 items-center justify-center rounded-full border border-blue-500/70">
            <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          </div>
        )
      case 'completed':
        return (
          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/90 text-white">
            <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )
      case 'error':
        return (
          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500/90 text-white">
            <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )
      default:
        return null
    }
  }

  const getStatusColor = (status: WorkflowNode['status']) => {
    switch (status) {
      case 'pending':
        return 'text-slate-400 dark:text-slate-500'
      case 'running':
        return 'text-blue-600 dark:text-blue-400'
      case 'completed':
        return 'text-emerald-600 dark:text-emerald-400'
      case 'error':
        return 'text-red-600 dark:text-red-400'
      default:
        return ''
    }
  }

  const title =
    progress.status === "completed"
      ? "系统思考完成"
      : progress.status === "error"
        ? "系统思考中断"
        : "系统思考中"

  const statusBadgeClass =
    progress.status === 'completed'
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
      : progress.status === 'error'
        ? 'bg-red-500/10 text-red-600 dark:text-red-400'
        : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'

  const formatClockTime = (timestamp?: number) => {
    if (!timestamp) return '未记录'
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const getStatusLabel = (status: WorkflowNode['status']) => {
    switch (status) {
      case 'pending':
        return '待处理'
      case 'running':
        return '进行中'
      case 'completed':
        return '已完成'
      case 'error':
        return '异常'
      default:
        return status
    }
  }

  if (progress.status === 'idle') {
    return null
  }

  return (
    <div className="mb-2 w-full max-w-[720px] rounded-2xl border border-slate-200/80 bg-white/78 p-2.5 shadow-sm backdrop-blur-sm sm:p-3 dark:border-slate-700/80 dark:bg-slate-900/55">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="w-full text-left"
      >
        <div className="flex items-start gap-2.5 sm:gap-3">
          <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300 sm:h-7 sm:w-7">
            {!expanded ? (
              <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14M5 12h14" />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
              </svg>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-medium text-slate-900 sm:text-[13px] dark:text-slate-100">
                {title}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] sm:text-[11px] ${statusBadgeClass}`}>
                {progress.progressPercent}%
              </span>
            </div>

            <div className="mt-1 flex items-center gap-2">
              {currentNode ? getStatusIcon(currentNode.status) : getStatusIcon(progress.status === 'error' ? 'error' : 'running')}
              <span className="truncate text-[12px] text-slate-700 sm:text-[13px] dark:text-slate-200">
                {currentNode?.name || '正在初始化流程'}
              </span>
            </div>

            <p className="mt-1 line-clamp-2 text-[10px] leading-5 text-slate-500 sm:text-[11px] dark:text-slate-400">
              {summaryText}
            </p>
          </div>

          <svg
            className="mt-1 h-4 w-4 flex-shrink-0 text-slate-400 transition-transform duration-300 ease-out"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </button>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${
            progress.status === 'error'
              ? 'bg-red-500'
              : progress.status === 'completed'
                ? 'bg-emerald-500'
                : 'bg-blue-500'
          }`}
          style={{ width: `${progress.progressPercent}%` }}
        />
      </div>

      {!expanded && visibleNodes.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {visibleNodes.map(({ node, index }) => (
            <div
              key={node.id}
              className="flex min-h-[32px] items-center gap-2 rounded-xl bg-slate-50/70 px-2.5 py-1.5 dark:bg-slate-900/45"
            >
              {getStatusIcon(node.status)}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={`truncate text-[12px] font-medium ${getStatusColor(node.status)}`}>
                    {node.name}
                  </span>
                  <span className="flex-shrink-0 text-[10px] text-slate-400">
                    {getStatusLabel(node.status)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                  <span>#{index + 1}</span>
                  <span>{node.duration ? formatDuration(node.duration) : node.status === 'running' ? '处理中' : '待记录'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        className="overflow-hidden transition-[max-height,opacity,margin] duration-300 ease-out"
        style={{
          maxHeight: expanded ? `${contentHeight}px` : '0px',
          opacity: expanded ? 1 : 0,
          marginTop: expanded ? '10px' : '0px',
        }}
      >
        <div ref={contentRef}>
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-2.5 sm:p-3 dark:border-slate-800 dark:bg-slate-900/55">
            <div className="grid gap-2 text-[10px] text-slate-500 sm:text-[11px] dark:text-slate-400 sm:grid-cols-3">
              <div>
                <span className="mr-1">当前节点</span>
                <span className="text-slate-700 dark:text-slate-200">{currentNode?.name || '未开始'}</span>
              </div>
              <div>
                <span className="mr-1">开始时间</span>
                <span className="text-slate-700 dark:text-slate-200">{formatClockTime(progress.startedAt)}</span>
              </div>
              <div>
                <span className="mr-1">剩余预估</span>
                <span className="text-slate-700 dark:text-slate-200">
                  {progress.estimatedRemainingTime ? formatDuration(progress.estimatedRemainingTime) : '暂无'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {progress.nodes.map((node, index) => (
              <div key={node.id} className="flex items-start gap-3">
                <div className="flex flex-col items-center pt-0.5">
                  {getStatusIcon(node.status)}
                  {index < progress.nodes.length - 1 && (
                    <div
                      className={`mt-1 h-6 w-px ${
                        node.status === 'completed' ? 'bg-emerald-400/80' : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1 rounded-xl bg-slate-50/70 px-2.5 py-2 sm:px-3 dark:bg-slate-900/45">
                  <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
                    <span className={`text-[12px] font-medium ${getStatusColor(node.status)}`}>
                      {node.name}
                    </span>
                    <span className="text-[10px] tracking-wide text-slate-400">
                      {getStatusLabel(node.status)}
                    </span>
                  </div>

                  <div className="mt-1 grid gap-x-3 gap-y-1 text-[10px] text-slate-500 sm:flex sm:flex-wrap dark:text-slate-400">
                    <span>开始: {formatClockTime(node.startedAt)}</span>
                    <span>结束: {formatClockTime(node.completedAt)}</span>
                    <span>耗时: {node.duration ? formatDuration(node.duration) : '处理中'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {progress.status === 'error' && (
            <div className="mt-3 rounded-xl border border-red-200/80 bg-red-50/80 px-3 py-2 text-[11px] sm:text-[12px] text-red-600 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-400">
              {progress.errorMessage || '工作流执行出错'}
            </div>
          )}

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {progress.status === 'running' && onStop && (
              <Button
                onClick={onStop}
                variant="outline"
                size="sm"
                className="h-8 rounded-full px-3 text-[12px] w-full sm:w-auto"
              >
                停止执行
              </Button>
            )}
            {progress.status === 'error' && onRetry && (
              <Button
                onClick={onRetry}
                variant="default"
                size="sm"
                className="h-8 rounded-full px-3 text-[12px] w-full sm:w-auto"
              >
                重新执行
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
