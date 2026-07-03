"""对话 & 消息模型"""
from models import db
from sqlalchemy import func


class Conversation(db.Model):
    """一次用户-Agent 对话会话"""
    __tablename__ = "conversations"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    agent_id = db.Column(db.Integer, db.ForeignKey("agent_defs.id", ondelete="CASCADE"), nullable=False)
    title = db.Column(db.String(256), default="新对话")
    dify_conversation_id = db.Column(db.String(128), default="")  # Dify 侧会话 ID (可选)
    is_pinned = db.Column(db.Boolean, default=False)
    is_archived = db.Column(db.Boolean, default=False)
    last_message_at = db.Column(db.DateTime, server_default=func.now())
    created_at = db.Column(db.DateTime, server_default=func.now())
    updated_at = db.Column(db.DateTime, server_default=func.now(), onupdate=func.now())

    messages = db.relationship("Message", backref="conversation", lazy="dynamic",
                               cascade="all, delete-orphan",
                               order_by="Message.created_at")

    user = db.relationship("User", backref="conversations", lazy=True)
    agent = db.relationship("AgentDef", backref="conversations", lazy=True)

    def to_dict(self, include_messages=False, limit=50):
        d = {
            "id": self.id,
            "user_id": self.user_id,
            "agent_id": self.agent_id,
            "agent_id_str": self.agent.agent_id if self.agent else "",
            "title": self.title,
            "dify_conversation_id": self.dify_conversation_id,
            "is_pinned": self.is_pinned,
            "is_archived": self.is_archived,
            "last_message_at": self.last_message_at.isoformat() if self.last_message_at else "",
            "created_at": self.created_at.isoformat() if self.created_at else "",
            "message_count": self.messages.count(),
        }
        if include_messages:
            msgs = self.messages.order_by(
                db.desc(Message.created_at)
            ).limit(limit).all()
            d["messages"] = [m.to_dict() for m in reversed(msgs)]
        return d


class Message(db.Model):
    """单条对话消息"""
    __tablename__ = "messages"

    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey("conversations.id", ondelete="CASCADE"),
                                nullable=False)
    role = db.Column(db.String(20), nullable=False)  # "user" | "assistant" | "system"
    content = db.Column(db.Text, default="")
    # 富媒体可选字段
    attachments = db.Column(db.Text, default="")     # JSON string, 如文件列表
    metadata_ = db.Column("metadata", db.Text, default="")  # JSON string, 如 token 消耗
    dify_message_id = db.Column(db.String(128), default="")  # Dify 侧消息 ID
    is_error = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, server_default=func.now())

    def to_dict(self):
        import json
        att = []
        meta = {}
        try:
            att = json.loads(self.attachments) if self.attachments else []
        except Exception:
            att = []
        try:
            meta = json.loads(self.metadata_) if self.metadata_ else {}
        except Exception:
            meta = {}
        return {
            "id": self.id,
            "conversation_id": self.conversation_id,
            "role": self.role,
            "content": self.content,
            "attachments": att,
            "metadata": meta,
            "dify_message_id": self.dify_message_id,
            "is_error": self.is_error,
            "created_at": self.created_at.isoformat() if self.created_at else "",
        }