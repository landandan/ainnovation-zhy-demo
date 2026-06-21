"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { AuthProvider, useAuth } from "@/lib/auth-store"
import { isMockMode } from "@/lib/mock-config"

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, initialized } = useAuth()
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
      router.replace("/login")
    } else if (user && isLoginPage) {
      router.replace("/")
    }
  }, [user, initialized, pathname, router])

  if (!initialized) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-primary, #0a0e17)",
          color: "var(--text-secondary, #9ca3af)",
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
  return (
    <AuthProvider>
      <AuthGuard>{children}</AuthGuard>
    </AuthProvider>
  )
}