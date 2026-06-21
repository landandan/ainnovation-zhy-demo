"""对话 & 消息 API"""
from flask import Blueprint, request, jsonify, g
from models import db
from models.conversation import Conversation, Message
from models.agent import AgentDef
from utils.auth import login_required

conversations_bp = Blueprint("conversations", __name__)


@conversations_bp.route("/conversations", methods=["GET"])
@login_required
def list_conversations():
    """
    获取对话列表
    ---
    tags:
      - Conversations
    summary: 获取当前用户的对话列表
    description: 支持按 agent_id、是否标星过滤，分页返回
    security:
      - Bearer: []
    parameters:
      - name: agent_id
        in: query
        type: integer
        required: false
        description: 按智能体 ID 过滤
      - name: is_pinned
        in: query
        type: boolean
        required: false
        description: 是否只返回标星对话
      - name: page
        in: query
        type: integer
        required: false
        description: 页码，默认 1
      - name: per_page
        in: query
        type: integer
        required: false
        description: 每页条数，默认 20
    responses:
      200:
        description: 对话列表
        schema:
          type: object
          properties:
            conversations:
              type: array
              items:
                type: object
                properties:
                  id: {type: integer}
                  title: {type: string}
                  agent_id: {type: integer}
                  is_pinned: {type: boolean}
                  is_archived: {type: boolean}
                  last_message_at: {type: string}
                  created_at: {type: string}
            total: {type: integer}
            page: {type: integer}
            per_page: {type: integer}
            pages: {type: integer}
    """
    agent_id = request.args.get("agent_id", type=int)
    is_pinned = request.args.get("is_pinned", type=bool)
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)

    q = Conversation.query.filter_by(user_id=g.current_user.id, is_archived=False)
    if agent_id:
        q = q.filter_by(agent_id=agent_id)
    if is_pinned is not None:
        q = q.filter_by(is_pinned=is_pinned)

    pagination = q.order_by(
        db.desc(Conversation.last_message_at)
    ).paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "conversations": [c.to_dict() for c in pagination.items],
        "total": pagination.total,
        "page": pagination.page,
        "per_page": pagination.per_page,
        "pages": pagination.pages,
    })


@conversations_bp.route("/conversations", methods=["POST"])
@login_required
def create_conversation():
    """
    创建新对话
    ---
    tags:
      - Conversations
    summary: 创建新的对话
    description: 为用户创建一个新对话，关联到指定智能体
    security:
      - Bearer: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required: [agent_id]
          properties:
            agent_id:
              type: integer
              description: 智能体 ID
            title:
              type: string
              description: 对话标题，默认为"新对话"
            dify_conversation_id:
              type: string
              description: Dify 对话 ID（如已先调用 Dify 创建）
    responses:
      201:
        description: 创建成功
      400:
        description: 缺少 agent_id
      404:
        description: 智能体不存在
    """
    data = request.get_json(silent=True) or {}
    agent_id = data.get("agent_id")
    if not agent_id:
        return jsonify({"error": "agent_id 为必填项"}), 400

    # 验证 agent 存在
    AgentDef.query.get_or_404(agent_id)

    conv = Conversation(
        user_id=g.current_user.id,
        agent_id=agent_id,
        title=data.get("title", "新对话"),
        dify_conversation_id=data.get("dify_conversation_id", ""),
    )
    db.session.add(conv)
    db.session.commit()
    return jsonify({"conversation": conv.to_dict()}), 201


@conversations_bp.route("/conversations/<int:conv_id>", methods=["GET"])
@login_required
def get_conversation(conv_id):
    """
    获取对话详情
    ---
    tags:
      - Conversations
    summary: 获取对话详情（含最近消息）
    description: 返回对话完整信息，包含消息列表
    security:
      - Bearer: []
    parameters:
      - name: conv_id
        in: path
        type: integer
        required: true
        description: 对话 ID
    responses:
      200:
        description: 对话详情（含消息）
      403:
        description: 无权访问该对话
      404:
        description: 对话不存在
    """
    conv = Conversation.query.get_or_404(conv_id)
    if conv.user_id != g.current_user.id:
        return jsonify({"error": "无权访问该对话"}), 403

    return jsonify({"conversation": conv.to_dict(include_messages=True)})


@conversations_bp.route("/conversations/<int:conv_id>", methods=["PUT"])
@login_required
def update_conversation(conv_id):
    """
    更新对话
    ---
    tags:
      - Conversations
    summary: 更新对话信息（标星、归档、重命名等）
    security:
      - Bearer: []
    parameters:
      - name: conv_id
        in: path
        type: integer
        required: true
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            title: {type: string, description: 对话标题}
            is_pinned: {type: boolean, description: 是否标星}
            is_archived: {type: boolean, description: 是否归档}
            dify_conversation_id: {type: string, description: Dify 对话 ID}
    responses:
      200:
        description: 更新成功
      403:
        description: 无权访问
      404:
        description: 对话不存在
    """
    conv = Conversation.query.get_or_404(conv_id)
    if conv.user_id != g.current_user.id:
        return jsonify({"error": "无权访问该对话"}), 403

    data = request.get_json(silent=True) or {}
    for field in ["title", "is_pinned", "is_archived", "dify_conversation_id"]:
        if field in data:
            setattr(conv, field, data[field])

    db.session.commit()
    return jsonify({"conversation": conv.to_dict()})


