"use client"
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import {
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  getMe,
  type LoginRequest,
  type RegisterRequest,
  type UserInfo, guestLoginFunc,
} from "../api-client"
import {getCachedUser, setCachedUser, setClientId, setToken, isAuthenticated as checkAuth, removeToken} from "./token"
import { isMockMode, getMockToken, getMockUser, clearMockData, disableMockMode } from "../mock/config"

interface AuthContextType {
  user: UserInfo | null
  loading: boolean
  initialized: boolean
  login: (data: LoginRequest) => Promise<UserInfo>
  register: (data: RegisterRequest) => Promise<UserInfo>
  logout: () => void
  enableMockLogin: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function isLoginSuccess(code: unknown): boolean {
  return code === undefined || code === null || code === 200 || code === "200"
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // 首次加载时恢复会话
  useEffect(() => {
    // Mock 模式：自动注入 mock 用户，跳过后端验证
    if (isMockMode()) {
      setToken(getMockToken())
      setUser(getMockUser())
      setInitialized(true)
      return
    }

    if (!checkAuth()) {
      setInitialized(true)
      return
    }

    const cached = getCachedUser<UserInfo>()
    // 先恢复本地缓存，避免刷新闪退登录页
    if (cached) {
      setUser(cached)
    }

    // getMe()
    //   .then((res) => {
    //     setUser(res.user)
    //     setCachedUser(res.user)
    //   })
    //   .catch((err) => {
    //     // 仅 token 明确失效时清登录态；网络/接口不存在时保留本地会话
    //     const status = err instanceof ApiError ? err.status : 0
    //     if (status === 401 || status === 403) {
    //       removeToken()
    //       setUser(null)
    //     } else if (!cached) {
    //       removeToken()
    //       setUser(null)
    //     }
    //   })
    //   .finally(() => setInitialized(true))
    setInitialized(true)
  }, [])

  const guestLogin = useCallback(async (): Promise<UserInfo> => {
    setLoading(true)
    try {
      const nextUser = await guestLoginFunc()
      setUser(nextUser)
    } finally {
      setLoading(false)
    }
  }, [])

  const login = useCallback(async (data: LoginRequest): Promise<UserInfo> => {
    setLoading(true)
    try {
      const res = await apiLogin(data)
      console.log("res123:", res)

      const accessToken = res?.data?.access_token || res?.data?.token
      const nextUser = res?.data?.user

      if (accessToken && nextUser && isLoginSuccess(res?.code)) {
        setToken(accessToken)
        setCachedUser(nextUser)
        if (res?.data?.client_id) {
          setClientId(res.data.client_id)
        }
        setUser(nextUser)
        if (!isMockMode()) {
          clearMockData()
        }
        return nextUser
      }

      throw new Error((res as { msg?: string })?.msg || "登录失败，请检查账号密码")
    } finally {
      setLoading(false)
    }
  }, [])

  const register = useCallback(async (data: RegisterRequest): Promise<UserInfo> => {
    setLoading(true)
    try {
      const res = await apiRegister(data)
      setToken(res.token)
      setCachedUser(res.user)
      setUser(res.user)
      if (!isMockMode()) {
        clearMockData()
      }
      return res.user
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    const wasMockMode = isMockMode()
    // 先调退出接口（此时 header 仍带 Authorization + clientid），再清本地登录态
    try {
      const res = await apiLogout()
      console.log("logout123:", res)
    } catch (err) {
      console.warn("退出登录接口失败:", err)
    }
    removeToken()
    setUser(null)
    if (wasMockMode) {
      disableMockMode()
    }
    // const target = wasMockMode ? "/login?mock=true" : "/login"
    // window.location.href =
    await guestLogin()
  }, [])

  const enableMockLogin = useCallback(async () => {
    // 使用游客登录
    await guestLogin()
  }, [login])

  return (
    <AuthContext.Provider value={{ user, loading, initialized, login, register, logout, enableMockLogin }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return ctx
}
