# -*- coding: utf-8 -*-
"""1ファイル（PDF/画像）の向きをその場で正立補正する CLI ラッパー。

Next.js の API ルートから `python3 orient_cli.py <path>` で呼び出す想定。
PDF・画像どちらも、向きが補正された場合のみ元ファイルを上書きする。
向き判定ロジックは pdf_orient.py（共有モジュール）に委譲する。

依存が無い / 失敗しても終了コード0で安全に抜ける（解析は元ファイルで続行）。
"""

import os
import sys

IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".tif", ".tiff")


def main():
    if len(sys.argv) < 2:
        return 0
    path = sys.argv[1]
    try:
        from pdf_orient import ensure_upright_pdf, ensure_upright_image
    except Exception:
        return 0  # モジュール/依存が無ければ何もしない
    try:
        with open(path, "rb") as f:
            data = f.read()
    except Exception:
        return 0
    ext = os.path.splitext(path)[1].lower()
    try:
        if ext in IMAGE_EXTS:
            out = ensure_upright_image(data)
        else:
            out = ensure_upright_pdf(data)
    except Exception:
        return 0
    if out and out != data:
        try:
            with open(path, "wb") as f:
                f.write(out)
        except Exception:
            pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
