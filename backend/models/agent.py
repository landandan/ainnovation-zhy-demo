"""Agent 应用 & Dify 配置模型"""
from models import db
from sqlalchemy import func


class AgentDef(db.Model):
    """Agent 应用定义 —— 相当于前端侧边栏里每个应用卡片"""
    __tablename__ = "agent_defs"

    id = db.Column(db.Integer, primary_key=True)
    agent_id = db.Column(db.String(80), unique=True, nullable=False)  # 唯一标识
    label = db.Column(db.String(120), nullable=False)                 # 显示名称
    icon = db.Column(db.String(10), default="🤖")                     # emoji 图标
    desc = db.Column(db.String(256), default="")                      # 描述文案
    quick_questions = db.Column(db.Text, default="[]")                # 快速提问列表 JSON
    gradient = db.Column(db.String(80), default="var(--gradient-1)")  # CSS 渐变变量
    sort_order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, server_default=func.now())

    # 关联 Dify 配置（一对多，可配多环境 key）
    dify_configs = db.relationship("DifyConfig", backref="agent", lazy="dynamic",
                                   cascade="all, delete-orphan")

    def to_dict(self):
        import json
        return {
            "id": self.id,
            "agent_id": self.agent_id,
            "label": self.label,
            "icon": self.icon,
            "desc": self.desc,
            "quick_questions": json.loads(self.quick_questions) if self.quick_questions else [],
            "gradient": self.gradient,
            "sort_order": self.sort_order,
            "is_active": self.is_active,
        }


class DifyConfig(db.Model):
    """Dify 应用配置（api_key, base_url 等）"""
    __tablename__ = "dify_configs"

    id = db.Column(db.Integer, primary_key=True)
    agent_id = db.Column(db.Integer, db.ForeignKey("agent_defs.id", ondelete="CASCADE"), nullable=False)
    env_label = db.Column(db.String(64), default="default")           # 环境标签，如 dev/prod
    dify_api_key = db.Column(db.String(256), default="")              # Dify 应用的 API Key
    dify_base_url = db.Column(db.String(256), default="")             # Dify 服务地址
    is_default = db.Column(db.Boolean, default=False)                 # 是否默认配置
    created_at = db.Column(db.DateTime, server_default=func.now())

    def to_dict(self, hide_key=True):
        d = {
            "id": self.id,
            "agent_id": self.agent_id,
            "env_label": self.env_label,
            "dify_base_url": self.dify_base_url,
            "is_default": self.is_default,
        }
        if not hide_key:
            d["dify_api_key"] = self.dify_api_key
        else:
            d["dify_api_key"] = self.dify_api_key[:8] + "****" if self.dify_api_key else ""
        return d


class AgentApiKey(db.Model):
    """Agent 对话临时凭证（按用户+应用生成，控制会话权限）"""
    __tablename__ = "agent_api_keys"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    agent_id = db.Column(db.Integer, db.ForeignKey("agent_defs.id", ondelete="CASCADE"), nullable=False)
    api_key_hash = db.Column(db.String(256), nullable=False)          # 哈希后的临时 key
    key_prefix = db.Column(db.String(12), default="")                 # key 前缀便于展示
    expires_at = db.Column(db.DateTime, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, server_default=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "agent_id": self.agent_id,
            "key_prefix": self.key_prefix,
            "is_active": self.is_active,
            "expires_at": self.expires_at.isoformat() if self.expires_at else "",
        }