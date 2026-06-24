"""Dify API 代理端点 —— API Key 仅存在于服务端，永不暴露给浏览器"""
import json
import logging
import uuid
from flask import Blueprint, request, Response, g
import requests

from models.agent import AgentDef, DifyConfig
from utils.auth import login_required

logger = logging.getLogger(__name__)
dify_proxy_bp = Blueprint("dify_proxy", __name__)

# 活跃上游流注册表：stream_id → requests.Response
# 用于在客户端断开或请求停止时，主动关闭上游 Dify 连接
_active_streams: dict[str, requests.Response] = {}


def _get_agent_dify_config(agent_id_str: str):
    """根据 agent_id 字符串查找默认 Dify 配置"""
    agent = AgentDef.query.filter_by(agent_id=agent_id_str, is_active=True).first()
    if not agent:
        return None, "智能体不存在或已禁用"
    config = DifyConfig.query.filter_by(agent_id=agent.id, is_default=True).first()
    if not config or not config.dify_api_key:
        return None, "该智能体未配置 Dify API Key"
    return {
        "api_key": config.dify_api_key,
        "base_url": config.dify_base_url or "",
    }, None


def _normalize_base_url(base_url: str) -> str:
    """规范化 Dify Base URL，自动补全 /v1"""
    url = (base_url or "https://api.dify.ai/v1").rstrip("/")
    if not url.endswith("/v1"):
        if "/v1" in url:
            url = url[: url.index("/v1") + 3]
        else:
            url += "/v1"
    return url


@dify_proxy_bp.route("/dify/chat-messages", methods=["POST"])
@login_required
def proxy_chat_messages():
    """
    代理 Dify Chat API（SSE 流式）

    请求体 JSON:
        {
            "agent_id": "knowledge",       // Agent 标识
            "query": "用户输入",
            "conversation_id": "xxx",      // 可选，Dify 会话 ID
            "inputs": {},                  // 可选，工作流变量
            "files": []                    // 可选，文件附件
        }

    返回: text/event-stream (SSE)
    """
    data = request.get_json(silent=True) or {}
    agent_id_str = data.get("agent_id", "").strip()
    query = data.get("query", "").strip()
    conversation_id = data.get("conversation_id")
    inputs = data.get("inputs", {})
    files = data.get("files")

    if not agent_id_str:
        return Response(
            "data: " + json.dumps({"event": "error", "message": "缺少 agent_id 参数"}) + "\n\n",
            mimetype="text/event-stream",
        )

    if not query and not files:
        return Response(
            "data: " + json.dumps({"event": "error", "message": "缺少 query 参数"}) + "\n\n",
            mimetype="text/event-stream",
        )

    config, error = _get_agent_dify_config(agent_id_str)
    if error:
        return Response(
            "data: " + json.dumps({"event": "error", "message": error}) + "\n\n",
            mimetype="text/event-stream",
        )

    # 构造 Dify 请求体
    dify_body = {
        "query": query,
        "user": str(g.current_user.id),
        "response_mode": "streaming",
        "inputs": inputs,
    }
    if conversation_id:
        dify_body["conversation_id"] = conversation_id
    if files:
        dify_body["files"] = files

    base_url = _normalize_base_url(config["base_url"])
    api_url = f"{base_url}/chat-messages"
    logger.info(f"Dify 代理请求: {api_url}")

    try:
        # 使用 stream=True，requests 会逐个 chunk 返回
        resp = requests.post(
            api_url,
            json=dify_body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {config['api_key']}",
            },
            stream=True,
            timeout=300,  # 5 分钟超时
        )

        if resp.status_code != 200:
            error_text = resp.text[:500] if resp.text else f"HTTP {resp.status_code}"
            logger.error(f"Dify API 错误: {error_text}")
            return Response(
                "data: " + json.dumps({"event": "error", "message": f"Dify API 错误: {error_text}"}) + "\n\n",
                mimetype="text/event-stream",
            )

        # 注册活跃流，用于停止时主动关闭
        stream_id = str(uuid.uuid4())
        _active_streams[stream_id] = resp

        # 逐行转发 SSE（flask 原生支持 yield）
        def generate():
            try:
                for line in resp.iter_lines(decode_unicode=True):
                    if line:
                        yield line + "\n"
            except GeneratorExit:
                # 客户端断开连接，主动关闭上游 Dify 流
                logger.info(f"客户端断开，关闭上游 Dify 流 (stream_id={stream_id})")
                resp.close()
            finally:
                # 清理注册表
                _active_streams.pop(stream_id, None)

        return Response(
            generate(),
            mimetype="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",  # 禁止 nginx 缓冲
            },
        )

    except requests.exceptions.Timeout:
        logger.error("Dify API 超时")
        return Response(
            "data: " + json.dumps({"event": "error", "message": "Dify API 请求超时"}) + "\n\n",
            mimetype="text/event-stream",
        )
    except requests.exceptions.RequestException as e:
        logger.error(f"Dify API 请求异常: {e}")
        return Response(
            "data: " + json.dumps({"event": "error", "message": f"Dify API 连接失败: {str(e)}"}) + "\n\n",
            mimetype="text/event-stream",
        )


