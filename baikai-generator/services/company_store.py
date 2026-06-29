# -*- coding: utf-8 -*-
"""自社（宅地建物取引業者・乙）情報を名称で登録・呼び出しするための簡易ストア。

data/companies.json に {登録名: プロファイル辞書} の形で保存する。
個人情報のためリポジトリには含めない（.gitignore で data/ を除外）。
"""

import json
import os

_BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DATA_DIR = os.path.join(_BASE, "data")
_PATH = os.path.join(_DATA_DIR, "companies.json")

# プロファイルが持つ項目（excel_builder の otsu と対応）
FIELDS = ["商号", "代表者", "所在地", "免許番号", "TEL", "流通機構"]


def load_all() -> dict:
    """{登録名: プロファイル} を返す。無ければ空 dict。"""
    try:
        with open(_PATH, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def save(name: str, profile: dict) -> None:
    """名称 name でプロファイルを保存（既存は上書き）。"""
    name = (name or "").strip()
    if not name:
        raise ValueError("登録名を入力してください。")
    os.makedirs(_DATA_DIR, exist_ok=True)
    data = load_all()
    data[name] = {k: (profile.get(k, "") or "").strip() for k in FIELDS}
    with open(_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def delete(name: str) -> None:
    """名称 name のプロファイルを削除。"""
    data = load_all()
    if name in data:
        del data[name]
        with open(_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)


def names() -> list:
    """登録名の一覧。"""
    return sorted(load_all().keys())
