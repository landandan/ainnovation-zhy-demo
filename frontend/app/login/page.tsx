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
  useEffect(() => {
    if (user) {
      router.replace("/")
    }
  }, [user, router])

  if (user) {
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
        backgroundImage: `url('/login_bg.png')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          padding: "2.5rem",
          background: "rgba(255, 255, 255, 0.7)",
          backdropFilter: "blur(20px)",
          borderRadius: 16,
          border: "1px solid rgba(255, 255, 255, 0.4)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
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
            fontSize: "1.75rem",
            fontWeight: 700,
            color: "var(--foreground, #1A1D23)",
            textAlign: "center",
            marginBottom: "1.5rem",
            letterSpacing: "-0.02em",
          }}
        >
          {isRegister ? "注册账号" : "登录"}
        </h1>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.875rem",
                color: "#4B5563",
                marginBottom: "0.5rem",
                fontWeight: 500,
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
                padding: "0.875rem 1rem",
                borderRadius: 10,
                border: "1px solid rgba(209, 213, 219, 0.6)",
                background: "rgba(255, 255, 255, 0.85)",
                color: "var(--foreground, #1A1D23)",
                fontSize: "0.9375rem",
                outline: "none",
                transition: "all 0.3s ease",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#667eea"
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(102, 126, 234, 0.1)"
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(209, 213, 219, 0.6)"
                e.currentTarget.style.boxShadow = "none"
              }}
            />
          </div>

          {isRegister && (
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.875rem",
                  color: "#4B5563",
                  marginBottom: "0.5rem",
                  fontWeight: 500,
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
                  padding: "0.875rem 1rem",
                  borderRadius: 10,
                  border: "1px solid rgba(209, 213, 219, 0.6)",
                  background: "rgba(255, 255, 255, 0.85)",
                  color: "var(--foreground, #1A1D23)",
                  fontSize: "0.9375rem",
                  outline: "none",
                  transition: "all 0.3s ease",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#667eea"
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(102, 126, 234, 0.1)"
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "rgba(209, 213, 219, 0.6)"
                  e.currentTarget.style.boxShadow = "none"
                }}
              />
            </div>
          )}

          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.875rem",
                color: "#4B5563",
                marginBottom: "0.5rem",
                fontWeight: 500,
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
                padding: "0.875rem 1rem",
                borderRadius: 10,
                border: "1px solid rgba(209, 213, 219, 0.6)",
                background: "rgba(255, 255, 255, 0.85)",
                color: "var(--foreground, #1A1D23)",
                fontSize: "0.9375rem",
                outline: "none",
                transition: "all 0.3s ease",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#667eea"
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(102, 126, 234, 0.1)"
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(209, 213, 219, 0.6)"
                e.currentTarget.style.boxShadow = "none"
              }}
            />
          </div>

          {error && (
            <div
              style={{
                padding: "0.75rem 1rem",
                borderRadius: 8,
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                color: "#DC2626",
                fontSize: "0.8125rem",
                margin: 0,
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              marginTop: "0.5rem",
              padding: "0.75rem 1.5rem",
              fontSize: "0.9375rem",
              fontWeight: 600,
              color: "#FFFFFF",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              border: "none",
              borderRadius: 10,
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)",
              transition: "all 0.3s ease",
              minHeight: "44px",
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(102, 126, 234, 0.5)"
                e.currentTarget.style.transform = "translateY(-2px)"
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.boxShadow = "0 4px 15px rgba(102, 126, 234, 0.4)"
                e.currentTarget.style.transform = "translateY(0)"
              }
            }}
          >
            {loading ? "请稍候..." : isRegister ? "注册" : "登录"}
          </button>

          {/* <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister)
              setError("")
            }}
            style={{
              background: "none",
              border: "none",
              color: "#667eea",
              fontSize: "0.875rem",
              cursor: "pointer",
              textAlign: "center",
              fontWeight: 500,
              transition: "all 0.3s ease",
              padding: "0.5rem",
              borderRadius: 8,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#764ba2"
              e.currentTarget.style.background = "rgba(102, 126, 234, 0.1)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#667eea"
              e.currentTarget.style.background = "none"
            }}
          >
            {isRegister ? "已有账号？去登录" : "没有账号？去注册"}
          </button> */}
        </form>
      </div>
    </div>
  )
}