# -*- coding: utf-8 -*-
"""まとめ（報告書）メール送信モジュール。

起票完了直後に、対話から作成した報告書を開発チーム宛に送る。送信方式は2つ:
- applescript（既定）: Mac のメールアプリ(Apple Mail)に下書きを作成して表示。
                       ユーザーが内容を確認して「送信」ボタンで送る。認証情報不要。
- smtp              : smtplib で自動送信（SMTP設定が必要）。

- 件名: 【AI起票】[優先度] [アプリ名] AIが生成したタイトル
- 本文: HTML＋プレーンテキスト（SMTP時）／プレーンテキスト（メールアプリ下書き時）。
機密（SMTPパスワード等）は config 経由で .env から読み込む。
"""

import os
import smtplib
import subprocess
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr

import config
from core.models import Analysis, Report, Ticket

_APPLESCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mail_draft.applescript")


PRIORITY_COLOR = {"高": "#d32f2f", "中": "#f57c00", "低": "#388e3c"}


def _subject(a: Analysis) -> str:
    return f"【AI起票】[{a.priority}] [{a.target_app}] {a.title}"


def _doc_title(a: Analysis) -> str:
    """要件区分に応じた報告書のタイトル。"""
    if a.kind in ("致命的な不具合", "軽微な不具合"):
        return "障害受付報告書"
    if a.kind == "機能要望":
        return "改善要望 受付報告書"
    if a.kind == "新アプリ希望":
        return "新アプリ企画 受付報告書"
    return "受付報告書"


def _esc(s: str) -> str:
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _conversation_html(turns) -> str:
    if not turns:
        return ""
    rows = []
    for speaker, msg in turns:
        is_bot = speaker == "AI受付"
        bg = "#eef3fb" if is_bot else "#f6f6f6"
        align = "right" if is_bot else "left"
        rows.append(
            f'<div style="text-align:{align};margin:6px 0;">'
            f'<div style="display:inline-block;max-width:82%;text-align:left;background:{bg};'
            f'border-radius:10px;padding:8px 12px;font-size:13px;">'
            f'<div style="font-size:11px;color:#888;margin-bottom:2px;">{_esc(speaker)}</div>'
            f'{_esc(msg).replace(chr(10), "<br>")}</div></div>'
        )
    return "".join(rows)


def _html_body(report: Report, a: Analysis, ticket: Ticket, turns=None) -> str:
    color = PRIORITY_COLOR.get(a.priority, "#555")
    summary_html = a.summary.replace("\n", "<br>")
    cause_html = (a.cause_guess or "（なし）").replace("\n", "<br>")
    advice_html = (a.advice or "（なし）").replace("\n", "<br>")
    shots = f"{len(report.image_paths)}枚" if report.image_paths else "なし"
    convo = _conversation_html(turns)
    convo_block = (
        f'<div style="font-weight:bold;border-left:4px solid #455a64;padding-left:8px;'
        f'margin:18px 0 6px;">参考：受付時のやり取り（対話全文）</div>'
        f'<div style="background:#fff;border:1px solid #eee;border-radius:8px;padding:10px;">{convo}</div>'
    ) if convo else ""
    doc_title = _doc_title(a)
    return f"""<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,'Hiragino Sans',sans-serif;color:#222;line-height:1.6;">
  <div style="max-width:680px;margin:0 auto;border:1px solid #e0e0e0;border-radius:10px;overflow:hidden;">
    <div style="background:{color};color:#fff;padding:14px 20px;">
      <div style="font-size:13px;opacity:.9;">{doc_title}</div>
      <div style="font-size:19px;font-weight:bold;margin-top:2px;">[優先度 {a.priority}] {a.title}</div>
    </div>
    <div style="padding:20px;">
      <div style="font-size:12px;color:#888;margin-bottom:14px;">
        本報告書は、AI受付が報告者との対話内容をもとに作成したものです。
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px;">
        <tr><td style="padding:6px 8px;background:#fafafa;width:120px;font-weight:bold;">チケット</td>
            <td style="padding:6px 8px;"><a href="{ticket.url}" style="color:#1565c0;">{ticket.url or "（起票なし）"}</a></td></tr>
        <tr><td style="padding:6px 8px;background:#fafafa;font-weight:bold;">対象アプリ</td>
            <td style="padding:6px 8px;">{a.target_app}</td></tr>
        <tr><td style="padding:6px 8px;background:#fafafa;font-weight:bold;">種類 / 優先度</td>
            <td style="padding:6px 8px;">{a.kind} / <b style="color:{color};">{a.priority}</b></td></tr>
        <tr><td style="padding:6px 8px;background:#fafafa;font-weight:bold;">報告者</td>
            <td style="padding:6px 8px;">{report.reporter}</td></tr>
        <tr><td style="padding:6px 8px;background:#fafafa;font-weight:bold;">受付日時</td>
            <td style="padding:6px 8px;">{report.created_at}</td></tr>
        <tr><td style="padding:6px 8px;background:#fafafa;font-weight:bold;">スクショ</td>
            <td style="padding:6px 8px;">{shots}（{report.source} 受信）</td></tr>
      </table>

      <div style="font-weight:bold;border-left:4px solid {color};padding-left:8px;margin:14px 0 6px;">1. 概要・現象</div>
      <div style="background:#fafafa;padding:12px;border-radius:6px;font-size:14px;">{summary_html}</div>

      <div style="font-weight:bold;border-left:4px solid #7b1fa2;padding-left:8px;margin:18px 0 6px;">2. AIによる考察</div>
      <div style="font-size:14px;margin-bottom:8px;"><b>初期原因の推測</b><br>{cause_html}</div>
      <div style="font-size:14px;"><b>開発者への暫定対策アドバイス</b><br>{advice_html}</div>

      {convo_block}
    </div>
    <div style="background:#fafafa;padding:10px 20px;font-size:12px;color:#888;">
      このメールは「AI受付＆起票カウンター」により自動送信されました。
    </div>
  </div>
</body></html>"""


