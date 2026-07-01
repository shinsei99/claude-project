# -*- coding: utf-8 -*-
"""チャットアダプタの選択。CHAT_BACKEND に応じて実装を返す。"""

import config
from services.chat.base import ChatAdapter
from services.chat.slack import SlackAdapter
from services.chat.manual import ManualAdapter


def get_adapter() -> ChatAdapter:
    if config.CHAT_BACKEND == "slack":
        return SlackAdapter()
    # teams / line-works はここに追加（ChatAdapter を実装するだけ）
    return ManualAdapter()
