"""Flask 应用入口"""
import os
from pathlib import Path
from dotenv import load_dotenv

# 使用相对于 app.py 的路径加载 .env，确保在任何工作目录下都能正确加载
_env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(_env_path)

from flask import Flask, jsonify
from flask_cors import CORS
from flasgger import Swagger
from config import Config

from models import db, init_db


def create_app() -> Flask:
    """工厂函数：创建并配置 Flask 应用"""
    app = Flask(__name__)
    app.config.from_object(Config)

    # CORS（允许前端跨域访问）
    CORS(app, origins=["*"], supports_credentials=True)

    # Swagger API 文档（访问 /api/apidocs/）
    swagger_config = {
        "headers": [],
        "specs": [
            {
                "endpoint": "apispec",
                "route": "/api/apispec.json",
                "rule_filter": lambda rule: True,
            }
        ],
        "static_url_path": "/flasgger_static",
        "swagger_ui": True,
        "specs_route": "/api/apidocs/",
    }
    Swagger(app, config=swagger_config)

    # 初始化数据库
    db.init_app(app)

    # 注册路由蓝图
    from routes.auth import auth_bp
    from routes.agents import agents_bp
    from routes.conversations import conversations_bp
    from routes.settings import settings_bp
    from routes.dify_proxy import dify_proxy_bp

    app.register_blueprint(auth_bp, url_prefix="/api")
    app.register_blueprint(agents_bp, url_prefix="/api")
    app.register_blueprint(conversations_bp, url_prefix="/api")
    app.register_blueprint(settings_bp, url_prefix="/api")
    app.register_blueprint(dify_proxy_bp, url_prefix="/api")

    # 健康检查
    @app.route("/api/health")
    def health():
        return jsonify({"status": "ok", "auth_provider": app.config["AUTH_PROVIDER"]})

    # 首次启动自动建表
    with app.app_context():
        init_db(app)

    return app


if __name__ == "__main__":
    application = create_app()
    application.run(host="0.0.0.0", port=5000, debug=True)