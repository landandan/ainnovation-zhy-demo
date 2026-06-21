"""用户设置 API（每用户 Dify 全局配置、主题偏好等）"""
from flask import Blueprint, request, jsonify, g
from models import db
from utils.auth import login_required

settings_bp = Blueprint("settings", __name__)

# 简化设计：用一张 user_settings JSON 表存储用户全局设置
# 如果后续字段增多，可拆分为独立模型；当前保持轻量


class UserSettings(db.Model):
    __tablename__ = "user_settings"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"),
                        unique=True, nullable=False)
    # JSON 字段：存储主题、Dify 全局配置、语言等
    # 结构示例：
    # {
    #   "theme": "light" | "dark",
    #   "language": "zh-CN",
    #   "dify_global_base_url": "http://...",
    #   "dify_global_api_key": "app-xxxx"
    # }
    data = db.Column(db.Text, default="{}")

    user = db.relationship("User", backref=db.backref("settings", uselist=False))


def _get_user_settings(user_id: int) -> dict:
    """获取用户设置（不存在则返回空字典）"""
    import json
    s = UserSettings.query.filter_by(user_id=user_id).first()
    if s:
        try:
            return json.loads(s.data)
        except Exception:
            return {}
    return {}


def _save_user_settings(user_id: int, data: dict):
    """保存用户设置"""
    import json
    s = UserSettings.query.filter_by(user_id=user_id).first()
    if not s:
        s = UserSettings(user_id=user_id, data="{}")
        db.session.add(s)
    s.data = json.dumps(data, ensure_ascii=False)
    db.session.commit()


@settings_bp.route("/settings", methods=["GET"])
@login_required
def get_settings():
    """
    获取用户设置
    ---
    tags:
      - Settings
    summary: 获取当前用户的所有设置项
    description: 返回包含主题、语言、Dify 全局配置等的 JSON 对象
    security:
      - Bearer: []
    responses:
      200:
        description: 用户设置
        schema:
          type: object
          properties:
            settings:
              type: object
              description: 用户设置 JSON 对象
              example:
                theme: light
                language: zh-CN
                dify_global:
                  base_url: http://localhost
                  api_key: "app-****"
    """
    return jsonify({"settings": _get_user_settings(g.current_user.id)})


@settings_bp.route("/settings", methods=["PUT"])
@login_required
def update_settings():
    """
    更新用户设置
    ---
    tags:
      - Settings
    summary: 全量更新用户设置
    description: 传入完整 JSON 覆盖当前用户的设置
    security:
      - Bearer: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          description: 完整设置对象
          example:
            theme: dark
            language: zh-CN
            dify_global:
              base_url: http://localhost
              api_key: app-xxxxxxxxxxxxxxxx
    responses:
      200:
        description: 更新成功
    """
    data = request.get_json(silent=True) or {}
    _save_user_settings(g.current_user.id, data)
    return jsonify({"settings": data})


@settings_bp.route("/settings/dify", methods=["GET"])
@login_required
def get_dify_settings():
    """
    获取 Dify 全局配置
    ---
    tags:
      - Settings
    summary: 获取用户 Dify 全局配置
    description: 返回 base_url 和脱敏后的 api_key
    security:
      - Bearer: []
    responses:
      200:
        description: Dify 配置（API Key 已脱敏）
        schema:
          type: object
          properties:
            dify:
              type: object
              properties:
                base_url:
                  type: string
                  description: Dify 服务地址
                api_key:
                  type: string
                  description: 已脱敏的 API Key（前8位 + ****）
    """
    settings = _get_user_settings(g.current_user.id)
    dify = settings.get("dify_global", {})
    # 隐藏 api_key
    if "api_key" in dify and dify["api_key"]:
        dify["api_key"] = dify["api_key"][:8] + "****"
    return jsonify({"dify": dify})


@settings_bp.route("/settings/dify", methods=["PUT"])
@login_required
def update_dify_settings():
    """
    更新 Dify 全局配置
    ---
    tags:
      - Settings
    summary: 更新用户 Dify 全局配置
    description: 增量更新 Dify 全局配置（base_url, api_key 等），返回时 api_key 脱敏
    security:
      - Bearer: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            base_url:
              type: string
              description: Dify 服务地址
            api_key:
              type: string
              description: Dify API Key
          example:
            base_url: http://localhost
            api_key: app-xxxxxxxxxxxxxxxx
    responses:
      200:
        description: 更新成功，返回脱敏配置
    """
    data = request.get_json(silent=True) or {}
    settings = _get_user_settings(g.current_user.id)
    current_dify = settings.get("dify_global", {})
    current_dify.update(data)
    settings["dify_global"] = current_dify
    _save_user_settings(g.current_user.id, settings)
    # 返回时隐藏 key
    resp = dict(current_dify)
    if "api_key" in resp and resp["api_key"]:
        resp["api_key"] = resp["api_key"][:8] + "****"
    return jsonify({"dify": resp})