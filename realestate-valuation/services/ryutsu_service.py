# -*- coding: utf-8 -*-
"""流通性比率（％）を Web調査＋手元事例から自動で割り出して提案する。

実務の決め方（例：近隣の新旧成約価格の下落率から85%）を踏まえ、
WebSearchで地域・駅・物件種別の相場動向（新築供給・価格の上昇/下落・人気度）を
調べ、手元の取引事例の成約時期や成約／売出の乖離も加味して比率を提案する。
"""

from __future__ import annotations

import json
import re
import subprocess

CLAUDE_BIN = "claude"
TIMEOUT = 420


class RyutsuError(RuntimeError):
    pass


# ── 取引事例から算出（データのみ・AI不使用） ──────────────────────────────────
_ERA = {"令和": 2018, "平成": 1988, "昭和": 1925, "R": 2018, "H": 1988, "S": 1925}


def _parse_ym(s) -> int | None:
    """『令和6年3月』『2024年3月』『R6.3』等を 年*12+月 の通し月に変換。"""
    if not s:
        return None
    s = str(s).strip().translate(str.maketrans("０１２３４５６７８９", "0123456789"))
    m = re.search(r"(令和|平成|昭和|R|H|S)\s*(\d{1,2})[年.\-/]?\s*(\d{1,2})?", s)
    if m:
        base = _ERA[m.group(1)]
        year = base + int(m.group(2))
        month = int(m.group(3)) if m.group(3) else 6
        return year * 12 + month
    m = re.search(r"(19|20)(\d{2})[年.\-/]?\s*(\d{1,2})?", s)
    if m:
        year = int(m.group(1) + m.group(2))
        month = int(m.group(3)) if m.group(3) else 6
        return year * 12 + month
    return None


def from_trades(trades, sales=None) -> dict:
    """取引事例の成約時期×単価の推移から流通性比率を算出する。

    優先：成約事例の最古→最新の単価変化率（例 1950/2300≒85%）。
    取れなければ成約／売出の乖離で代替。
    """
    pts = []
    for c in (trades or []):
        u = float(c.get("unit_price") or 0)
        ym = _parse_ym(c.get("trade_ym"))
        if u > 0 and ym:
            pts.append((ym, u))
    if len(pts) >= 2:
        pts.sort()
        (ym0, u0), (ym1, u1) = pts[0], pts[-1]
        if u0 > 0 and ym1 != ym0:
            ratio = round(u1 / u0 * 100)
            ratio = max(70, min(120, ratio))
            months = ym1 - ym0
            trend = "上昇" if ratio > 100 else ("下落" if ratio < 100 else "横ばい")
            return {
                "ratio": ratio, "basis": "取引事例の単価推移",
                "reason": (f"成約事例の最古({u0:,.0f}円/㎡)→最新({u1:,.0f}円/㎡, 約{months}ヶ月差)の"
                           f"変化率から{trend}傾向と判断し{ratio}%。"),
            }
    # 代替：成約／売出の乖離
    t = [float(c.get("unit_price") or 0) for c in (trades or []) if float(c.get("unit_price") or 0) > 0]
    s = [float(c.get("unit_price") or 0) for c in (sales or []) if float(c.get("unit_price") or 0) > 0]
    if t and s:
        ta, sa = sum(t) / len(t), sum(s) / len(s)
        ratio = max(70, min(120, round(ta / sa * 100)))
        return {
            "ratio": ratio, "basis": "成約／売出の乖離",
            "reason": (f"成約平均{ta:,.0f}円/㎡÷売出平均{sa:,.0f}円/㎡＝{ratio}%。"
                       "売出に対する成約水準から流通性を推定。"),
        }
    return {"ratio": 100, "basis": "データ不足",
            "reason": "成約時期付きの事例が2件未満のため、標準100%。手動またはWeb提案をご利用ください。"}


def _avg_unit(cases):
    vals = [float(c.get("unit_price") or 0) for c in cases if float(c.get("unit_price") or 0) > 0]
    return round(sum(vals) / len(vals)) if vals else 0


