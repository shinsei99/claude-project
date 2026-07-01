# -*- coding: utf-8 -*-
"""起票アダプタ。TICKET_BACKEND に応じて起票先を切り替える。

対応: github（gh CLI / REST）, notion, backlog, excel（CSVローカル・オフライン検証用）。
環境に合わせて .env の TICKET_BACKEND を変えるだけで差し替え可能。
どのバックエンドも Ticket(url, id, backend) を返す。失敗時は例外を投げる。
"""

import csv
import json
import os
import shutil
import subprocess

import config
from core.models import Analysis, Report, Ticket


PRIORITY_LABEL = {"高": "priority:high", "中": "priority:mid", "低": "priority:low"}
KIND_LABEL = {
    "致命的な不具合": "bug:critical",
    "軽微な不具合": "bug:minor",
    "機能要望": "enhancement",
    "新アプリ希望": "new-app",
    "質問・その他": "question",
}


def _issue_body(report: Report, a: Analysis) -> str:
    """起票チケットの本文（Markdown）。メール本文とほぼ共通の内容。"""
    imgs = f"\n添付スクリーンショット: {len(report.image_paths)}枚" if report.image_paths else ""
    return f"""## 概要
{a.summary}

## メタ情報
- **対象アプリ**: {a.target_app}
- **投稿種類**: {a.kind}
- **優先度**: {a.priority}
- **報告者**: {report.reporter}
- **発生日時**: {report.created_at}
- **受信元**: {report.source}{imgs}

## 🤖 AIの考察
**初期原因の推測**
{a.cause_guess or "（なし）"}

**暫定対応アドバイス**
{a.advice or "（なし）"}

---
*このチケットは「AI受付＆起票カウンター」により自動生成されました。*
"""


# ── GitHub Issues ─────────────────────────────────────────────────────
def _create_github(report: Report, a: Analysis, title: str, body: str) -> Ticket:
    repo = config.GITHUB_REPO
    labels = [KIND_LABEL.get(a.kind, ""), PRIORITY_LABEL.get(a.priority, "")]
    labels = [l for l in labels if l]

    # 1) gh CLI があれば最優先（認証済みならトークン不要）
    if shutil.which("gh"):
        cmd = ["gh", "issue", "create", "--repo", repo, "--title", title, "--body", body]
        for l in labels:
            cmd += ["--label", l]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if proc.returncode == 0:
            url = proc.stdout.strip().splitlines()[-1] if proc.stdout.strip() else ""
            num = url.rsplit("/", 1)[-1] if url else ""
            return Ticket(url=url, id=num, backend="github")
        # ラベル未作成などで失敗した場合はラベル無しで再試行
        proc2 = subprocess.run(
            ["gh", "issue", "create", "--repo", repo, "--title", title, "--body", body],
            capture_output=True, text=True, timeout=60,
        )
        if proc2.returncode == 0:
            url = proc2.stdout.strip().splitlines()[-1]
            return Ticket(url=url, id=url.rsplit("/", 1)[-1], backend="github")
        raise RuntimeError(f"gh issue create 失敗: {proc.stderr.strip()[:300]}")

    # 2) gh が無ければ REST API（GITHUB_TOKEN 必須）
    if not config.GITHUB_TOKEN:
        raise RuntimeError("gh CLI も GITHUB_TOKEN も無いため GitHub 起票できません。")
    import requests
    r = requests.post(
        f"https://api.github.com/repos/{repo}/issues",
        headers={"Authorization": f"Bearer {config.GITHUB_TOKEN}",
                 "Accept": "application/vnd.github+json"},
        json={"title": title, "body": body, "labels": labels},
        timeout=30,
    )
    r.raise_for_status()
    d = r.json()
    return Ticket(url=d["html_url"], id=str(d["number"]), backend="github")


