#!/usr/bin/env python3
"""
管理员初始化脚本 —— 用于开发环境手动初始化/重置管理员账号

用法:
    python scripts/init_admin.py                # 使用 .env 或默认值初始化
    python scripts/init_admin.py --force        # 强制重置管理员密码
    python scripts/init_admin.py --no-default-agents  # 不创建默认应用

环境变量（.env 文件或系统环境）：
    ADMIN_USERNAME      管理员用户名（默认: admin）
    ADMIN_PASSWORD      管理员密码（默认: admin123）
    ADMIN_EMAIL         管理员邮箱（默认: ""）
    ADMIN_DISPLAY_NAME  显示名称（默认: 系统管理员）
    DATABASE_URL        数据库连接地址（默认使用 config.py 中的设置）
"""

import os
import sys
import argparse

# 确保项目根目录在 sys.path 中，以便导入 models 等模块
BASE_DIR = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
sys.path.insert(0, BASE_DIR)

# 尝试加载 .env 文件
try:
    from dotenv import load_dotenv
    env_path = os.path.join(BASE_DIR, ".env")
    if os.path.isfile(env_path):
        load_dotenv(env_path)
        print(f"[dotenv] 已加载环境变量文件: {env_path}")
except ImportError:
    pass  # python-dotenv 未安装时跳过

import bcrypt
from flask import Flask
from config import Config
from models import db as _db, init_db
from models.user import User
from models.agent import AgentDef
from models.role import Role, UserRole, RoleAgent
# UserSettings 定义在 routes/settings.py 中，需要导入
from routes.settings import UserSettings


def parse_args():
    """解析命令行参数"""
    parser = argparse.ArgumentParser(
        description="初始化/重置管理员账号与种子数据",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="强制重置管理员密码和显示名称（用户已存在时）",
    )
    parser.add_argument(
        "--no-default-agents",
        action="store_true",
        help="不创建默认智能体应用",
    )
    return parser.parse_args()


def get_config():
    """从环境变量读取管理员配置"""
    return {
        "username": os.getenv("ADMIN_USERNAME", "admin"),
        "password": os.getenv("ADMIN_PASSWORD", "admin123"),
        "email": os.getenv("ADMIN_EMAIL", ""),
        "display_name": os.getenv("ADMIN_DISPLAY_NAME", "系统管理员"),
    }


def ensure_roles():
    """确保系统角色存在（admin / user）"""
    print("[角色] 检查系统角色 ...")
    roles = {
        "admin": "系统管理员，可见全部应用",
        "user": "普通用户，仅可见授权应用",
    }
    created = []
    for name, desc in roles.items():
        role = Role.query.filter_by(name=name).first()
        if not role:
            role = Role(name=name, description=desc, role_type="system")
            _db.session.add(role)
            created.append(name)
            print(f"  + 创建角色: {name}")
        else:
            # 确保已有角色的 role_type 正确
            if role.role_type != "system":
                role.role_type = "system"
            print(f"  · 角色已存在: {name}")

    if created:
        _db.session.commit()
    return roles.keys()


def ensure_admin(config: dict, force: bool):
    """确保管理员用户存在；force=True 时重置密码"""
    print("[管理员] 检查管理员用户 ...")
    username = config["username"]
    user = User.query.filter_by(username=username).first()

    if user:
        if force:
            # 重置密码和显示信息
            user.password_hash = bcrypt.hashpw(
                config["password"].encode("utf-8"),
                bcrypt.gensalt(),
            ).decode("utf-8")
            user.display_name = config["display_name"]
            user.email = config["email"]
            user.is_active = True
            _db.session.commit()
            print(f"  ↻ 已重置管理员账号: {username}")
        else:
            print(f"  · 管理员账号已存在: {username}（跳过，使用 --force 强制重置）")
    else:
        # 新建管理员
        user = User(
            username=username,
            password_hash=bcrypt.hashpw(
                config["password"].encode("utf-8"),
                bcrypt.gensalt(),
            ).decode("utf-8"),
            email=config["email"],
            display_name=config["display_name"],
        )
        _db.session.add(user)
        _db.session.flush()
        _db.session.commit()
        print(f"  + 创建管理员账号: {username}")

    return user


def assign_admin_role(user: User):
    """为管理员分配 admin 角色"""
    print("[权限] 分配管理员角色 ...")
    admin_role = Role.query.filter_by(name="admin").first()
    if not admin_role:
        print("  ✗ 错误: admin 角色不存在，请先运行 ensure_roles()")
        return

    existing = UserRole.query.filter_by(user_id=user.id, role_id=admin_role.id).first()
    if existing:
        print("  · admin 角色已分配")
    else:
        ur = UserRole(user_id=user.id, role_id=admin_role.id)
        _db.session.add(ur)
        _db.session.commit()
        print("  + 已分配 admin 角色")

    # 同时确保普通用户也有 user 角色
    user_role = Role.query.filter_by(name="user").first()
    if user_role:
        existing_ur = UserRole.query.filter_by(user_id=user.id, role_id=user_role.id).first()
        if not existing_ur:
            ur2 = UserRole(user_id=user.id, role_id=user_role.id)
            _db.session.add(ur2)
            _db.session.commit()
            print("  + 已分配 user 角色")


