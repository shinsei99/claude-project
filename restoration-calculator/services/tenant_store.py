"""入居者（賃借人）情報の保存・読み込み。

入居者を氏名で data/tenants.csv に保存し、氏名で呼び出せるようにする。
物件情報とは独立して管理する（同じ入居者を別物件でも使える）。
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd


DATA_DIR = Path(__file__).resolve().parent.parent / "data"
TENANTS_CSV = DATA_DIR / "tenants.csv"

TENANT_FIELDS = ["name", "contact"]


def load_tenants() -> pd.DataFrame:
    if TENANTS_CSV.exists():
        df = pd.read_csv(TENANTS_CSV, dtype=str).fillna("")
        for f in TENANT_FIELDS:
            if f not in df.columns:
                df[f] = ""
        return df[TENANT_FIELDS]
    return pd.DataFrame(columns=TENANT_FIELDS)


def save_tenant(data: dict) -> None:
    """同名の入居者は上書き保存する。"""
    DATA_DIR.mkdir(exist_ok=True)
    df = load_tenants()
    df = df[df["name"] != data["name"]]
    row = {f: data.get(f, "") for f in TENANT_FIELDS}
    df = pd.concat([df, pd.DataFrame([row])], ignore_index=True)
    df.to_csv(TENANTS_CSV, index=False)


def delete_tenant(name: str) -> None:
    df = load_tenants()
    df = df[df["name"] != name]
    df.to_csv(TENANTS_CSV, index=False)