# ── Notion ────────────────────────────────────────────────────────────
def _create_notion(report: Report, a: Analysis, title: str, body: str) -> Ticket:
    import requests
    if not (config.NOTION_TOKEN and config.NOTION_DATABASE_ID):
        raise RuntimeError("NOTION_TOKEN / NOTION_DATABASE_ID が未設定です。")
    headers = {
        "Authorization": f"Bearer {config.NOTION_TOKEN}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
    }
    payload = {
        "parent": {"database_id": config.NOTION_DATABASE_ID},
        "properties": {
            # DB 側に同名プロパティが必要（Name=title, 他は select/rich_text）
            "Name": {"title": [{"text": {"content": title}}]},
            "対象アプリ": {"select": {"name": a.target_app}},
            "種類": {"select": {"name": a.kind}},
            "優先度": {"select": {"name": a.priority}},
            "報告者": {"rich_text": [{"text": {"content": report.reporter}}]},
        },
        # 本文はページ本体に段落として入れる（長文でも安全）
        "children": [{
            "object": "block", "type": "paragraph",
            "paragraph": {"rich_text": [{"text": {"content": body[:1900]}}]},
        }],
    }
    r = requests.post("https://api.notion.com/v1/pages", headers=headers,
                      data=json.dumps(payload), timeout=30)
    r.raise_for_status()
    d = r.json()
    return Ticket(url=d.get("url", ""), id=d.get("id", ""), backend="notion")


# ── Backlog ───────────────────────────────────────────────────────────
def _create_backlog(report: Report, a: Analysis, title: str, body: str) -> Ticket:
    import requests
    for k in ("BACKLOG_SPACE", "BACKLOG_API_KEY", "BACKLOG_PROJECT_ID", "BACKLOG_ISSUE_TYPE_ID"):
        if not getattr(config, k):
            raise RuntimeError(f"{k} が未設定です。")
    url = f"https://{config.BACKLOG_SPACE}.backlog.jp/api/v2/issues"
    # Backlog 優先度ID: 2=高,3=中,4=低（スペース既定値。必要なら .env で上書き）
    prio_map = {"高": 2, "中": 3, "低": 4}
    data = {
        "projectId": config.BACKLOG_PROJECT_ID,
        "issueTypeId": config.BACKLOG_ISSUE_TYPE_ID,
        "priorityId": config.BACKLOG_PRIORITY_ID or prio_map.get(a.priority, 3),
        "summary": title,
        "description": body,
    }
    r = requests.post(url, params={"apiKey": config.BACKLOG_API_KEY}, data=data, timeout=30)
    r.raise_for_status()
    d = r.json()
    key = d.get("issueKey", "")
    return Ticket(
        url=f"https://{config.BACKLOG_SPACE}.backlog.jp/view/{key}",
        id=key, backend="backlog",
    )


# ── Excel / CSV（ローカル・オフライン検証用） ─────────────────────────
def _create_excel(report: Report, a: Analysis, title: str, body: str) -> Ticket:
    os.makedirs(config.DATA_DIR, exist_ok=True)
    path = os.path.join(config.DATA_DIR, "tickets.csv")
    new_file = not os.path.exists(path)
    # 連番採番
    num = 1
    if not new_file:
        with open(path, encoding="utf-8") as f:
            num = sum(1 for _ in f)  # ヘッダ込みの行数 ≒ 次の連番
    with open(path, "a", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        if new_file:
            w.writerow(["ID", "日時", "対象アプリ", "種類", "優先度",
                        "タイトル", "報告者", "概要", "原因推測", "アドバイス"])
        w.writerow([num, report.created_at, a.target_app, a.kind, a.priority,
                    title, report.reporter, a.summary, a.cause_guess, a.advice])
    return Ticket(url=f"file://{path}#{num}", id=str(num), backend="excel")


_BACKENDS = {
    "github": _create_github,
    "notion": _create_notion,
    "backlog": _create_backlog,
    "excel": _create_excel,
}


def create_ticket(report: Report, analysis: Analysis) -> Ticket:
    """設定された TICKET_BACKEND でチケットを作成して Ticket を返す。"""
    backend = config.TICKET_BACKEND
    fn = _BACKENDS.get(backend)
    if fn is None:
        raise RuntimeError(f"未対応の TICKET_BACKEND: {backend}")
    title = f"[{analysis.target_app}] {analysis.title}"
    body = _issue_body(report, analysis)
    return fn(report, analysis, title, body)