def set_admin_visibility():
    """确保 admin 角色可看到所有 Agent（幂等）"""
    print("[可见性] 设置管理员可见范围 ...")
    admin_role = Role.query.filter_by(name="admin").first()
    if not admin_role:
        print("  ✗ admin 角色不存在，跳过")
        return

    all_agents = AgentDef.query.all()
    if not all_agents:
        print("  · 暂无 Agent 定义，跳过")
        return

    count = 0
    for agent in all_agents:
        existing = RoleAgent.query.filter_by(
            role_id=admin_role.id, agent_id=agent.id
        ).first()
        if not existing:
            ra = RoleAgent(role_id=admin_role.id, agent_id=agent.id)
            _db.session.add(ra)
            count += 1

    if count > 0:
        _db.session.commit()
        print(f"  + 已为 admin 角色开放 {count} 个 Agent 的访问权限")
    else:
        print("  · 所有 Agent 已对 admin 角色可见")


def ensure_default_agents():
    """创建默认 4 个内置应用（幂等）"""
    from models.agent import AgentDef

    defaults = [
        {
            "agent_id": "knowledge",
            "label": "知识库",
            "icon": "📚",
            "desc": "标准法规 · 安全规程",
            "gradient": "var(--gradient-1)",
        },
        {
            "agent_id": "inspection",
            "label": "无纸化巡检",
            "icon": "📸",
            "desc": "AI视觉 · 隐患识别",
            "gradient": "var(--gradient-2)",
        },
        {
            "agent_id": "repair",
            "label": "维修知识库",
            "icon": "🔧",
            "desc": "设备诊断 · 随身师傅",
            "gradient": "var(--gradient-3)",
        },
        {
            "agent_id": "report",
            "label": "日报填报",
            "icon": "📊",
            "desc": "数据校验 · 自动填报",
            "gradient": "var(--gradient-4)",
        },
    ]

    created = 0
    for idx, d in enumerate(defaults):
        existing = AgentDef.query.filter_by(agent_id=d["agent_id"]).first()
        if existing:
            print(f"  · Agent 已存在: {d['label']}")
        else:
            agent = AgentDef(
                agent_id=d["agent_id"],
                label=d["label"],
                icon=d["icon"],
                desc=d["desc"],
                gradient=d["gradient"],
                sort_order=idx,
            )
            _db.session.add(agent)
            created += 1
            print(f"  + 创建 Agent: {d['label']}")

    if created > 0:
        _db.session.commit()
        print(f"  ✓ 共创建 {created} 个默认 Agent")
    return created


def ensure_default_settings(admin_user: User):
    """为管理员用户创建默认系统设置（theme, language 等）"""
    print("[设置] 检查管理员默认设置 ...")
    existing = UserSettings.query.filter_by(user_id=admin_user.id).first()
    if existing:
        print("  · 管理员设置已存在，跳过")
        return

    import json
    default_data = {
        "theme": "light",
        "language": "zh-CN",
    }
    s = UserSettings(
        user_id=admin_user.id,
        data=json.dumps(default_data, ensure_ascii=False),
    )
    _db.session.add(s)
    _db.session.commit()
    print("  + 已创建管理员默认设置（theme=light, language=zh-CN）")


def main():
    """主函数"""
    args = parse_args()
    config = get_config()

    print("=" * 50)
    print("  管理员初始化脚本")
    print("=" * 50)
    print(f"  用户名: {config['username']}")
    print(f"  显示名: {config['display_name']}")
    print(f"  强制重置: {'是' if args.force else '否'}")
    print(f"  创建默认Agent: {'是' if not args.no_default_agents else '否'}")
    print("=" * 50)
    print()

    # 1. 创建 Flask 应用上下文，初始化数据库连接
    app = Flask(__name__)
    app.config.from_object(Config)

    # 允许环境变量覆盖 DATABASE_URL
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        app.config["SQLALCHEMY_DATABASE_URI"] = db_url

    _db.init_app(app)

    with app.app_context():
        # 确保表已创建
        _db.create_all()

        # 2. 确保角色存在
        ensure_roles()

        # 3. 创建/更新管理员用户
        admin_user = ensure_admin(config, force=args.force)

        # 4. 分配 admin 角色
        assign_admin_role(admin_user)

        # 5. 创建默认 Agent（可选）
        if not args.no_default_agents:
            ensure_default_agents()

        # 6. 设置管理员可见全部 Agent
        set_admin_visibility()

        # 7. 创建默认设置
        ensure_default_settings(admin_user)

    print()
    print("=" * 50)
    print("  ✓ 初始化完成")
    print("=" * 50)
    print()
    print(f"  管理员账号: {config['username']}")
    print(f"  管理员密码: {config['password']}")
    print()
    print("  请妥善保管密码，生产环境请修改默认密码！")
    print()


if __name__ == "__main__":
    main()