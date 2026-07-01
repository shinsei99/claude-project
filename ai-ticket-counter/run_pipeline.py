#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ローカル即テスト用ハーネス。Webhook を立てずに、報告1件を丸ごと流す。

チャット報告（テキスト＋スクショ）を模擬入力し、
②AI解析 → ③起票 → ④メール → ⑤返信（業務口調で標準出力）までを実行する。

使い方:
  # テキストのみ
  python run_pipeline.py --text "見積書ツールで金額が￥0になる。スクショ添付" --reporter 田中

  # スクショ添付（画像ファイルを渡す）
  python run_pipeline.py --text "画面が真っ白" --image ~/Desktop/error.png --reporter 佐藤

  # 何も渡さなければ内蔵のサンプルで動作確認（AI解析→返信まで）
  python run_pipeline.py
"""

import argparse
import time

from core.models import Report
from core.pipeline import process_report
from services.chat.manual import ManualAdapter


SAMPLE = (
    "見積書自動生成ツールで、PDFをアップして生成ボタンを押すと画面が真っ白になって"
    "何も出てきません。さっきまで使えてたのに急に。今日中に見積を出さないといけなくて困ってます。"
)


def main():
    ap = argparse.ArgumentParser(description="AI受付＆起票カウンター ローカルテスト")
    ap.add_argument("--text", default=SAMPLE, help="チャット報告の本文")
    ap.add_argument("--reporter", default="テスト太郎", help="報告者名")
    ap.add_argument("--app", default="", help="対象アプリを指定（空ならAI自動判定）")
    ap.add_argument("--image", action="append", default=[], help="添付スクショ（複数可）")
    args = ap.parse_args()

    report = Report(
        text=args.text,
        reporter=args.reporter,
        image_paths=args.image,
        forced_app=args.app,
        created_at=time.strftime("%Y-%m-%d %H:%M:%S"),
        source="manual",
    )

    print("▶ 報告を受け付けました。AI解析中…（claude CLI 呼び出し）\n")
    result = process_report(report, adapter=ManualAdapter())

    # サマリ（開発者向けの実データ確認）
    a = result.analysis
    print("── 解析結果（構造化データ） ─────────────────")
    if a:
        print(f"  対象アプリ : {a.target_app}")
        print(f"  種類       : {a.kind}")
        print(f"  優先度     : {a.priority}")
        print(f"  タイトル   : {a.title}")
    print(f"  起票        : {result.ticket.url if result.ticket else '（なし）'}")
    print(f"  メール送信  : {'送信済み' if result.mail_sent else '未送信'}")
    if result.errors:
        print("  注記        :")
        for e in result.errors:
            print(f"    - {e}")
    print("──────────────────────────────────────────")


if __name__ == "__main__":
    main()