@conversations_bp.route("/conversations/<int:conv_id>", methods=["DELETE"])
@login_required
def delete_conversation(conv_id):
    """
    删除对话
    ---
    tags:
      - Conversations
    summary: 删除对话及其所有消息
    security:
      - Bearer: []
    parameters:
      - name: conv_id
        in: path
        type: integer
        required: true
    responses:
      200:
        description: 删除成功
      403:
        description: 无权访问
      404:
        description: 对话不存在
    """
    conv = Conversation.query.get_or_404(conv_id)
    if conv.user_id != g.current_user.id:
        return jsonify({"error": "无权访问该对话"}), 403

    db.session.delete(conv)
    db.session.commit()
    return jsonify({"message": "对话已删除"})


# ---------- 消息 ----------

@conversations_bp.route("/conversations/<int:conv_id>/messages", methods=["GET"])
@login_required
def list_messages(conv_id):
    """
    获取对话消息列表
    ---
    tags:
      - Messages
    summary: 获取指定对话的消息列表（倒序分页）
    description: 按时间倒序返回消息，结果反转后正序排列，支持加载更早的消息
    security:
      - Bearer: []
    parameters:
      - name: conv_id
        in: path
        type: integer
        required: true
        description: 对话 ID
      - name: page
        in: query
        type: integer
        required: false
        description: 页码，默认 1
      - name: per_page
        in: query
        type: integer
        required: false
        description: 每页条数，默认 50
      - name: before_id
        in: query
        type: integer
        required: false
        description: 加载此 ID 之前的消息（加载更早）
    responses:
      200:
        description: 消息列表
        schema:
          type: object
          properties:
            messages:
              type: array
              items:
                type: object
                properties:
                  id: {type: integer}
                  role: {type: string, description: user / assistant / system}
                  content: {type: string}
                  attachments: {type: string}
                  metadata: {type: string}
                  dify_message_id: {type: string}
                  is_error: {type: boolean}
                  created_at: {type: string}
            total: {type: integer}
            page: {type: integer}
            has_more: {type: boolean}
      403:
        description: 无权访问
    """
    conv = Conversation.query.get_or_404(conv_id)
    if conv.user_id != g.current_user.id:
        return jsonify({"error": "无权访问该对话"}), 403

    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 50, type=int)
    before_id = request.args.get("before_id", type=int)

    q = Message.query.filter_by(conversation_id=conv_id)
    if before_id:
        q = q.filter(Message.id < before_id)

    pagination = q.order_by(db.desc(Message.created_at)).paginate(
        page=page, per_page=per_page, error_out=False
    )
    messages = [m.to_dict() for m in reversed(pagination.items)]

    return jsonify({
        "messages": messages,
        "total": pagination.total,
        "page": pagination.page,
        "has_more": pagination.has_next,
    })


@conversations_bp.route("/conversations/<int:conv_id>/messages", methods=["POST"])
@login_required
def add_message(conv_id):
    """
    添加消息
    ---
    tags:
      - Messages
    summary: 向对话添加一条消息
    description: |
      通常由前端在与 Dify 完成流式对话后调用，将结果持久化。用户消息会自动更新对话标题。
    security:
      - Bearer: []
    parameters:
      - name: conv_id
        in: path
        type: integer
        required: true
      - name: body
        in: body
        required: true
        schema:
          type: object
          required: [role, content]
          properties:
            role:
              type: string
              description: 消息角色
              enum: [user, assistant, system]
            content:
              type: string
              description: 消息内容
            attachments:
              type: string
              description: 附件信息（JSON 字符串）
            metadata:
              type: string
              description: 元数据（JSON 字符串）
            dify_message_id:
              type: string
              description: Dify 消息 ID
            is_error:
              type: boolean
              description: 是否为错误消息
    responses:
      201:
        description: 消息添加成功
      403:
        description: 无权访问
    """
    conv = Conversation.query.get_or_404(conv_id)
    if conv.user_id != g.current_user.id:
        return jsonify({"error": "无权访问该对话"}), 403

    data = request.get_json(silent=True) or {}
    msg = Message(
        conversation_id=conv_id,
        role=data.get("role", "user"),
        content=data.get("content", ""),
        attachments=data.get("attachments", ""),
        metadata_=data.get("metadata", ""),
        dify_message_id=data.get("dify_message_id", ""),
        is_error=data.get("is_error", False),
    )
    db.session.add(msg)

    # 更新对话最后消息时间 & 自动生成标题
    conv.last_message_at = db.func.now()
    if conv.title == "新对话" and msg.role == "user" and msg.content:
        conv.title = msg.content[:50] + ("..." if len(msg.content) > 50 else "")

    db.session.commit()
    return jsonify({"message": msg.to_dict()}), 201