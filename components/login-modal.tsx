"use client"

import { forwardRef, useImperativeHandle, useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-store"
import Modal from "@/components/ui/Modal"
import { AUTH_REQUIRED_EVENT, resetAuthRequiredGate } from "@/lib/http/client"

export interface LoginModalRef {
    open: (title?: string) => void;
    close: () => void;
}

export default forwardRef<LoginModalRef>((_, ref) => {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { login, register, loading, user } = useAuth()

    const [isRegister, setIsRegister] = useState(false)
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [displayName, setDisplayName] = useState("")
    const [error, setError] = useState("")
    const [modalOpen, setModalOpen] = useState(false)

    useImperativeHandle(ref, () => ({
        open() {
            setModalOpen(true)
        },
        close() {
            setModalOpen(false)
        },
    }))

    useEffect(() => {
        const onAuthRequired = () => setModalOpen(true)
        window.addEventListener(AUTH_REQUIRED_EVENT, onAuthRequired)
        return () => window.removeEventListener(AUTH_REQUIRED_EVENT, onAuthRequired)
    }, [])

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
            resetAuthRequiredGate()
            router.replace("/")
            setModalOpen(false)
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "操作失败"
            setError(msg)
        }
    }

    return (
        <Modal
            title={isRegister ? "注册账号" : "登录"}
            footer={null}
            open={modalOpen}
            onOk={() => setModalOpen(false)}
            onCancel={() => setModalOpen(false)}
        >
            <div
                style={{
                    width: "100%",
                    padding: "2.5rem",
                    background: "var(--card)",
                }}
            >
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                    <div>
                        <label
                            style={{
                                display: "block",
                                fontSize: "0.875rem",
                                color: "var(--muted-foreground)",
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
                                border: "1px solid var(--border)",
                                background: "var(--input)",
                                color: "var(--foreground)",
                                fontSize: "0.9375rem",
                                outline: "none",
                                transition: "all 0.3s ease",
                            }}
                            onFocus={(e) => {
                                e.currentTarget.style.borderColor = "var(--ring)"
                                e.currentTarget.style.boxShadow = "0 0 0 3px var(--glow)"
                            }}
                            onBlur={(e) => {
                                e.currentTarget.style.borderColor = "var(--border)"
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
                                    color: "var(--muted-foreground)",
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
                                    border: "1px solid var(--border)",
                                    background: "var(--input)",
                                    color: "var(--foreground)",
                                    fontSize: "0.9375rem",
                                    outline: "none",
                                    transition: "all 0.3s ease",
                                }}
                                onFocus={(e) => {
                                    e.currentTarget.style.borderColor = "var(--ring)"
                                    e.currentTarget.style.boxShadow = "0 0 0 3px var(--glow)"
                                }}
                                onBlur={(e) => {
                                    e.currentTarget.style.borderColor = "var(--border)"
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
                                color: "var(--muted-foreground)",
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
                                border: "1px solid var(--border)",
                                background: "var(--input)",
                                color: "var(--foreground)",
                                fontSize: "0.9375rem",
                                outline: "none",
                                transition: "all 0.3s ease",
                            }}
                            onFocus={(e) => {
                                e.currentTarget.style.borderColor = "var(--ring)"
                                e.currentTarget.style.boxShadow = "0 0 0 3px var(--glow)"
                            }}
                            onBlur={(e) => {
                                e.currentTarget.style.borderColor = "var(--border)"
                                e.currentTarget.style.boxShadow = "none"
                            }}
                        />
                    </div>

                    {error && (
                        <div
                            style={{
                                padding: "0.75rem 1rem",
                                borderRadius: 8,
                                background: "color-mix(in srgb, var(--destructive) 10%, transparent)",
                                border: "1px solid color-mix(in srgb, var(--destructive) 20%, transparent)",
                                color: "var(--destructive)",
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
                            background: "var(--gradient-1)",
                            border: "none",
                            borderRadius: 10,
                            cursor: loading ? "not-allowed" : "pointer",
                            boxShadow: "0 4px 15px var(--glow-strong)",
                            transition: "all 0.3s ease",
                            minHeight: "44px",
                        }}
                        onMouseEnter={(e) => {
                            if (!loading) {
                                e.currentTarget.style.boxShadow = "0 6px 20px var(--glow-strong)"
                                e.currentTarget.style.transform = "translateY(-2px)"
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!loading) {
                                e.currentTarget.style.boxShadow = "0 4px 15px var(--glow-strong)"
                                e.currentTarget.style.transform = "translateY(0)"
                            }
                        }}
                    >
                        {loading ? "请稍候..." : isRegister ? "注册" : "登录"}
                    </button>
                </form>
            </div>
        </Modal>
    )
})
