# -*- coding: utf-8 -*-
"""5ステップを連結するコアパイプライン。

  ①チャット受付 → ②AIマルチモーダル解析／対話ヒアリング → ③タスク自動起票
  → ④まとめメール自動送信（チャット対話履歴を同封）→ ⑤チャットへ返信

各ステップは失敗しても後続を止めない（部分的にでも受付完了を返す）。
起票やメールが落ちても、少なくともチャットには状況を返す設計。
"""

import config
from core.models import Analysis, PipelineResult, Report, Ticket
from services import claude_analyzer, mailer, ticketing, reply


def _finalize(result: PipelineResult, adapter, turns):
    """③起票 → ④メール（対話履歴同封）→ ⑤返信。analysis 確定後の共通処理。"""
    report, analysis = result.report, result.analysis

    # ③ タスク自動起票
    try:
        result.ticket = ticketing.create_ticket(report, analysis)
    except Exception as e:
        result.errors.append(f"起票に失敗（{config.TICKET_BACKEND}）: {e}")

    # ④ まとめメール自動送信（チャット対話履歴を同封）
    try:
        if mailer.is_configured():
            ticket = result.ticket or Ticket(url="", backend=config.TICKET_BACKEND)
            result.mail_sent = mailer.send_summary(report, analysis, ticket, turns)
        else:
            result.errors.append("SMTP未設定のためメール送信をスキップ")
    except Exception as e:
        result.errors.append(f"メール送信に失敗: {e}")

    # ⑤ チャットへ返信（業務口調）
    if adapter is not None:
        try:
            adapter.reply(report, reply.result_message(result))
        except Exception as e:
            result.errors.append(f"チャット返信に失敗: {e}")

    return result


def process_report(report: Report, adapter=None) -> PipelineResult:
    """単発の Report（1通の報告）を解析→起票→メール→返信まで実行する。"""
    result = PipelineResult(report=report)

    # ② AI解析
    try:
        result.analysis = claude_analyzer.analyze(
            text=report.text,
            reporter=report.reporter,
            image_paths=report.image_paths,
            forced_app=report.forced_app,
            forced_kind=report.forced_kind,
        )
    except Exception as e:  # analyze は基本例外を投げないが保険
        result.errors.append(f"AI解析に失敗: {e}")
        if adapter is not None:
            adapter.reply(report, reply.result_message(result))
        return result

    turns = reply.conversation_turns(report, result)
    return _finalize(result, adapter, turns)


def finalize_conversation(report: Report, analysis: Analysis, messages, adapter=None) -> PipelineResult:
    """対話ヒアリングで確定した analysis を受け取り、③〜⑤を実行する。

    messages: [{"role":"user"/"assistant","text":...}] の会話履歴。メールに同封する。
    """
    result = PipelineResult(report=report, analysis=analysis)
    turns = reply.turns_from_messages(report.reporter, messages)
    return _finalize(result, adapter, turns)