@dify_proxy_bp.route("/dify/chat-messages/stop", methods=["POST"])
@login_required
def proxy_stop_chat():
    """
    代理 Dify 停止生成 API

    请求体 JSON:
        {
            "agent_id": "knowledge",
            "task_id": "xxx",
            "is_workflow": false   // 是否为 Workflow 应用
        }

    Dify 根据"应用类型"使用不同的停止端点：
    - Chatflow / Agent / Chatbot → POST /chat-messages/{task_id}/stop
    - Workflow                    → POST /workflows/run/{task_id}/stop

    返回 JSON:
        { "result": "success" }
    """
    data = request.get_json(silent=True) or {}
    agent_id_str = data.get("agent_id", "").strip()
    task_id = data.get("task_id", "").strip()
    is_workflow = bool(data.get("is_workflow", False))

    if not agent_id_str or not task_id:
        return {"error": "缺少 agent_id 或 task_id 参数"}, 400

    config, error = _get_agent_dify_config(agent_id_str)
    if error:
        return {"error": error}, 400

    base_url = _normalize_base_url(config["base_url"])
    # 根据 is_workflow 选择正确的 Dify 停止端点
    if is_workflow:
        stop_path = f"/workflows/run/{task_id}/stop"
    else:
        stop_path = f"/chat-messages/{task_id}/stop"
    stop_url = f"{base_url}{stop_path}"
    logger.info(f"Dify 停止请求 (is_workflow={is_workflow}): {stop_url}")

    try:
        resp = requests.post(
            stop_url,
            json={"user": str(g.current_user.id)},
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {config['api_key']}",
            },
            timeout=10,
        )

        if resp.status_code == 200:
            return {"result": "success"}
        else:
            error_text = resp.text[:300] if resp.text else f"HTTP {resp.status_code}"
            logger.error(f"Dify 停止 API 错误: {error_text}")
            return {"error": f"Dify 停止失败: {error_text}"}, resp.status_code

    except requests.exceptions.RequestException as e:
        logger.error(f"Dify 停止 API 异常: {e}")
        return {"error": f"Dify 停止失败: {str(e)}"}, 502


@dify_proxy_bp.route("/dify/files/upload", methods=["POST"])
@login_required
def proxy_file_upload():
    """
    代理 Dify 文件上传 API

    FormData:
        agent_id: 智能体标识
        file: 上传的文件

    返回 JSON:
        { "id": "...", "name": "...", "size": ..., "extension": "...", "mime_type": "..." }
    """
    agent_id_str = request.form.get("agent_id", "").strip()
    if not agent_id_str:
        return {"error": "缺少 agent_id 参数"}, 400

    config, error = _get_agent_dify_config(agent_id_str)
    if error:
        return {"error": error}, 400

    uploaded_file = request.files.get("file")
    if not uploaded_file:
        return {"error": "缺少 file 参数"}, 400

    base_url = _normalize_base_url(config["base_url"])
    api_url = f"{base_url}/files/upload"

    try:
        resp = requests.post(
            api_url,
            files={"file": (uploaded_file.filename, uploaded_file.stream, uploaded_file.content_type)},
            data={"user": str(g.current_user.id)},
            headers={
                "Authorization": f"Bearer {config['api_key']}",
            },
            timeout=60,
        )

        if resp.status_code not in (200, 201):
            return {"error": f"Dify 文件上传失败: {resp.text[:300]}"}, resp.status_code

        return resp.json(), resp.status_code

    except requests.exceptions.Timeout:
        return {"error": "Dify 文件上传超时"}, 504
    except requests.exceptions.RequestException as e:
        logger.error(f"Dify 文件上传异常: {e}")
        return {"error": f"Dify 文件上传失败: {str(e)}"}, 502