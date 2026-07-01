# -*- coding: utf-8 -*-
"""パイプライン全体で受け渡すデータ構造。"""

from dataclasses import dataclass, field
from typing import List, Optional

# 分類の許容値（AI出力の検証にも使う）
KINDS = ["致命的な不具合", "軽微な不具合", "機能要望", "新アプリ希望", "質問・その他"]
PRIORITIES = ["高", "中", "低"]

# ユーザーがプルダウンで選ぶ粗い「要件」区分 → 内部 KINDS へのマッピング。
#   不具合報告だけは深刻度（致命的/軽微）を AI に判定させる。
REQUEST_TYPES = ["不具合報告", "改善要望", "新アプリ希望", "その他"]


@dataclass
class Report:
    """チャットから受信した1件の報告（生の入力）。"""
    text: str                              # ユーザーの投稿本文
    reporter: str = "不明"                 # 報告者名（表示名）
    image_paths: List[str] = field(default_factory=list)  # 添付スクショのローカルパス
    created_at: str = ""                   # 発生日時（受信時刻・文字列）
    channel: str = ""                      # 返信先チャンネル
    thread_ts: str = ""                    # 返信先スレッド（Slack）
    source: str = "manual"                 # slack / teams / manual など
    forced_app: str = ""                   # ユーザーがプルダウンで指定した対象アプリ（空ならAI自動判定）
    forced_kind: str = ""                  # ユーザーが選んだ要件区分（不具合報告/改善要望/その他。空ならAI自動判定）


@dataclass
class Analysis:
    """AI マルチモーダル解析の結果（構造化データ）。"""
    target_app: str                        # 対象アプリ（18種 or その他・不明）
    kind: str                              # 投稿種類（KINDS のいずれか）
    priority: str                          # 優先度（高/中/低）
    title: str                             # タスクのタイトル
    summary: str                           # 詳細概要（Markdown）
    cause_guess: str = ""                  # AI視点の初期原因の推測
    advice: str = ""                       # 暫定対応アドバイス


@dataclass
class Ticket:
    """起票結果。"""
    url: str
    id: str = ""
    backend: str = ""


@dataclass
class PipelineResult:
    """5ステップ実行後のまとめ。チャット返信・ログに使う。"""
    report: Report
    analysis: Optional[Analysis] = None
    ticket: Optional[Ticket] = None
    mail_sent: bool = False
    errors: List[str] = field(default_factory=list)