def _summary(cases, label):
    if not cases:
        return f"{label}：データなし"
    lines = []
    for c in cases[:6]:
        lines.append(
            f"・{c.get('address','')} {c.get('mansion_name','')} "
            f"{c.get('price_man','')}万円 単価{int(c.get('unit_price') or 0):,}円/㎡ "
            f"{c.get('trade_ym','') or c.get('build_ym','')}"
        )
    return f"{label}（平均単価 {_avg_unit(cases):,}円/㎡）：\n" + "\n".join(lines)


def suggest_ryutsu(*, property_type, subject, trades, sales) -> dict:
    """{"ratio": int(%), "reason": str} を返す。"""
    station = (subject.get("station") or "").strip()
    addr = (subject.get("address") or "").strip()
    t_avg, s_avg = _avg_unit(trades), _avg_unit(sales)
    gap = ""
    if t_avg and s_avg:
        gap = f"\n参考：取引事例(成約)平均 {t_avg:,}円/㎡ ／ 売出平均 {s_avg:,}円/㎡（成約/売出={t_avg/s_avg*100:.0f}%）"

    prompt = f"""あなたは不動産査定のベテランです。下記物件の「流通性比率（％）」を提案してください。
流通性比率とは、評点で出した試算価格に最後に掛ける“売れやすさ”の最終調整係数です（標準100、原則±7%＝93〜107%、特殊事情でも概ね80〜115%の範囲）。

まず **WebSearch ツールで** 次を調べてから判断してください：
- {addr}・{station or '最寄駅'} 周辺の不動産（{property_type}）の相場が上昇傾向か下落傾向か
- 新築供給の多寡（供給過多なら中古は売りにくい＝下方）、駅・地域の人気/需要の強さ
- 近年の中古成約価格の推移（分かれば下落/上昇率）

加えて手元データも加味してください：
{_summary(trades, "取引事例(成約)")}
{_summary(sales, "周辺の売出物件")}{gap}

【判断の目安】
- 人気・需要が強く流通性が高い／価格上昇傾向 → 100超（〜107%程度、特に強ければ最大115%）
- 標準的 → 100%
- 採用事例が古い・周辺が下落傾向・新築供給過多で売りにくい → 100未満（〜93%、弱ければ85%前後）

出力は次のJSONのみ（コードフェンス可、説明文は付けない）：
{{"ratio": 整数のパーセント値（例 105）, "reason": "根拠を120字以内で。調べた相場動向と手元事例の要点を含める。"}}"""

    cmd = [CLAUDE_BIN, "-p", prompt, "--output-format", "json",
           "--tools", "WebSearch WebFetch",
           "--dangerously-skip-permissions", "--model", "sonnet"]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=TIMEOUT)
    except FileNotFoundError as e:
        raise RyutsuError("`claude` コマンドが見つかりません。") from e
    except subprocess.TimeoutExpired as e:
        raise RyutsuError("提案の生成がタイムアウトしました。") from e
    if proc.returncode != 0:
        raise RyutsuError(f"Claude呼び出し失敗（{proc.returncode}）\n{proc.stderr.strip()[:300]}")
    try:
        result = json.loads(proc.stdout)
    except json.JSONDecodeError as e:
        raise RyutsuError("応答をJSONとして解釈できませんでした。") from e
    if result.get("is_error"):
        raise RyutsuError(f"Claudeがエラーを返しました: {result.get('result')}")

    raw = result.get("result", "")
    m = re.search(r"\{.*\}", raw, re.DOTALL)
    if not m:
        raise RyutsuError(f"提案を解釈できませんでした。応答: {raw[:200]}")
    obj = json.loads(m.group(0))
    ratio = int(round(float(obj.get("ratio", 100))))
    ratio = max(70, min(120, ratio))  # 安全域にクランプ
    return {"ratio": ratio, "reason": str(obj.get("reason", "")).strip()}
