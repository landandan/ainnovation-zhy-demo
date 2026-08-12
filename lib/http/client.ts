import { getToken, getClientId, removeToken, isGuestUser } from "@/lib/auth/token"
import { API_BASE_URL } from "./routes"
import notification from "@/components/ui/Notification"

const DEFAULT_CLIENT_ID = "0d4c873ff6146ecd7f38e2e45526ab1b"

/** 非游客登录过期时打开登录弹窗 */
export const AUTH_REQUIRED_EVENT = "app-auth-required"
let authRequiredNotified = false

export function resetAuthRequiredGate(): void {
  authRequiredNotified = false
}

/**
 * 登录过期处理（须先判断游客，再 removeToken）：
 * - 游客：只刷新页面，不弹登录框
 * - 非游客：提示 + 打开登录弹窗
 */
export function handleAuthExpired(message?: string): void {
  const wasGuest = isGuestUser()
  removeToken()
  if (typeof window === "undefined") return

  if (wasGuest) {
    window.location.reload()
    return
  }

  notification.open({
    title: "登录过期",
    description: message || "请重新登录",
    duration: 3000,
  })
  if (authRequiredNotified) return
  authRequiredNotified = true
  window.dispatchEvent(new CustomEvent(AUTH_REQUIRED_EVENT))
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: { suppressErrors?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  const token = getToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  headers.clientid = getClientId() || DEFAULT_CLIENT_ID

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch (err: unknown) {
    clearTimeout(timeoutId)
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError("请求超时（15秒），请检查网络或后端服务是否正常", 408)
    }
    throw new ApiError(err instanceof Error ? err.message : "网络请求失败", 0)
  }
  clearTimeout(timeoutId)

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: res.statusText })) as Record<string, unknown>
    if (res.status === 401 || res.status === 403) {
      handleAuthExpired(typeof errData.msg === "string" ? errData.msg : undefined)
    }
    if (!options.suppressErrors) {
      const serverMsg = [errData.msg, errData.message, errData.localMessage, errData.error]
        .find((v) => typeof v === "string" && String(v).trim())
      throw new ApiError(
        typeof serverMsg === "string" ? String(serverMsg).trim() : "请求失败",
        res.status,
        errData,
      )
    }
    return null as T
  }

  const data = await res.json()
  if (data.code === 401 || data.code === "401") {
    handleAuthExpired(typeof data.msg === "string" ? data.msg : undefined)
    return null as T
  }
  return data
}
