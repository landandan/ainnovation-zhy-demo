"""Flask 配置模块"""
import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))


class Config:
    """基础配置"""
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", f"sqlite:///{os.path.join(BASE_DIR, '..', 'data', 'cnooc.db')}")

    # JWT 配置
    JWT_EXPIRATION_HOURS = int(os.getenv("JWT_EXPIRATION_HOURS", "72"))
    JWT_ALGORITHM = "HS256"

    # 鉴权提供者: "local" | "dify" (预留)
    AUTH_PROVIDER = os.getenv("AUTH_PROVIDER", "local")

    # Dify Console 配置（预留，后续对接 Dify 用户体系）
    DIFY_CONSOLE_URL = os.getenv("DIFY_CONSOLE_URL", "")
    DIFY_ADMIN_API_KEY = os.getenv("DIFY_ADMIN_API_KEY", "")