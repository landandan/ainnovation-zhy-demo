"""用户模型"""
from models import db
from sqlalchemy import func


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    email = db.Column(db.String(120), unique=True, default="")
    display_name = db.Column(db.String(120), default="")

    # Dify 关联（预留：若 AUTH_PROVIDER=dify，此处存储 Dify user id）
    dify_user_id = db.Column(db.String(128), default="", index=True)

    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, server_default=func.now())
    updated_at = db.Column(db.DateTime, server_default=func.now(), onupdate=func.now())

    def to_dict(self, include_roles=False):
        d = {
            "id": self.id,
            "username": self.username,
            "display_name": self.display_name,
            "email": self.email,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else "",
        }
        if include_roles:
            from models.role import UserRole, Role
            ur_records = UserRole.query.filter_by(user_id=self.id).all()
            role_ids = [r.role_id for r in ur_records]
            roles = Role.query.filter(Role.id.in_(role_ids)).all() if role_ids else []
            d["roles"] = [r.name for r in roles]
        return d