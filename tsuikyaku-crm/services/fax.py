# -*- coding: utf-8 -*-
"""eFAX 連携（email-to-fax ゲートウェイ方式）と送付リスト出力。

eFAX はメール送信でFAXを送れる：宛先を `{FAX番号}@{ゲートウェイドメイン}` にすると、
本文（と添付PDF）がその番号にFAX送信される。ドメインやSMTPは設定画面で登録する。

送信できない環境（設定未登録など）でも使えるよう、送付先＋文面のCSV書き出しも用意。
実際のeFAX一括送信ポータルにアップロードして使う想定。
"""

from __future__ import annotations   # Python 3.9 で `tuple | None` 等を使うため

import csv
import io
import smtplib
from email.message import EmailMessage

import db


def gateway_address(fax_dial: str) -> str:
    """eFAX宛先アドレスを組み立てる。

    eFAXは国際形式が必要なため、国番号(既定81)を使い先頭の0を置き換える。
    例: 0663530280 → 81663530280@efaxsend.com
    """
    domain = db.get_setting("efax_gateway", "efaxsend.com")
    cc = db.get_setting("efax_country_code", "81")
    d = fax_dial or ""
    if cc and d.startswith("0"):
        d = cc + d[1:]          # 先頭の0を国番号に置換
    return f"{d}@{domain}"


def smtp_config() -> dict:
    return {
        "host": db.get_setting("smtp_host", ""),
        "port": int(db.get_setting("smtp_port", "587") or 587),
        "user": db.get_setting("smtp_user", ""),
        "password": db.get_setting("smtp_password", ""),
        "from": db.get_setting("smtp_from", ""),
        "use_tls": db.get_setting("smtp_tls", "1") == "1",
    }


def smtp_ready() -> bool:
    c = smtp_config()
    return bool(c["host"] and c["user"] and c["from"])


def _fill(template: str, cust: dict) -> str:
    """文面テンプレの差し込み。{会社名}{宛名}{先方担当} 等を置換。

    {宛名} は呼び出し側で『ご担当者様』または『◯◯ 様』を入れておく。
    """
    out = template
    for key in ("会社名", "宛名", "自社情報", "店名", "先方担当",
                "種別", "希望エリア", "希望坪数"):
        out = out.replace("{" + key + "}", str(cust.get(key) or ""))
    return out


def send_broadcast(recipients: list[dict], subject: str, body_template: str,
                   attachment: tuple | None = None):
    """eFAXメール送信で一括FAX。

    recipients: [{id, 会社名, 店名, fax_dial, ...}, ...]
    attachment: (filename, bytes, mime_subtype) or None
    戻り値: [{id, 会社名, fax_dial, ok, error}]
    """
    cfg = smtp_config()
    results = []
    server = None
    try:
        server = smtplib.SMTP(cfg["host"], cfg["port"], timeout=30)
        if cfg["use_tls"]:
            server.starttls()
        if cfg["password"]:
            server.login(cfg["user"], cfg["password"])
    except Exception as e:                       # 接続段階で失敗 → 全件エラー
        for r in recipients:
            results.append({"id": r["id"], "会社名": r.get("会社名"),
                            "fax_dial": r.get("fax_dial"), "ok": False,
                            "error": f"SMTP接続失敗: {e}"})
        return results

    for r in recipients:
        try:
            if not r.get("fax_dial"):
                raise ValueError("FAX番号なし")
            msg = EmailMessage()
            msg["From"] = cfg["from"]
            msg["To"] = gateway_address(r["fax_dial"])
            msg["Subject"] = subject
            msg.set_content(_fill(body_template, r))
            if attachment:
                fn, data, sub = attachment
                msg.add_attachment(data, maintype="application",
                                   subtype=sub, filename=fn)
            server.send_message(msg)
            results.append({"id": r["id"], "会社名": r.get("会社名"),
                            "fax_dial": r.get("fax_dial"), "ok": True, "error": ""})
        except Exception as e:
            results.append({"id": r["id"], "会社名": r.get("会社名"),
                            "fax_dial": r.get("fax_dial"), "ok": False,
                            "error": str(e)})
    try:
        server.quit()
    except Exception:
        pass
    return results


def export_csv(recipients: list[dict], body_template: str) -> bytes:
    """eFAXポータル一括送信用の送付先CSV（会社名/FAX番号/差し込み済み文面）。"""
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["会社名", "店名", "FAX番号", "文面"])
    for r in recipients:
        w.writerow([r.get("会社名", ""), r.get("店名", ""),
                    r.get("fax_dial", ""), _fill(body_template, r)])
    return buf.getvalue().encode("utf-8-sig")   # Excelで開ける BOM 付き
