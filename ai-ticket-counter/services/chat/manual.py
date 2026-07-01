# -*- coding: utf-8 -*-
"""手動アダプタ。CHAT_BACKEND 未設定時や CLI テスト用。

返信は標準出力に表示するだけ。実チャットには送らない。
"""

from typing import List

from core.models import Report
from services.chat.base import ChatAdapter


class ManualAdapter(ChatAdapter):
    name = "manual"

    def download_images(self, report: Report, dest_dir: str) -> List[str]:
        # 既に report.image_paths にローカルパスが入っている前提
        return report.image_paths

    def reply(self, report: Report, text: str) -> None:
        print("\n" + "=" * 56)
        print("💬 AI受付の返信（→ チャット）")
        print("=" * 56)
        print(text)
        print("=" * 56 + "\n")
