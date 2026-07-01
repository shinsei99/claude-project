# -*- coding: utf-8 -*-
"""チャット返信文（業務口調）と、メールに載せる対話履歴の組み立て。

受付AIは丁寧・簡潔な業務口調で応答する。実処理（起票・メール）は他モジュールが
行い、ここは *表示メッセージ* と *対話履歴* だけを担当する。
"""

import config
from core.models import Analysis, PipelineResult, Report, Ticket

BOT_NAME = "AI受付"


def acknowledge(reporter: str) -> str:
    """報告受信直後にスレッドへ返す第一声（解析前）。"""
    who = f"{reporter} さん、" if reporter and reporter != "不明" else ""
    return (
        f"{who}ご報告ありがとうございます。\n"
        "内容を確認し、担当チームへの起票と通知を行います。少々お待ちください。"
    )


def _result_lines(result: PipelineResult, include_status: bool = True):
    """解析結果の本文行（チャット返信・対話履歴で共用）。"""
    a: Analysis = result.analysis
    t: Ticket = result.ticket
    if a is None:
        return ["申し訳ありません。内容をうまく解析できませんでした。",
                "お手数ですが、対象アプリと症状をもう一度お知らせください。"]

    lines = [
        "受付が完了しました。以下の内容で起票しました。",
        "",
        f"・対象アプリ：{a.target_app}",
        f"・種類　　　：{a.kind}",
        f"・優先度　　：{a.priority}",
        f"・件名　　　：{a.title}",
    ]
    if not include_status:
        return lines

    if t and t.url:
        lines += ["", f"・チケット　：{t.url}"]
    else:
        lines += ["", "・チケット　：作成できませんでした（後ほどご確認ください）"]
    if result.mail_sent:
        if config.MAIL_BACKEND == "applescript":
            lines += ["・報告書メール：メールアプリに下書きを作成しました（内容を確認して送信してください）"]
        else:
            lines += ["・報告書メール：開発チームへ送信しました"]
    else:
        lines += ["・報告書メール：作成していません（設定をご確認ください）"]
    if result.errors:
        lines += ["", "※補足："] + [f"　- {e}" for e in result.errors]
    return lines


def result_message(result: PipelineResult) -> str:
    """5ステップ完了後にスレッドへ返す業務口調のまとめ。"""
    return "\n".join(_result_lines(result, include_status=True))


def conversation_turns(report: Report, result: PipelineResult):
    """単発報告用：メールに載せる『チャット対話履歴』を組み立てる（擬似3ターン）。"""
    turns = [
        (report.reporter or "報告者", report.text or "(本文なし)"),
        (BOT_NAME, acknowledge(report.reporter)),
        (BOT_NAME, "\n".join(_result_lines(result, include_status=True))),
    ]
    return turns


def turns_from_messages(reporter: str, messages):
    """対話ヒアリング用：実際のチャット履歴を (話者, 発言) のリストに変換する。"""
    turns = []
    for m in messages or []:
        speaker = BOT_NAME if m.get("role") == "assistant" else (reporter or "報告者")
        turns.append((speaker, m.get("text", "")))
    return turns
