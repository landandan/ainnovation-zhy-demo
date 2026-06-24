"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-store"
import { Button } from "@/components/ui/button"
import { isMockMode, enableMockMode } from "@/lib/mock-config"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login, register, loading, user } = useAuth()

  const [isRegister, setIsRegister] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [error, setError] = useState("")

  // 检测 URL 参数 ?mock=true，开启 mock 模式并预填账号密码（不自动登录）
  useEffect(() => {
    const mockParam = searchParams.get("mock")
    if (mockParam === "true" && !isMockMode()) {
      enableMockMode()
      setUsername("admin")
      setPassword("admin123")
    } else if (isMockMode()) {
      // 已经在 mock 模式下，预填默认账号密码
      setUsername("admin")
      setPassword("admin123")
    }
  }, [searchParams])

  // 已登录则跳转到首页
  if (user) {
    router.replace("/")
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!username.trim() || !password.trim()) {
      setError("用户名和密码不能为空")
      return
    }

    try {
      if (isRegister) {
        await register({ username: username.trim(), password, display_name: displayName.trim() || undefined })
      } else {
        await login({ username: username.trim(), password })
      }
      router.replace("/")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "操作失败"
      setError(msg)
    }
  }

  const mockMode = isMockMode()

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-primary, #0a0e17)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          padding: "2rem",
          background: "var(--bg-secondary, #111827)",
          borderRadius: 12,
          border: "1px solid var(--border-color, #1f2937)",
        }}
      >
        {/* Mock 模式提示标识 */}
        {mockMode && (
          <div
            style={{
              marginBottom: "1rem",
              padding: "0.5rem 0.75rem",
              borderRadius: 8,
              background: "rgba(59, 130, 246, 0.1)",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              color: "#60a5fa",
              fontSize: "0.75rem",
              textAlign: "center",
            }}
          >
            🧪 Mock 模式已开启 · 默认账号 admin / admin123
          </div>
        )}

        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "var(--text-primary, #f9fafb)",
            textAlign: "center",
            marginBottom: "1.5rem",
          }}
        >
          {isRegister ? "注册账号" : "登录"}
        </h1>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.875rem",
                color: "var(--text-secondary, #9ca3af)",
                marginBottom: "0.25rem",
              }}
            >
              用户名
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              autoComplete="username"
              style={{
                width: "100%",
                padding: "0.625rem 0.75rem",
                borderRadius: 8,
                border: "1px solid var(--border-color, #1f2937)",
                background: "var(--bg-tertiary, #1a1f2e)",
                color: "var(--text-primary, #f9fafb)",
                fontSize: "0.875rem",
                outline: "none",
              }}
            />
          </div>

          {isRegister && (
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.875rem",
                  color: "var(--text-secondary, #9ca3af)",
                  marginBottom: "0.25rem",
                }}
              >
                显示名称（可选）
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="请输入显示名称"
                style={{
                  width: "100%",
                  padding: "0.625rem 0.75rem",
                  borderRadius: 8,
                  border: "1px solid var(--border-color, #1f2937)",
                  background: "var(--bg-tertiary, #1a1f2e)",
                  color: "var(--text-primary, #f9fafb)",
                  fontSize: "0.875rem",
                  outline: "none",
                }}
              />
            </div>
          )}

          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.875rem",
                color: "var(--text-secondary, #9ca3af)",
                marginBottom: "0.25rem",
              }}
            >
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              autoComplete={isRegister ? "new-password" : "current-password"}
              style={{
                width: "100%",
                padding: "0.625rem 0.75rem",
                borderRadius: 8,
                border: "1px solid var(--border-color, #1f2937)",
                background: "var(--bg-tertiary, #1a1f2e)",
                color: "var(--text-primary, #f9fafb)",
                fontSize: "0.875rem",
                outline: "none",
              }}
            />
          </div>

          {error && (
            <p style={{ color: "var(--error, #ef4444)", fontSize: "0.8125rem", margin: 0 }}>{error}</p>
          )}

          <Button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              marginTop: "0.5rem",
              padding: "0.625rem",
              fontSize: "0.9375rem",
              fontWeight: 600,
            }}
          >
            {loading ? "请稍候..." : isRegister ? "注册" : "登录"}
          </Button>

          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister)
              setError("")
            }}
            style={{
              background: "none",
              border: "none",
              color: "var(--accent, #3b82f6)",
              fontSize: "0.8125rem",
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            {isRegister ? "已有账号？去登录" : "没有账号？去注册"}
          </button>
        </form>
      </div>
    </div>
  )
}