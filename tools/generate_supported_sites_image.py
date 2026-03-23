"""
Supported Sites プロモーション画像を自動生成するスクリプト。

使い方:
  pip install Pillow requests
  python tools/generate_supported_sites_image.py

出力:
  tools/supported_sites.png  (1280x800 のストア用画像)

各サイトのロゴは自動的にダウンロードされ tools/logos/ に保存されます。
手動で差し替えたい場合は tools/logos/<hostname>.png を置いてから再実行してください。
"""

import os
import io
import math
import requests
from PIL import Image, ImageDraw, ImageFont

# ── サイト一覧（site-configs.js と同期） ──────────────────────────
SITES = [
    {"hostname": "chatgpt.com", "name": "ChatGPT"},
    {"hostname": "claude.ai", "name": "Claude"},
    {"hostname": "gemini.google.com", "name": "Gemini"},
    {"hostname": "copilot.microsoft.com", "name": "Copilot"},
    {"hostname": "chat.deepseek.com", "name": "DeepSeek"},
    {"hostname": "grok.com", "name": "Grok"},
    {"hostname": "www.perplexity.ai", "name": "Perplexity"},
    {"hostname": "chat.mistral.ai", "name": "Mistral"},
    {"hostname": "notebooklm.google.com", "name": "NotebookLM"},
    {"hostname": "github.com", "name": "GitHub Copilot"},
    {"hostname": "poe.com", "name": "Poe"},
    {"hostname": "v0.dev", "name": "v0"},
    {"hostname": "cursor.com", "name": "Cursor"},
]

# ── 設定 ──────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LOGO_DIR = os.path.join(SCRIPT_DIR, "logos")
OUTPUT_PATH = os.path.join(SCRIPT_DIR, "supported_sites.png")

# 画像サイズ（Chrome Web Store プロモーション画像 1280x800）
IMG_W, IMG_H = 1280, 800
BG_COLOR = (24, 24, 27)  # ダークグレー背景
TITLE_COLOR = (255, 255, 255)
TILE_BG = (255, 255, 255)
TILE_RADIUS = 28
TILE_SIZE = 150  # 各タイルのサイズ
LOGO_SIZE = 105  # タイル内のロゴサイズ
TILE_GAP = 24    # タイル間のギャップ


def ensure_dir(path):
    os.makedirs(path, exist_ok=True)


# サイトごとの高品質ロゴ直接URL
DIRECT_LOGO_URLS = {
    "github.com": [
        "https://github.githubassets.com/favicons/favicon.png",
        "https://github.com/fluidicon.png",
    ],
    "notebooklm.google.com": [
        "https://www.gstatic.com/lamda/images/notebooklm_icon_light_7a2e1535014122e5f74a.png",
        "https://notebooklm.google.com/favicon.ico",
        "https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://notebooklm.google.com&size=256",
    ],
    "m365.cloud.microsoft": [
        "https://res.cdn.office.net/officehub/images/content/images/favicon_copilot-b01e498a56.ico",
        "https://copilot.microsoft.com/favicon.ico",
        "https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://m365.cloud.microsoft/chat&size=256",
    ],
}


def download_logo(hostname: str, dest_path: str) -> bool:
    """複数ソースからロゴをダウンロード"""
    # サイト固有のURLを優先
    direct = DIRECT_LOGO_URLS.get(hostname, [])
    sources = direct + [
        # Google の高解像度 favicon サービス
        f"https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://{hostname}&size=128",
        # DuckDuckGo のアイコンサービス
        f"https://icons.duckduckgo.com/ip3/{hostname}.ico",
        # 直接 favicon
        f"https://{hostname}/favicon.ico",
    ]

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }

    for url in sources:
        try:
            resp = requests.get(url, headers=headers, timeout=10)
            if resp.status_code == 200 and len(resp.content) > 100:
                img = Image.open(io.BytesIO(resp.content))
                # RGBA に変換して PNG 保存
                img = img.convert("RGBA")
                # 最大サイズにリサイズ（小さい場合はそのまま）
                if img.width < 64 or img.height < 64:
                    continue  # 小さすぎるアイコンはスキップ
                img.save(dest_path, "PNG")
                print(f"  ✓ {hostname} ({img.width}x{img.height}) from {url[:60]}...")
                return True
        except Exception as e:
            continue

    print(f"  ✗ {hostname} — ロゴ取得失敗（手動で tools/logos/{hostname}.png を配置してください）")
    return False


