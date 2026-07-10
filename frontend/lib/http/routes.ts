export const API_BASE_URL = process.env.NODE_ENV === "development"
  ? "http://192.168.11.95:6039"
  : "/api"

export const DIFY_FILE_UPLOAD_BASE_URL = process.env.NODE_ENV === "development"
  ? "http://localhost:5000/api"
  : "/api"

export const DIFY_STOP_PROXY_BASE_URL = "/api"

