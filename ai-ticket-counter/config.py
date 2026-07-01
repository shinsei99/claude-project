# -*- coding: utf-8 -*-
"""環境変数（.env）を読み込み、アプリ全体の設定を提供する。

機密情報（SMTPパスワード・APIキー・Webhook）はコードに直書きせず、
すべて .env / 環境変数から読み込む。
"""

import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:  # python-dotenv 未導入でも環境変数があれば動く
    pass


def _get(key: str, default: str = "") -> str:
    return os.environ.get(key, default).strip()


def _bool(key: str, default: bool = False) -> bool:
    return _get(key, str(default)).lower() in ("1", "true", "yes", "on")


def _int(key: str, default: int) -> int:
    try:
        return int(_get(key, str(default)))
    except ValueError:
        return default


# ── AI 解析（claude CLI） ─────────────────────────────────────────────
CLAUDE_BIN = os.path.expanduser(_get("CLAUDE_BIN", "~/.local/bin/claude"))
CLAUDE_MODEL = _get("CLAUDE_MODEL", "sonnet")
CLAUDE_TIMEOUT = _int("CLAUDE_TIMEOUT", 300)

# ── 起票先 ────────────────────────────────────────────────────────────
TICKET_BACKEND = _get("TICKET_BACKEND", "github").lower()

GITHUB_REPO = _get("GITHUB_REPO", "shinsei99/project")
GITHUB_TOKEN = _get("GITHUB_TOKEN")

NOTION_TOKEN = _get("NOTION_TOKEN")
NOTION_DATABASE_ID = _get("NOTION_DATABASE_ID")

BACKLOG_SPACE = _get("BACKLOG_SPACE")
BACKLOG_API_KEY = _get("BACKLOG_API_KEY")
BACKLOG_PROJECT_ID = _get("BACKLOG_PROJECT_ID")
BACKLOG_ISSUE_TYPE_ID = _get("BACKLOG_ISSUE_TYPE_ID")
BACKLOG_PRIORITY_ID = _get("BACKLOG_PRIORITY_ID")

# ── メール ────────────────────────────────────────────────────────────
# applescript = Mac のメールアプリ(Apple Mail)に下書きを作成して表示（既定）
# smtp        = SMTP で自動送信
MAIL_BACKEND = _get("MAIL_BACKEND", "applescript").lower()

SMTP_HOST = _get("SMTP_HOST")
SMTP_PORT = _int("SMTP_PORT", 587)
SMTP_USER = _get("SMTP_USER")
SMTP_PASSWORD = _get("SMTP_PASSWORD")
SMTP_USE_TLS = _bool("SMTP_USE_TLS", True)
MAIL_FROM = _get("MAIL_FROM") or SMTP_USER
MAIL_TO = [a.strip() for a in _get("MAIL_TO").split(",") if a.strip()]

# ── チャット ──────────────────────────────────────────────────────────
CHAT_BACKEND = _get("CHAT_BACKEND", "slack").lower()
SLACK_BOT_TOKEN = _get("SLACK_BOT_TOKEN")
SLACK_SIGNING_SECRET = _get("SLACK_SIGNING_SECRET")

# ── サーバ ────────────────────────────────────────────────────────────
HOST = _get("HOST", "0.0.0.0")
PORT = _int("PORT", 8600)

# 起票・メール・チャットのうち未設定でも、他ステップは動くよう各サービスで
# 個別に有効/無効を判定する（ローカル検証を止めないため）。
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
