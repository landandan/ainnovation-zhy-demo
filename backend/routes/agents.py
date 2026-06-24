"""Agent 应用 CRUD API"""
import requests
from flask import Blueprint, request, jsonify, g
from models import db
from models.agent import AgentDef, DifyConfig
from models.role import RoleAgent
from utils.auth import login_required, admin_required

agents_bp = Blueprint("agents", __name__)


def _get_visible_agent_ids(user_id: int) -> list:
    """查询用户可见的 Agent ID 列表（基于角色）"""
    from models.role import UserRole
    user_role_records = UserRole.query.filter_by(user_id=user_id).all()
    if not user_role_records:
        return []

    role_ids = [r.role_id for r in user_role_records]
    role_agent_records = RoleAgent.query.filter(RoleAgent.role_id.in_(role_ids)).all()
    if not role_agent_records:
        return []

    return list({ra.agent_id for ra in role_agent_records})


@agents_bp.route("/agents", methods=["GET"])
@login_required
def list_agents():
    """
    获取智能体列表
    ---
    tags:
      - Agents
    summary: 获取当前用户可见的智能体列表
    description: |
      管理员返回所有智能体（含 Dify 配置），普通用户仅返回其角色被授权访问的智能体。
    security:
      - Bearer: []
    responses:
      200:
        description: 智能体列表
        schema:
          type: object
          properties:
            agents:
              type: array
              items:
                type: object
                properties:
                  id: {type: integer}
                  agent_id: {type: string, description: 智能体唯一标识}
                  label: {type: string, description: 显示名称}
                  icon: {type: string, description: 图标emoji}
                  desc: {type: string, description: 描述}
                  gradient: {type: string, description: 渐变CSS}
                  sort_order: {type: integer}
                  is_active: {type: boolean}
                  dify_configs:
                    type: array
                    items: {type: object}
      401:
        description: 未认证
    """
    is_admin = "admin" in g.current_user_roles

    if is_admin:
        agents = AgentDef.query.order_by(AgentDef.sort_order.asc()).all()
    else:
        visible_ids = _get_visible_agent_ids(g.current_user.id)
        agents = AgentDef.query.filter(AgentDef.id.in_(visible_ids)).order_by(AgentDef.sort_order.asc()).all() if visible_ids else []

    result = []
    for agent in agents:
        d = agent.to_dict()
        # 脱敏：dify_configs 中的 api_key 不暴露明文
        d["dify_configs"] = [c.to_dict(hide_key=True) for c in agent.dify_configs.all()]
        result.append(d)

    return jsonify({"agents": result})


@agents_bp.route("/agents/<int:agent_id>", methods=["GET"])
@login_required
def get_agent(agent_id):
    """
    获取智能体详情
    ---
    tags:
      - Agents
    summary: 获取单个智能体详情
    description: 返回智能体完整信息（含 Dify 配置）。普通用户需要角色授权。
    security:
      - Bearer: []
    parameters:
      - name: agent_id
        in: path
        type: integer
        required: true
        description: 智能体 ID
    responses:
      200:
        description: 智能体详情
      403:
        description: 无权访问该智能体
      404:
        description: 智能体不存在
    """
    is_admin = "admin" in g.current_user_roles
    if not is_admin:
        visible_ids = _get_visible_agent_ids(g.current_user.id)
        if agent_id not in visible_ids:
            return jsonify({"error": "无权访问该应用"}), 403

    agent = AgentDef.query.get_or_404(agent_id)
    d = agent.to_dict()
    # 脱敏：dify_configs 中的 api_key 不暴露明文
    d["dify_configs"] = [c.to_dict(hide_key=True) for c in agent.dify_configs.all()]
    return jsonify({"agent": d})


