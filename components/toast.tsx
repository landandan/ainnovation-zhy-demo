"use client"

import { useState, useEffect, useCallback, useRef } from "react"

export type ToastType = "success" | "error" | "warning" | "info"

export interface ToastItem {
  id: number
  message: string
  type: ToastType
  exiting?: boolean
}

interface ToastProps {
  toasts: ToastItem[]
  onDismiss?: (id: number) => void
}

const typeIcon: Record<ToastType, string> = {
  success: "✅",
  error: "❌",
  warning: "⚠️",
  info: "ℹ️",
}

export function Toast({ toasts, onDismiss }: ToastProps) {
  if (toasts.length === 0) return null

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <ToastSingle key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function ToastSingle({
  toast,
  onDismiss,
}: {
  toast: ToastItem
  onDismiss?: (id: number) => void
}) {
  const [exiting, setExiting] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleDismiss = useCallback(() => {
    if (exiting) return
    setExiting(true)
    exitTimerRef.current = setTimeout(() => {
      onDismiss?.(toast.id)
    }, 300)
  }, [exiting, onDismiss, toast.id])

  useEffect(() => {
    // Auto dismiss after 4 seconds
    timerRef.current = setTimeout(() => {
      handleDismiss()
    }, 4000)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
    }
  }, [handleDismiss])

  return (
    <div
      className={`toast-item ${toast.type}${exiting ? " exiting" : ""}`}
      role="alert"
      aria-live="polite"
    >
      <span className="toast-icon">{typeIcon[toast.type]}</span>
      <span className="toast-msg">{toast.message}</span>
      <button
        className="toast-dismiss"
        onClick={handleDismiss}
        aria-label="关闭通知"
      >
        ✕
      </button>
    </div>
  )
}

/**
 * Hook to manage toast notifications with type support
 */
export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const addToast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = ++idRef.current
      setToasts((prev) => [...prev.slice(-4), { id, message, type }])
    },
    [],
  )

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const success = useCallback(
    (message: string) => addToast(message, "success"),
    [addToast],
  )
  const error = useCallback(
    (message: string) => addToast(message, "error"),
    [addToast],
  )
  const warning = useCallback(
    (message: string) => addToast(message, "warning"),
    [addToast],
  )
  const info = useCallback(
    (message: string) => addToast(message, "info"),
    [addToast],
  )

  return { toasts, addToast, dismissToast, success, error, warning, info }
}