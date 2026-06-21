"""认证相关 API"""
from flask import Blueprint, request, jsonify, g, current_app
from models import db
from models.user import User
from models.role import Role, UserRole
from utils.auth import hash_password, verify_password, create_token, login_required

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/auth/login", methods=["POST"])
def login():
    """
    用户登录
    ---
    tags:
      - Auth
    summary: 用户登录
    description: 使用用户名和密码登录，返回 JWT Token 和用户信息
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required: [username, password]
          properties:
            username:
              type: string
              description: 用户名
              example: admin
            password:
              type: string
              description: 密码
              example: admin123
    responses:
      200:
        description: 登录成功
        schema:
          type: object
          properties:
            token:
              type: string
              description: JWT Token
            user:
              type: object
              description: 用户信息
        examples:
          application/json: |
            {
              "token": "eyJhbGciOiJIUzI1NiIs...",
              "user": {
                "id": 1,
                "username": "admin",
                "display_name": "管理员",
                "email": "admin@cnooc.com",
                "roles": ["admin"],
                "is_active": true
              }
            }
      400:
        description: 请求参数不完整
      401:
        description: 用户名或密码错误
      403:
        description: 账号已被禁用
    """
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "用户名和密码不能为空"}), 400

    user = User.query.filter_by(username=username).first()
    if not user or not verify_password(password, user.password_hash):
        return jsonify({"error": "用户名或密码错误"}), 401

    if not user.is_active:
        return jsonify({"error": "账号已被禁用"}), 403

    # 获取用户角色
    ur_records = UserRole.query.filter_by(user_id=user.id).all()
    role_ids = [r.role_id for r in ur_records]
    roles = Role.query.filter(Role.id.in_(role_ids)).all() if role_ids else []
    role_names = [r.name for r in roles]

    token = create_token(user.id, user.username, role_names)

    return jsonify({
        "token": token,
        "user": user.to_dict(include_roles=True),
    })


@auth_bp.route("/auth/register", methods=["POST"])
def register():
    """
    注册新用户
    ---
    tags:
      - Auth
    summary: 注册新用户
    description: 注册一个新用户，默认分配 'user' 角色，注册成功后自动登录返回 JWT
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required: [username, password]
          properties:
            username:
              type: string
              description: 用户名（至少 3 个字符）
              example: testuser
            password:
              type: string
              description: 密码（至少 6 个字符）
              example: pass123456
            email:
              type: string
              description: 电子邮箱
              example: test@cnooc.com
            display_name:
              type: string
              description: 显示名称
              example: 测试用户
    responses:
      201:
        description: 注册成功，返回 JWT 和用户信息
        schema:
          type: object
          properties:
            token:
              type: string
            user:
              type: object
      400:
        description: 请求参数不完整或不合法
      409:
        description: 用户名已存在
    """
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")
    email = data.get("email", "").strip()
    display_name = data.get("display_name", "").strip() or username

    if not username or not password:
        return jsonify({"error": "用户名和密码不能为空"}), 400

    if len(username) < 3:
        return jsonify({"error": "用户名至少 3 个字符"}), 400

    if len(password) < 6:
        return jsonify({"error": "密码至少 6 个字符"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"error": "用户名已存在"}), 409

    user = User(
        username=username,
        password_hash=hash_password(password),
        email=email,
        display_name=display_name,
    )
    db.session.add(user)
    db.session.flush()  # 获得 user.id

    # 自动分配 "user" 角色
    default_role = Role.query.filter_by(name="user").first()
    if default_role:
        ur = UserRole(user_id=user.id, role_id=default_role.id)
        db.session.add(ur)

    db.session.commit()

    token = create_token(user.id, user.username, ["user"])

    return jsonify({
        "token": token,
        "user": user.to_dict(include_roles=True),
    }), 201


@auth_bp.route("/auth/me", methods=["GET"])
@login_required
def me():
    """
    获取当前登录用户信息
    ---
    tags:
      - Auth
    summary: 获取当前用户信息
    description: 返回当前登录用户的完整信息，需要 Bearer Token
    security:
      - Bearer: []
    responses:
      200:
        description: 当前用户信息
        schema:
          type: object
          properties:
            user:
              type: object
      401:
        description: 未认证或 Token 无效
    """
    return jsonify({"user": g.current_user.to_dict(include_roles=True)})