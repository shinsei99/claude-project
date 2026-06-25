#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "=========================================="
echo "  マイソク変換ツール セットアップ & 起動"
echo "=========================================="
echo ""

# Python 確認（Homebrew arm64 優先）
PYTHON=/opt/homebrew/bin/python3.12
if ! command -v "$PYTHON" &>/dev/null; then
    PYTHON=python3
fi
echo "✅ Python: $($PYTHON --version)"

# Claude CLI 確認
if ! command -v claude &>/dev/null; then
    echo "❌ claude コマンドが見つかりません。"
    echo "   Claude Code CLI をインストールし PATH を通してください。"
    exit 1
fi
echo "✅ Claude CLI: $(claude --version 2>&1 | head -1)"

# venv セットアップ
VENV_DIR="$SCRIPT_DIR/.venv"
if [ ! -d "$VENV_DIR" ]; then
    echo "🔧 仮想環境を作成中..."
    $PYTHON -m venv "$VENV_DIR"
fi
source "$VENV_DIR/bin/activate"

# パッケージインストール
echo ""
echo "📦 依存パッケージをインストール中..."
pip install -q -r requirements.txt
echo "✅ パッケージインストール完了"

# 起動
PORT=8504
echo ""
echo "🚀 アプリを起動します（ポート: $PORT）"
echo "   ブラウザで http://localhost:$PORT を開いてください"
echo "   終了は Ctrl+C"
echo ""
streamlit run app.py --server.port "$PORT"