@agents_bp.route("/agents", methods=["POST"])
@admin_required
def create_agent():
    """
    创建智能体
    ---
    tags:
      - Agents
    summary: 创建新的智能体应用（仅管理员）
    description: 创建一个新的智能体定义，可同时配置 Dify API Key
    security:
      - Bearer: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required: [agent_id, label]
          properties:
            agent_id:
              type: string
              description: 智能体唯一标识
              example: safety-query
            label:
              type: string
              description: 显示名称
            icon:
              type: string
              description: 图标 emoji
              example: "🤖"
            desc:
              type: string
              description: 智能体描述
            gradient:
              type: string
              description: 渐变 CSS 变量
            sort_order:
              type: integer
              description: 排序权重
            is_active:
              type: boolean
              description: 是否启用
            dify_config:
              type: object
              description: Dify 配置
              properties:
                env_label: {type: string}
                dify_api_key: {type: string}
                dify_base_url: {type: string}
    responses:
      201:
        description: 创建成功
      400:
        description: 参数不完整
      409:
        description: agent_id 已存在
    """
    data = request.get_json(silent=True) or {}
    agent_id = data.get("agent_id", "").strip()
    label = data.get("label", "").strip()

    if not agent_id or not label:
        return jsonify({"error": "agent_id 和 label 为必填项"}), 400

    if AgentDef.query.filter_by(agent_id=agent_id).first():
        return jsonify({"error": f"agent_id '{agent_id}' 已存在"}), 409

    agent = AgentDef(
        agent_id=agent_id,
        label=label,
        icon=data.get("icon", "🤖"),
        desc=data.get("desc", ""),
        gradient=data.get("gradient", "var(--gradient-1)"),
        sort_order=data.get("sort_order", 0),
        is_active=data.get("is_active", True),
    )
    db.session.add(agent)
    db.session.flush()

    dify_config = data.get("dify_config")
    if dify_config:
        dc = DifyConfig(
            agent_id=agent.id,
            env_label=dify_config.get("env_label", "default"),
            dify_api_key=dify_config.get("dify_api_key", ""),
            dify_base_url=dify_config.get("dify_base_url", ""),
            is_default=True,
        )
        db.session.add(dc)

    db.session.commit()
    return jsonify({"agent": agent.to_dict()}), 201


@agents_bp.route("/agents/<int:agent_id>", methods=["PUT"])
@admin_required
def update_agent(agent_id):
    """
    更新智能体
    ---
    tags:
      - Agents
    summary: 更新智能体信息（仅管理员）
    security:
      - Bearer: []
    parameters:
      - name: agent_id
        in: path
        type: integer
        required: true
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            label: {type: string}
            icon: {type: string}
            desc: {type: string}
            gradient: {type: string}
            sort_order: {type: integer}
            is_active: {type: boolean}
    responses:
      200:
        description: 更新成功
      404:
        description: 智能体不存在
    """
    agent = AgentDef.query.get_or_404(agent_id)
    data = request.get_json(silent=True) or {}

    for field in ["label", "icon", "desc", "gradient", "sort_order", "is_active"]:
        if field in data:
            setattr(agent, field, data[field])

    db.session.commit()
    return jsonify({"agent": agent.to_dict()})


@agents_bp.route("/agents/<int:agent_id>", methods=["DELETE"])
@admin_required
def delete_agent(agent_id):
    """
    删除智能体
    ---
    tags:
      - Agents
    summary: 删除智能体应用（仅管理员）
    security:
      - Bearer: []
    parameters:
      - name: agent_id
        in: path
        type: integer
        required: true
    responses:
      200:
        description: 删除成功
      404:
        description: 智能体不存在
    """
    agent = AgentDef.query.get_or_404(agent_id)
    db.session.delete(agent)
    db.session.commit()
    return jsonify({"message": "应用已删除"})


# ---------- Dify 配置子路由 ----------

@agents_bp.route("/agents/<int:agent_id>/dify-configs", methods=["GET"])
@login_required
def list_dify_configs(agent_id):
    """
    获取智能体的 Dify 配置列表
    ---
    tags:
      - Dify Configs
    summary: 获取智能体的所有 Dify 配置
    description: 返回指定智能体的所有 Dify 环境配置（含已脱敏的 API Key）
    security:
      - Bearer: []
    parameters:
      - name: agent_id
        in: path
        type: integer
        required: true
        description: 智能体 ID
    responses:
      200:
        description: Dify 配置列表
      404:
        description: 智能体不存在
    """
    agent = AgentDef.query.get_or_404(agent_id)
    configs = DifyConfig.query.filter_by(agent_id=agent_id).all()
    return jsonify({"dify_configs": [c.to_dict() for c in configs]})


@agents_bp.route("/agents/<int:agent_id>/dify-configs", methods=["POST"])
@admin_required
def add_dify_config(agent_id):
    """
    添加 Dify 配置
    ---
    tags:
      - Dify Configs
    summary: 为智能体添加 Dify API 配置（仅管理员）
    security:
      - Bearer: []
    parameters:
      - name: agent_id
        in: path
        type: integer
        required: true
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            env_label:
              type: string
              description: 环境标签（如 production / staging）
            dify_api_key:
              type: string
              description: Dify API Key
            dify_base_url:
              type: string
              description: Dify 服务地址
            is_default:
              type: boolean
              description: 是否为默认配置
    responses:
      201:
        description: 创建成功（API Key 已脱敏）
      404:
        description: 智能体不存在
    """
    AgentDef.query.get_or_404(agent_id)
    data = request.get_json(silent=True) or {}

    dc = DifyConfig(
        agent_id=agent_id,
        env_label=data.get("env_label", "default"),
        dify_api_key=data.get("dify_api_key", ""),
        dify_base_url=data.get("dify_base_url", ""),
        is_default=data.get("is_default", False),
    )
    db.session.add(dc)
    db.session.commit()
    return jsonify({"dify_config": dc.to_dict(hide_key=True)}), 201


