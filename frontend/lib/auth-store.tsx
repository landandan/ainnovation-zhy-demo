"use client"
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import {
  login as apiLogin,
  register as apiRegister,
  getMe,
  getToken,
  setToken,
  removeToken,
  isAuthenticated as checkAuth,
  type LoginRequest,
  type RegisterRequest,
  type UserInfo,
} from "./api-client"
import { isMockMode, getMockToken, getMockUser, clearMockData } from "./mock-config"

interface AuthContextType {
  user: UserInfo | null
  loading: boolean
  initialized: boolean
  login: (data: LoginRequest) => Promise<UserInfo>
  register: (data: RegisterRequest) => Promise<UserInfo>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // 首次加载时验证 token
  useEffect(() => {
    // Mock 模式：自动注入 mock 用户，跳过后端验证
    if (isMockMode()) {
      setToken(getMockToken())
      setUser(getMockUser())
      setInitialized(true)
      return
    }

    if (checkAuth()) {
      getMe()
        .then((res) => setUser(res.user))
        .catch(() => {
          removeToken()
          setUser(null)
        })
        .finally(() => setInitialized(true))
    } else {
      setInitialized(true)
    }
  }, [])

  const login = useCallback(async (data: LoginRequest): Promise<UserInfo> => {
    setLoading(true)
    try {
      const res = await apiLogin(data)
      setToken(res.token)
      setUser(res.user)
      // 正常登录（非 mock 模式）后清除 mock 残留数据
      if (!isMockMode()) {
        clearMockData()
      }
      return res.user
    } finally {
      setLoading(false)
    }
  }, [])

  const register = useCallback(async (data: RegisterRequest): Promise<UserInfo> => {
    setLoading(true)
    try {
      const res = await apiRegister(data)
      setToken(res.token)
      setUser(res.user)
      // 正常注册（非 mock 模式）后清除 mock 残留数据
      if (!isMockMode()) {
        clearMockData()
      }
      return res.user
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    removeToken()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, initialized, login, register, logout }}>
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