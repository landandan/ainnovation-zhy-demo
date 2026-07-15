const TOKEN_KEY = "cnooc-auth-token"
const USER_KEY = "cnooc-auth-user"
const CLIENT_ID_KEY = "cnooc-auth-client-id"

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token || token === "undefined" || token === "null") return null
  return token
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return
  if (!token) return
  localStorage.setItem(TOKEN_KEY, token)
}

export function removeToken(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(CLIENT_ID_KEY)
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

export function getCachedUser<T = unknown>(): T | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function setCachedUser(user: unknown): void {
  if (typeof window === "undefined") return
  if (!user) return
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function getClientId(): string | null {
  if (typeof window === "undefined") return null
  const clientId = localStorage.getItem(CLIENT_ID_KEY)
  if (!clientId || clientId === "undefined" || clientId === "null") return null
  return clientId
}

export function setClientId(clientId: string): void {
  if (typeof window === "undefined") return
  if (!clientId) return
  localStorage.setItem(CLIENT_ID_KEY, clientId)
}
