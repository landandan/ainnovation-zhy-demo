"""数据模型 —— SQLAlchemy ORM"""
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def init_db(app):
    """首次启动自动建表 + 种子数据"""
    from models.user import User
    from models.agent import AgentDef, AgentApiKey, DifyConfig
    from models.conversation import Conversation, Message
    from models.role import Role, UserRole, RoleAgent

    db.create_all()

    _migrate_db()

    # 种子数据：首次无数据时创建默认角色和 Admin 用户
    if not Role.query.first():
        admin_role = Role(name="admin", description="系统管理员，可见全部应用")
        user_role = Role(name="user", description="普通用户，仅可见默认应用")
        db.session.add_all([admin_role, user_role])
        db.session.commit()

    if not User.query.first():
        import bcrypt
        pw = bcrypt.hashpw("admin123".encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        admin_user = User(username="admin", password_hash=pw)
        db.session.add(admin_user)
        db.session.commit()

        # 管理员分配 admin 角色
        admin_role = Role.query.filter_by(name="admin").first()
        if admin_role:
            ur = UserRole(user_id=admin_user.id, role_id=admin_role.id)
            db.session.add(ur)
            db.session.commit()

    # 种子数据：初始化默认 Agent
    _seed_default_agents()


def _migrate_db():
    """数据库迁移：添加新增的列"""
    try:
        result = db.engine.execute(db.text("PRAGMA table_info(agent_defs)"))
        columns = [row[1] for row in result.fetchall()]
        
        if "quick_questions" not in columns:
            db.engine.execute(db.text("ALTER TABLE agent_defs ADD COLUMN quick_questions TEXT DEFAULT '[]'"))
            db.session.commit()
    except Exception:
        pass


def _seed_default_agents():
    """初始化默认 4 个内置应用"""
    from models.agent import AgentDef
    if AgentDef.query.count() > 0:
        return

    defaults = [
        {"agent_id": "knowledge", "label": "海油知识库", "icon": "📚", "desc": "标准法规 · 安全规程",
         "gradient": "var(--gradient-1)"},
        {"agent_id": "inspection", "label": "无纸化巡检", "icon": "📸", "desc": "AI视觉 · 隐患识别",
         "gradient": "var(--gradient-2)"},
        {"agent_id": "repair", "label": "维修知识库", "icon": "🔧", "desc": "设备诊断 · 随身师傅",
         "gradient": "var(--gradient-3)"},
        {"agent_id": "report", "label": "日报填报", "icon": "📊", "desc": "数据校验 · 自动填报",
         "gradient": "var(--gradient-4)"},
    ]

    for idx, d in enumerate(defaults):
        agent = AgentDef(
            agent_id=d["agent_id"],
            label=d["label"],
            icon=d["icon"],
            desc=d["desc"],
            gradient=d["gradient"],
            sort_order=idx,
        )
        db.session.add(agent)
    db.session.commit()


from models.user import User  # noqa: E402,F401
from models.agent import AgentDef, AgentApiKey, DifyConfig  # noqa: E402,F401
from models.conversation import Conversation, Message  # noqa: E402,F401
from models.role import Role, UserRole, RoleAgent  # noqa: E402,F401