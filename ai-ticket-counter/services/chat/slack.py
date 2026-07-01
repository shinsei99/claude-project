# -*- coding: utf-8 -*-
"""Slack アダプタ。Events API（message / app_mention）を受けて Report 化し、
添付画像を DL、スレッドへ業務口調で返信する。

必要な権限（Bot Token Scopes）: chat:write, files:read
署名検証には SLACK_SIGNING_SECRET を使用。
"""

import hashlib
import hmac
import os
import time
from typing import List, Tuple

import requests

import config
from core.models import Report
from services.chat.base import ChatAdapter

SLACK_API = "https://slack.com/api"


class SlackAdapter(ChatAdapter):
    name = "slack"

    def verify(self, headers: dict, raw_body: bytes) -> bool:
        secret = config.SLACK_SIGNING_SECRET
        if not secret:
            return True  # 未設定なら検証スキップ（ローカル検証用）
        ts = headers.get("x-slack-request-timestamp", "")
        sig = headers.get("x-slack-signature", "")
        if not ts or not sig:
            return False
        # リプレイ攻撃対策（5分以上前は拒否）
        try:
            if abs(time.time() - int(ts)) > 60 * 5:
                return False
        except ValueError:
            return False
        base = f"v0:{ts}:{raw_body.decode('utf-8', 'ignore')}"
        mine = "v0=" + hmac.new(secret.encode(), base.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(mine, sig)

    def parse_event(self, payload: dict) -> Tuple[Report, bool]:
        event = payload.get("event", {}) or {}
        # bot 自身の発言・サブタイプ（編集/join等）は無視
        if event.get("bot_id") or event.get("subtype") in ("bot_message", "message_changed"):
            return None, False
        etype = event.get("type")
        if etype not in ("message", "app_mention"):
            return None, False

        text = event.get("text", "") or ""
        user = event.get("user", "") or "不明"
        channel = event.get("channel", "") or ""
        ts = event.get("ts", "") or ""
        # スレッド内なら親、なければ自分の ts をスレッドキーにする
        thread_ts = event.get("thread_ts") or ts

        files = event.get("files", []) or []
        # 画像の DL URL とファイル名を Report に一時保持（download_images で使う）
        report = Report(
            text=text,
            reporter=self._display_name(user),
            image_paths=[],  # download_images で埋める
            created_at=self._fmt_ts(ts),
            channel=channel,
            thread_ts=thread_ts,
            source="slack",
        )
        report._slack_files = [
            (f.get("url_private_download") or f.get("url_private"), f.get("name", "shot"))
            for f in files
            if str(f.get("mimetype", "")).startswith("image/")
        ]
        return report, True

    def download_images(self, report: Report, dest_dir: str) -> List[str]:
        files = getattr(report, "_slack_files", []) or []
        token = config.SLACK_BOT_TOKEN
        paths = []
        for i, (url, name) in enumerate(files):
            if not url:
                continue
            try:
                r = requests.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=30)
                r.raise_for_status()
                ext = os.path.splitext(name)[1] or ".png"
                p = os.path.join(dest_dir, f"slack_{i + 1}{ext}")
                with open(p, "wb") as f:
                    f.write(r.content)
                paths.append(p)
            except Exception as e:
                print(f"[slack] 画像DL失敗: {e}")
        report.image_paths = paths
        return paths

    def reply(self, report: Report, text: str) -> None:
        token = config.SLACK_BOT_TOKEN
        if not token:
            print("[slack] SLACK_BOT_TOKEN 未設定のため返信スキップ:\n" + text)
            return
        r = requests.post(
            f"{SLACK_API}/chat.postMessage",
            headers={"Authorization": f"Bearer {token}"},
            json={"channel": report.channel, "thread_ts": report.thread_ts, "text": text},
            timeout=30,
        )
        data = r.json()
        if not data.get("ok"):
            print(f"[slack] 返信失敗: {data.get('error')}")

    # ── helpers ──
    def _display_name(self, user_id: str) -> str:
        token = config.SLACK_BOT_TOKEN
        if not token or not user_id:
            return user_id or "不明"
        try:
            r = requests.get(
                f"{SLACK_API}/users.info",
                headers={"Authorization": f"Bearer {token}"},
                params={"user": user_id}, timeout=10,
            )
            d = r.json()
            if d.get("ok"):
                prof = d["user"].get("profile", {})
                return prof.get("display_name") or prof.get("real_name") or user_id
        except Exception:
            pass
        return user_id

    def _fmt_ts(self, ts: str) -> str:
        try:
            lt = time.localtime(float(ts))
            return time.strftime("%Y-%m-%d %H:%M:%S", lt)
        except (ValueError, TypeError):
            return ts
