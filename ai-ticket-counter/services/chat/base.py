# -*- coding: utf-8 -*-
"""チャットアダプタの共通インターフェース。

新しいチャットツール（Teams / LINE WORKS 等）に対応するときは、
このクラスを継承して parse_event / download_images / reply を実装する。
"""

from typing import List, Tuple

from core.models import Report


class ChatAdapter:
    name = "base"

    def verify(self, headers: dict, raw_body: bytes) -> bool:
        """Webhook リクエストの署名検証。既定は無検証（True）。"""
        return True

    def parse_event(self, payload: dict) -> Tuple[Report, bool]:
        """受信ペイロードを Report に変換。

        戻り値 (report, should_process):
          should_process=False なら無視（bot自身の発言・重複・URL検証など）。
        """
        raise NotImplementedError

    def download_images(self, report: Report, dest_dir: str) -> List[str]:
        """添付画像をローカルへ保存し、そのパス一覧を返す。"""
        return []

    def reply(self, report: Report, text: str) -> None:
        """元スレッド/チャンネルへ返信する。"""
        raise NotImplementedError
