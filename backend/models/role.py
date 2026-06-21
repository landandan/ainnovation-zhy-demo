"""角色与权限模型"""
from models import db


class Role(db.Model):
    __tablename__ = "roles"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)
    description = db.Column(db.String(256), default="")

    # 角色类型: "system" | "custom"
    role_type = db.Column(db.String(20), default="custom")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "role_type": self.role_type,
        }


class UserRole(db.Model):
    """用户-角色多对多关联"""
    __tablename__ = "user_roles"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role_id = db.Column(db.Integer, db.ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)

    __table_args__ = (
        db.UniqueConstraint("user_id", "role_id", name="uq_user_role"),
    )


class RoleAgent(db.Model):
    """角色-应用可见性关联（控制某角色能看见哪些 Agent）"""
    __tablename__ = "role_agents"

    id = db.Column(db.Integer, primary_key=True)
    role_id = db.Column(db.Integer, db.ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    agent_id = db.Column(db.Integer, db.ForeignKey("agent_defs.id", ondelete="CASCADE"), nullable=False)

    __table_args__ = (
        db.UniqueConstraint("role_id", "agent_id", name="uq_role_agent"),
    )