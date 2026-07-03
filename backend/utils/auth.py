"""JWT 认证工具 & 装饰器"""
import time
import functools
import logging
import jwt
import bcrypt
from flask import request, g, current_app, jsonify

logger = logging.getLogger(__name__)


def hash_password(plain: str) -> str:
    """加密明文密码"""
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """验证明文密码与哈希"""
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_token(user_id: int, username: str, roles: list = None) -> str:
    """签发 JWT"""
    cfg = current_app.config
    payload = {
        "sub": user_id,
        "username": username,
        "roles": roles or [],
        "iat": int(time.time()),
        "exp": int(time.time()) + cfg["JWT_EXPIRATION_HOURS"] * 3600,
    }
    return jwt.encode(payload, cfg["SECRET_KEY"], algorithm=cfg["JWT_ALGORITHM"])


def verify_token(token: str) -> dict:
    """验证 JWT 并返回 payload；失败抛 jwt 异常"""
    cfg = current_app.config
    logger.debug("JWT 验证: token 前10字符=%s, algorithm=%s", token[:10] if len(token) > 10 else token, cfg.get("JWT_ALGORITHM", "N/A"))
    try:
        payload = jwt.decode(token, cfg["SECRET_KEY"], algorithms=[cfg["JWT_ALGORITHM"]])
        logger.debug("JWT 验证成功: user_id=%s, username=%s", payload.get("sub"), payload.get("username"))
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("JWT 已过期: token 签发时间可能是 %s", "未知")
        raise
    except jwt.InvalidTokenError as e:
        logger.warning("JWT 无效: %s, token 前20字符=%s", str(e), token[:20] if len(token) > 20 else token)
        raise


# ---------- 装饰器 ----------

def login_required(f):
    """要求请求携带有效的 Bearer Token，并将用户信息注入 g.current_user"""

    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "缺少认证令牌"}), 401

        token = auth_header.split(" ", 1)[1]
        try:
            payload = verify_token(token)
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "令牌已过期，请重新登录"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "无效的认证令牌"}), 401

        from models.user import User
        user = User.query.get(payload["sub"])
        if not user or not user.is_active:
            return jsonify({"error": "用户不存在或已被禁用"}), 401

        g.current_user = user
        g.current_user_roles = payload.get("roles", [])
        return f(*args, **kwargs)

    return wrapper


def admin_required(f):
    """要求当前用户拥有 admin 角色"""
    @functools.wraps(f)
    @login_required
    def wrapper(*args, **kwargs):
        if "admin" not in g.current_user_roles:
            return jsonify({"error": "需要管理员权限"}), 403
        return f(*args, **kwargs)

    return wrapper