def _text_convo(turns) -> str:
    if not turns:
        return ""
    lines = ["", "── 参考：受付時のやり取り（対話全文） ──"]
    for speaker, msg in turns:
        lines.append(f"[{speaker}]")
        lines.append(msg)
        lines.append("")
    return "\n".join(lines)


def _text_body(report: Report, a: Analysis, ticket: Ticket, turns=None) -> str:
    return f"""■ {_doc_title(a)} ■
{a.title}

本報告書は、AI受付が報告者との対話内容をもとに作成したものです。

・チケット　: {ticket.url or "（起票なし）"}
・対象アプリ: {a.target_app}
・種類/優先度: {a.kind} / {a.priority}
・報告者　　: {report.reporter}
・受付日時　: {report.created_at}（{report.source} 受信）

── 1. 概要・現象 ──
{a.summary}

── 2. AIによる考察｜初期原因の推測 ──
{a.cause_guess or "（なし）"}

── 2. AIによる考察｜暫定対策アドバイス ──
{a.advice or "（なし）"}
{_text_convo(turns)}
-- このメールは「AI受付＆起票カウンター」により自動送信されました。
"""


def is_configured() -> bool:
    """メール送信（下書き作成）が可能かどうか。"""
    if config.MAIL_BACKEND == "applescript":
        return True  # osascript は macOS 標準。宛先未設定でも下書きは作れる
    return bool(config.SMTP_HOST and config.SMTP_USER and config.MAIL_TO)


def send_summary(report: Report, analysis: Analysis, ticket: Ticket, turns=None) -> bool:
    """報告書メールを送る。方式は config.MAIL_BACKEND で分岐。成功で True。失敗は例外。"""
    if config.MAIL_BACKEND == "applescript":
        return _open_mail_draft(report, analysis, ticket, turns)
    return _send_smtp(report, analysis, ticket, turns)


def _open_mail_draft(report: Report, analysis: Analysis, ticket: Ticket, turns=None) -> bool:
    """Apple Mail に下書きを作成して表示する（osascript）。ユーザーが確認後に送信。"""
    body = _text_body(report, analysis, ticket, turns)
    to = ",".join(config.MAIL_TO)
    try:
        proc = subprocess.run(
            ["osascript", _APPLESCRIPT, _subject(analysis), body, to],
            capture_output=True, text=True, timeout=30,
        )
    except FileNotFoundError as e:
        raise RuntimeError("osascript が見つかりません（macOS 以外では applescript 方式は使えません）。") from e
    if proc.returncode != 0:
        raise RuntimeError(f"メールアプリの起動に失敗しました: {(proc.stderr or '').strip()[:200]}")
    return True


def _send_smtp(report: Report, analysis: Analysis, ticket: Ticket, turns=None) -> bool:
    if not (config.SMTP_HOST and config.SMTP_USER and config.MAIL_TO):
        raise RuntimeError("SMTP 設定（SMTP_HOST / SMTP_USER / MAIL_TO）が未設定です。")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = _subject(analysis)
    msg["From"] = formataddr(("AI受付カウンター", config.MAIL_FROM))
    msg["To"] = ", ".join(config.MAIL_TO)
    msg.attach(MIMEText(_text_body(report, analysis, ticket, turns), "plain", "utf-8"))
    msg.attach(MIMEText(_html_body(report, analysis, ticket, turns), "html", "utf-8"))

    with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=30) as server:
        if config.SMTP_USE_TLS:
            server.starttls()
        if config.SMTP_PASSWORD:
            server.login(config.SMTP_USER, config.SMTP_PASSWORD)
        server.sendmail(config.MAIL_FROM, config.MAIL_TO, msg.as_string())
    return True
