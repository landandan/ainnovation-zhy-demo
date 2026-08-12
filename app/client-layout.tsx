"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { AuthProvider, useAuth } from "@/lib/auth-store"
import { isMockMode } from "@/lib/mock-config"

type TransitionPhase = "idle" | "cover" | "reveal"

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, initialized, enableMockLogin } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!initialized) return

    const isLoginPage = pathname === "/login"

    // Mock 模式下不强制跳转登录页（auth-store 已自动注入 mock 用户）
    if (isMockMode()) {
      // 如果 mock 用户已在登录页，跳转到首页
      if (user && isLoginPage) {
        router.replace("/")
      }
      return
    }

    if (!user && !isLoginPage) {
      // 未登录且不在登录页 → 启用 Guest 登录
      enableMockLogin()
    } else if (user && isLoginPage) {
      router.replace("/")
    }
  }, [user, initialized, pathname, router, enableMockLogin])

  if (!initialized) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--background)",
          color: "var(--text-secondary)",
        }}
      >
        加载中...
      </div>
    )
  }

  // Mock 模式下直接渲染子组件（auth-store 已注入用户）
  if (isMockMode()) {
    return <>{children}</>
  }

  // 未登录且不在登录页 → 显示空白，等待跳转
  if (!user && pathname !== "/login") {
    return null
  }

  return <>{children}</>
}

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const [transitionPhase, setTransitionPhase] = useState<TransitionPhase>("idle")
  const cleanupTimerRef = useRef<number | null>(null)
  const fallbackTimerRef = useRef<number | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    const clearTimers = () => {
      if (cleanupTimerRef.current !== null) {
        window.clearTimeout(cleanupTimerRef.current)
        cleanupTimerRef.current = null
      }
      if (fallbackTimerRef.current !== null) {
        window.clearTimeout(fallbackTimerRef.current)
        fallbackTimerRef.current = null
      }
    }

    const startTransition = () => {
      clearTimers()
      setTransitionPhase("cover")
      fallbackTimerRef.current = window.setTimeout(() => {
        setTransitionPhase("reveal")
        cleanupTimerRef.current = window.setTimeout(() => {
          setTransitionPhase("idle")
        }, 360)
      }, 1800)
    }

    const completeTransition = () => {
      clearTimers()
      setTransitionPhase((current) => {
        if (current === "idle") return current
        return "reveal"
      })
      cleanupTimerRef.current = window.setTimeout(() => {
        setTransitionPhase("idle")
      }, 360)
    }

    window.addEventListener("app-route-transition-start", startTransition)
    window.addEventListener("app-route-transition-complete", completeTransition)

    return () => {
      window.removeEventListener("app-route-transition-start", startTransition)
      window.removeEventListener("app-route-transition-complete", completeTransition)
      clearTimers()
    }
  }, [])

  useEffect(() => {
    if (pathname !== "/" || transitionPhase !== "cover") return

    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current)
    }
    fallbackTimerRef.current = window.setTimeout(() => {
      setTransitionPhase("reveal")
      cleanupTimerRef.current = window.setTimeout(() => {
        setTransitionPhase("idle")
      }, 360)
    }, 900)
  }, [pathname, transitionPhase])

  return (
    <AuthProvider>
      <AuthGuard>{children}</AuthGuard>
      {transitionPhase !== "idle" && (
        <div
          className={`page-transition-overlay ${transitionPhase === "cover" ? "page-transition-overlay-exit" : "page-transition-overlay-enter"}`}
          aria-hidden="true"
        >
          <div className="page-transition-orb" />
        </div>
      )}
    </AuthProvider>
  )
}
