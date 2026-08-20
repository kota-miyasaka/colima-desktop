#!/usr/bin/env bash
# PNG画像から、アプリアイコンとトレイアイコンを生成して差し替える。
#   - アプリアイコン: macOS標準の角丸スクワークルに配置 → src-tauri/icons/ 一式(icon.icns含む)
#   - トレイアイコン: 白背景を透過した44x44 PNG(色情報も保持) → src-tauri/icons/tray-icon.png
#     (実行時に tauri::image::Image::from_bytes() でデコードされ、icon_as_template(true) により
#      macOSメニューバー上では白黒シルエットとして表示される。色を保持しているのは他用途に転用しやすくするため)
#
# 使い方:
#   # 1枚を両方に使う場合
#   bash .claude/skills/replace-app-icon/scripts/generate-icons.sh <画像.png>
#   # アプリ用とトレイ用に別画像を使う場合（第1=アプリ用, 第2=トレイ用）
#   bash .claude/skills/replace-app-icon/scripts/generate-icons.sh <アプリ用.png> <トレイ用.png>
#   # 片方だけ差し替えたい場合は、差し替えない側に none を渡す
#   bash .claude/skills/replace-app-icon/scripts/generate-icons.sh <アプリ用.png> none   # アプリのみ
#   bash .claude/skills/replace-app-icon/scripts/generate-icons.sh none <トレイ用.png>   # トレイのみ
#
# 依存: sips(macOS標準), python3, プロジェクトの @tauri-apps/cli
set -euo pipefail

# プロジェクトルートへ移動（このスクリプトは .claude/skills/replace-app-icon/scripts/ 配下）
cd "$(dirname "$0")/../../../.."

APP_SRC="${1:?使い方: generate-icons.sh <アプリ用画像> [トレイ用画像]（片方だけなら他方に none）}"
TRAY_SRC="${2:-$APP_SRC}"   # 第2引数を省略したら1枚運用（アプリ用と同じ画像）

# none を渡した側はスキップ（例: アプリのみ差し替え = 第2引数 none）
[ "$APP_SRC"  = "none" ] && DO_APP=0  || DO_APP=1
[ "$TRAY_SRC" = "none" ] && DO_TRAY=0 || DO_TRAY=1
[ "$DO_APP$DO_TRAY" = "00" ] && { echo "アプリ用・トレイ用の両方が none です。少なくとも片方に画像を指定してください。" >&2; exit 1; }

# 実際に使う画像だけ存在チェック
[ "$DO_APP"  = 1 ] && { [ -f "$APP_SRC" ]  || { echo "アプリ用画像が見つかりません: $APP_SRC" >&2; exit 1; }; }
[ "$DO_TRAY" = 1 ] && { [ -f "$TRAY_SRC" ] || { echo "トレイ用画像が見つかりません: $TRAY_SRC" >&2; exit 1; }; }

command -v python3 >/dev/null || { echo "python3 が見つかりません" >&2; exit 1; }
[ "$DO_TRAY" = 1 ] && { command -v sips >/dev/null || { echo "sips が見つかりません(macOS標準ツール)" >&2; exit 1; }; }

[ "$DO_APP"  = 1 ] && echo "アプリ用: $APP_SRC"   || echo "アプリ用: (スキップ)"
[ "$DO_TRAY" = 1 ] && echo "トレイ用: $TRAY_SRC"  || echo "トレイ用: (スキップ / 現状維持)"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [ "$DO_APP" = 1 ]; then
echo "==> アプリアイコン生成 (角丸スクワークル)"
# 1024キャンバス / 中央824の角丸(周囲100マージン, 角丸半径185) / 絵は724内にセーフエリア付き配置 / 白背景
python3 - "$APP_SRC" > "$TMP/appicon.svg" <<'PY'
import sys, base64
b64 = base64.b64encode(open(sys.argv[1], "rb").read()).decode()
print(f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
      f'width="1024" height="1024" viewBox="0 0 1024 1024">'
      f'<defs><clipPath id="sq"><rect x="100" y="100" width="824" height="824" rx="185" ry="185"/></clipPath></defs>'
      f'<g clip-path="url(#sq)">'
      f'<rect x="100" y="100" width="824" height="824" fill="#ffffff"/>'
      f'<image x="150" y="150" width="724" height="724" preserveAspectRatio="xMidYMid meet" '
      f'xlink:href="data:image/png;base64,{b64}"/>'
      f'</g></svg>')
PY
npx tauri icon "$TMP/appicon.svg"

if [ "$DO_TRAY" = 1 ]; then
echo "==> トレイアイコン生成 (44x44 透過PNG)"
# 44x44 = メニューバーの22ptをRetina(2x)で表示する解像度。
# 白背景(しきい値235以上のRGB)を透過し、それ以外は元の色のまま不透明にする。
# メニューバーは icon_as_template(true) のため表示時は色を無視した白黒シルエットになるが、
# ファイル自体は実PNGとして色情報を保持しておく(他用途への転用や見た目確認をしやすくするため)。
sips -z 44 44 -s format bmp "$TRAY_SRC" --out "$TMP/tray44.bmp" >/dev/null
python3 - "$TMP/tray44.bmp" src-tauri/icons/tray-icon.png <<'PY'
import sys, struct, zlib

inp, outp = sys.argv[1], sys.argv[2]
d = open(inp, "rb").read()
off = struct.unpack("<I", d[10:14])[0]   # ピクセルデータ開始オフセット
W   = struct.unpack("<i", d[18:22])[0]   # 幅
Hs  = struct.unpack("<i", d[22:26])[0]   # 高さ(負ならtop-down)
bpp = struct.unpack("<H", d[28:30])[0]   # ビット深度
H, topdown, bpr = abs(Hs), Hs < 0, bpp // 8
row = ((W * bpr + 3) // 4) * 4           # 4バイト境界パディング込みの行サイズ
TH = 235                                  # 白背景しきい値

raw = bytearray()
for yy in range(H):
    y = yy if topdown else (H - 1 - yy)
    raw.append(0)  # PNGフィルタタイプ0(None)
    for x in range(W):
        i = off + y * row + x * bpr
        B, G, R = d[i], d[i+1], d[i+2]
        a = 0 if (R >= TH and G >= TH and B >= TH) else 255
        raw += bytes((R, G, B, a))

def chunk(tag, data):
    c = tag + data
    return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xffffffff)

png = b"\x89PNG\r\n\x1a\n"
png += chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 6, 0, 0, 0))
png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
png += chunk(b"IEND", b"")
open(outp, "wb").write(png)
PY
fi

echo
echo "アイコン生成が完了しました。反映するには再ビルドしてください:"
echo "  npm run tauri dev    # 開発モードで確認 (Dock / メニューバー)"
echo "  npm run tauri build  # .app にアイコンを焼き込む"
