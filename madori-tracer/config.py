"""APIキー設定。

優先順位:
  1) 環境変数 GEMINI_API_KEY
  2) 同フォルダの .secret_key ファイル（gitignore 済み・各PCローカル管理）

実キーはリポジトリにコミットしない。各PCで .secret_key を置くか
環境変数を設定すること。
"""
import os
from pathlib import Path

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()

if not GEMINI_API_KEY:
    _secret = Path(__file__).with_name(".secret_key")
    if _secret.exists():
        GEMINI_API_KEY = _secret.read_text(encoding="utf-8").strip()