@agents_bp.route("/agents/dify-configs/<int:config_id>", methods=["PUT"])
@admin_required
def update_dify_config(config_id):
    """
    更新 Dify 配置
    ---
    tags:
      - Dify Configs
    summary: 更新 Dify API 配置（仅管理员）
    security:
      - Bearer: []
    parameters:
      - name: config_id
        in: path
        type: integer
        required: true
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            env_label: {type: string}
            dify_api_key: {type: string}
            dify_base_url: {type: string}
            is_default: {type: boolean}
    responses:
      200:
        description: 更新成功
      404:
        description: 配置不存在
    """
    dc = DifyConfig.query.get_or_404(config_id)
    data = request.get_json(silent=True) or {}

    for field in ["env_label", "dify_api_key", "dify_base_url", "is_default"]:
        if field in data:
            value = data[field]
            # 防止前端传入脱敏值覆盖真实 API Key
            if field == "dify_api_key" and isinstance(value, str) and "****" in value:
                continue
            setattr(dc, field, value)

    db.session.commit()
    return jsonify({"dify_config": dc.to_dict(hide_key=True)})


@agents_bp.route("/agents/dify-configs/<int:config_id>", methods=["DELETE"])
@admin_required
def delete_dify_config(config_id):
    """
    删除 Dify 配置
    ---
    tags:
      - Dify Configs
    summary: 删除 Dify API 配置（仅管理员）
    security:
      - Bearer: []
    parameters:
      - name: config_id
        in: path
        type: integer
        required: true
    responses:
      200:
        description: 删除成功
      404:
        description: 配置不存在
    """
    dc = DifyConfig.query.get_or_404(config_id)
    db.session.delete(dc)
    db.session.commit()
    return jsonify({"message": "Dify 配置已删除"})


@agents_bp.route("/agents/dify-configs/test-connection", methods=["POST"])
@admin_required
def test_dify_connection():
    """
    测试 Dify API 连通性
    ---
    tags:
      - Dify Configs
    summary: 校验 Dify API Key + Base URL 是否可用（仅管理员）
    description: |
      后端使用传入的 API Key / Base URL 直接请求 Dify 的
      `/v1/parameters` 端点验证连通性，不读取数据库配置。
    security:
      - Bearer: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required: [dify_api_key]
          properties:
            dify_api_key:
              type: string
              description: 待校验的 Dify API Key
            dify_base_url:
              type: string
              description: Dify 服务地址（可选）
    responses:
      200:
        description: 校验结果
        schema:
          type: object
          properties:
            ok: {type: boolean}
            error: {type: string, description: 失败原因}
    """
    data = request.get_json(silent=True) or {}
    api_key = (data.get("dify_api_key") or "").strip()
    base_url = (data.get("dify_base_url") or "").strip()

    if not api_key:
        return jsonify({"ok": False, "error": "缺少 API Key"}), 200
    if "****" in api_key:
        return jsonify({"ok": False, "error": "请重新填写 API Key（当前为脱敏值）"}), 200

    # 规范化 base_url，自动补全 /v1
    if not base_url:
        base_url = "https://api.dify.ai/v1"
    else:
        base_url = base_url.rstrip("/")
        if not base_url.endswith("/v1"):
            if "/v1" in base_url:
                base_url = base_url[: base_url.index("/v1") + 3]
            else:
                base_url += "/v1"

    test_url = f"{base_url}/parameters"
    try:
        resp = requests.get(
            test_url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=15,
        )
        if resp.status_code == 200:
            return jsonify({"ok": True})

        # 解析 Dify 错误信息
        try:
            err_data = resp.json()
            err_msg = err_data.get("message") or err_data.get("error") or f"HTTP {resp.status_code}"
        except Exception:
            err_msg = resp.text[:200] if resp.text else f"HTTP {resp.status_code}"
        return jsonify({"ok": False, "error": err_msg}), 200

    except requests.exceptions.Timeout:
        return jsonify({"ok": False, "error": "请求 Dify 超时"}), 200
    except requests.exceptions.RequestException as e:
        return jsonify({"ok": False, "error": f"连接失败: {str(e)}"}), 200


