import { getToken, removeToken } from "@/lib/auth/token"
import { API_BASE_URL } from "./routes"

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

let authRedirectInProgress = false

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
    const errData = await res.json().catch(() => ({ error: res.statusText }))
    if (res.status === 401 || res.status === 403) {
      removeToken()
      if (typeof window !== "undefined" && !authRedirectInProgress) {
        authRedirectInProgress = true
        // setTimeout(() => {
        //   window.location.href = "/login"
        // }, 100)
      }
    }
    if (!options.suppressErrors) {
      throw new ApiError(errData.error || "请求失败", res.status, errData)
    }
    return null as T
  }

  return res.json() as Promise<T>
}

