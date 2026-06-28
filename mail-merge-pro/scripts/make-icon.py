#!/usr/bin/env python3
"""
make-icon.py
Mail Merge Pro のアプリアイコン(1024px)を生成する。
デザイン: 白の角丸スクエア背景に、封筒＋上に並ぶ3人（複数宛先）＋右下に
送信バッジ（紙飛行機）。青→紫グラデーション。一斉送信のイメージ。
"""
from PIL import Image, ImageDraw
import os

S = 1024


# ---- 斜めグラデーション素材（左上=青 → 右下=紫）----
def make_gradient(start, end):
    img = Image.new("RGB", (S, S))
    try:
        import numpy as np
        ys, xs = np.mgrid[0:S, 0:S]
        t = (xs + ys) / (2.0 * (S - 1))
        arr = np.zeros((S, S, 3), dtype=np.uint8)
        for c in range(3):
            arr[..., c] = (start[c] + (end[c] - start[c]) * t).astype("uint8")
        return Image.fromarray(arr, "RGB")
    except Exception:
        d = ImageDraw.Draw(img)
        for y in range(S):
            t = y / S
            col = tuple(int(start[i] + (end[i] - start[i]) * t) for i in range(3))
            d.line([(0, y), (S, y)], fill=col)
        return img


grad = make_gradient((58, 158, 226), (126, 64, 222)).convert("RGBA")

# ---- ベース（白の角丸プレート）----
base = Image.new("RGBA", (S, S), (249, 249, 251, 255))
dr = ImageDraw.Draw(base)

WHITE = (255, 255, 255, 255)
ow = int(S * 0.016)  # 白フチの太さ


def fill_grad(mask_img):
    """L マスクの白領域にグラデーションを流し込む。"""
    base.paste(grad, (0, 0), mask_img)


def silhouette_mask(draw_fn):
    """空マスクに draw_fn(d) で形を描いて返す。"""
    m = Image.new("L", (S, S), 0)
    draw_fn(ImageDraw.Draw(m))
    return m


def person(cx, hy, r):
    """頭＋肩の人型を、白フチ付きで描く。座標は 0..1 の割合。
    肩→頭の順に描くことで、頭が肩の上に白フチで分離して乗る。"""
    cx, hy, r = cx * S, hy * S, r * S
    head = [cx - r, hy - r, cx + r, hy + r]
    sw, sh = r * 1.4, r * 1.25          # 肩の半幅・半高
    scy = hy + r * 1.75                  # 肩の中心（頭の下）
    shoulders = [cx - sw, scy - sh, cx + sw, scy + sh]

    # 肩：白フチ → グラデ本体。
    dr.ellipse([shoulders[0] - ow, shoulders[1] - ow, shoulders[2] + ow, shoulders[3] + ow], fill=WHITE)
    fill_grad(silhouette_mask(lambda d: d.ellipse(shoulders, fill=255)))
    # 頭：白フチ → グラデ本体（肩の上に重ね、首元に白い分離を作る）。
    dr.ellipse([head[0] - ow, head[1] - ow, head[2] + ow, head[3] + ow], fill=WHITE)
    fill_grad(silhouette_mask(lambda d: d.ellipse(head, fill=255)))


# ---- 3人（奥→手前: 右, 左, 中央）----
person(0.61, 0.225, 0.057)
person(0.31, 0.215, 0.061)
person(0.46, 0.180, 0.072)

# ---- 封筒 ----
ex0, ey0, ex1, ey1 = S * 0.16, S * 0.42, S * 0.76, S * 0.86
rad = int(S * 0.04)
# 白フチ。
dr.rounded_rectangle([ex0 - ow, ey0 - ow, ex1 + ow, ey1 + ow], radius=rad + ow, fill=WHITE)
# グラデ本体。
fill_grad(silhouette_mask(lambda d: d.rounded_rectangle([ex0, ey0, ex1, ey1], radius=rad, fill=255)))
# フラップのV字（白）。
ecx = (ex0 + ex1) / 2
v_bottom = ey0 + (ey1 - ey0) * 0.46
lw = int(S * 0.024)
dr.line([(ex0 + ow, ey0 + ow), (ecx, v_bottom), (ex1 - ow, ey0 + ow)], fill=WHITE, width=lw, joint="curve")

# ---- 送信バッジ（紙飛行機）----
bx, by, br = S * 0.745, S * 0.735, S * 0.15
# 白フチ（封筒との隙間）。
dr.ellipse([bx - br - ow * 1.6, by - br - ow * 1.6, bx + br + ow * 1.6, by + br + ow * 1.6], fill=WHITE)
# グラデ円。
fill_grad(silhouette_mask(lambda d: d.ellipse([bx - br, by - br, bx + br, by + br], fill=255)))
# 紙飛行機（白・2枚羽）。
q = br
tip = (bx + 0.60 * q, by - 0.52 * q)
left = (bx - 0.62 * q, by - 0.02 * q)
mid = (bx - 0.10 * q, by + 0.12 * q)
tail = (bx - 0.16 * q, by + 0.56 * q)
dr.polygon([tip, left, mid], fill=WHITE)        # 上の羽
dr.polygon([tip, mid, tail], fill=WHITE)         # 下の羽

# ---- 角丸スクエアにクリップ ----
corner = Image.new("L", (S, S), 0)
ImageDraw.Draw(corner).rounded_rectangle([0, 0, S, S], radius=int(S * 0.225), fill=255)
out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
out.paste(base, (0, 0), corner)

# ---- iconset 書き出し ----
out_dir = os.path.join(os.path.dirname(__file__), "icon.iconset")
os.makedirs(out_dir, exist_ok=True)


def write(name, px):
    out.resize((px, px), Image.LANCZOS).save(os.path.join(out_dir, name))


for b in [16, 32, 128, 256, 512]:
    write(f"icon_{b}x{b}.png", b)
    write(f"icon_{b}x{b}@2x.png", b * 2)

out.resize((512, 512), Image.LANCZOS).save(os.path.join(os.path.dirname(__file__), "icon-preview.png"))
print("iconset written to", out_dir)
