export const API_BASE_URL = process.env.NODE_ENV === "development"
  ? "http://192.168.10.15:26039"
  : "/api"

export const DIFY_FILE_UPLOAD_BASE_URL = process.env.NODE_ENV === "development"
  ? "http://localhost:5000/api"
  : "/api"

export const DIFY_STOP_PROXY_BASE_URL = "/api"