def load_logo(hostname: str) -> Image.Image | None:
    """ロゴを読み込み"""
    path = os.path.join(LOGO_DIR, f"{hostname}.png")
    if not os.path.exists(path):
        download_logo(hostname, path)
    if os.path.exists(path):
        return Image.open(path).convert("RGBA")
    return None


def make_rounded_rect(size, radius, color):
    """角丸四角形の画像を生成"""
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle([(0, 0), (size[0] - 1, size[1] - 1)],
                           radius=radius, fill=color)
    return img


def get_font(size):
    """フォントを取得（システムにあるものを使用）"""
    font_candidates = [
        "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for font_path in font_candidates:
        if os.path.exists(font_path):
            return ImageFont.truetype(font_path, size)
    return ImageFont.load_default()


def generate_image():
    ensure_dir(LOGO_DIR)

    print("ロゴをダウンロード中...")
    logos = {}
    for site in SITES:
        logo = load_logo(site["hostname"])
        if logo:
            logos[site["hostname"]] = logo

    # グリッドレイアウト計算
    n = len(SITES)
    cols = 7  # 1行あたりのアイコン数
    rows = math.ceil(n / cols)

    # グリッドの全幅・全高
    grid_w = cols * TILE_SIZE + (cols - 1) * TILE_GAP
    grid_h = rows * TILE_SIZE + (rows - 1) * TILE_GAP

    # キャンバス作成
    canvas = Image.new("RGBA", (IMG_W, IMG_H), BG_COLOR)
    draw = ImageDraw.Draw(canvas)

    # タイトル描画
    title_font = get_font(68)
    title_text = "Supported Sites"
    bbox = draw.textbbox((0, 0), title_text, font=title_font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    title_y = 60
    draw.text(((IMG_W - tw) // 2, title_y), title_text, fill=TITLE_COLOR, font=title_font)

    # グリッド開始位置（タイトル含めて全体を縦中央に配置）
    total_content_h = th + 50 + grid_h  # タイトル + 間隔 + グリッド
    content_start_y = (IMG_H - total_content_h) // 2
    # タイトルを再描画（中央寄せ後の位置）
    draw.rectangle([(0, 0), (IMG_W, IMG_H)], fill=BG_COLOR)  # 背景リセット
    draw.text(((IMG_W - tw) // 2, content_start_y), title_text, fill=TITLE_COLOR, font=title_font)
    start_x = (IMG_W - grid_w) // 2
    start_y = content_start_y + th + 50

    # 中央揃え（最終行のアイテムが少ない場合）
    for idx, site in enumerate(SITES):
        row = idx // cols
        col = idx % cols

        # 最終行の中央揃え
        items_in_row = min(cols, n - row * cols)
        row_w = items_in_row * TILE_SIZE + (items_in_row - 1) * TILE_GAP
        row_x = (IMG_W - row_w) // 2

        x = row_x + col * (TILE_SIZE + TILE_GAP)
        y = start_y + row * (TILE_SIZE + TILE_GAP)

        # タイル背景（角丸）
        tile = make_rounded_rect((TILE_SIZE, TILE_SIZE), TILE_RADIUS, TILE_BG)
        canvas.paste(tile, (x, y), tile)

        # ロゴ
        hostname = site["hostname"]
        if hostname in logos:
            logo = logos[hostname].copy()
            logo = logo.resize((LOGO_SIZE, LOGO_SIZE), Image.LANCZOS)
            lx = x + (TILE_SIZE - LOGO_SIZE) // 2
            ly = y + (TILE_SIZE - LOGO_SIZE) // 2
            canvas.paste(logo, (lx, ly), logo)
        else:
            # ロゴなしの場合、名前の頭文字を表示
            letter_font = get_font(40)
            letter = site["name"][0]
            lbbox = draw.textbbox((0, 0), letter, font=letter_font)
            lw = lbbox[2] - lbbox[0]
            lh = lbbox[3] - lbbox[1]
            draw.text(
                (x + (TILE_SIZE - lw) // 2, y + (TILE_SIZE - lh) // 2),
                letter,
                fill=(150, 150, 150),
                font=letter_font,
            )

    # PNG出力
    canvas = canvas.convert("RGB")
    canvas.save(OUTPUT_PATH, "PNG", quality=95)
    print(f"\n画像を保存しました: {OUTPUT_PATH}")
    print(f"サイズ: {IMG_W}x{IMG_H}")
    print(f"\nロゴが欠けている場合は tools/logos/<hostname>.png に手動配置して再実行してください。")


if __name__ == "__main__":
    generate_image()
