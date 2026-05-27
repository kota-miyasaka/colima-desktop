# Colima Desktop 開発ガイド

## 1. 開発環境

### 必要なツール

| ツール | バージョン | 備考 |
|---|---|---|
| Rust | stable (aarch64-apple-darwin) | rustup で管理 |
| Node.js | 20.x | nvm で管理 |
| Tauri CLI | `@tauri-apps/cli ^2.0.0` | npm devDependency |
| Colima | 最新 | brew install colima |

### PATH の注意点

Homebrew 経由で rustup をインストールした場合、`~/.cargo/bin` にシムが作られない。
必ず以下を `~/.zshrc` に追加する：

```sh
export PATH="$HOME/.rustup/toolchains/stable-aarch64-apple-darwin/bin:$PATH"
```

---

## 2. 起動方法

```bash
# 前提: Colima を起動しておく
colima start

# 開発モード（ホットリロードあり）
unset npm_config_prefix
export PATH="$HOME/.rustup/toolchains/stable-aarch64-apple-darwin/bin:$PATH"
export NVM_DIR="$HOME/.nvm" && source "/opt/homebrew/opt/nvm/nvm.sh" && nvm use 20 --silent
npm run tauri -- dev

# リリースビルド（.app バンドル生成）
npm run tauri -- build
# → src-tauri/target/release/bundle/macos/Colima Desktop.app
```

### npm_config_prefix について

Zed エディタ等の環境では `npm_config_prefix` が設定されており、`nvm` と競合してエラーになる。
`npm run tauri` 実行前に `unset npm_config_prefix` が必要。

---

## 3. ディレクトリ構成

```
colima-desktop/
  ├─ src/                         # Frontend（React + TypeScript）
  │   ├─ components/
  │   │   ├─ ContainerTable.tsx
  │   │   ├─ ImageTable.tsx
  │   │   ├─ VolumeTable.tsx
  │   │   ├─ ComposeTable.tsx
  │   │   ├─ LogViewer.tsx
  │   │   └─ Sidebar.tsx
  │   ├─ pages/
  │   │   ├─ ContainersPage.tsx
  │   │   ├─ ComposePage.tsx
  │   │   ├─ ImagesPage.tsx
  │   │   ├─ VolumesPage.tsx
  │   │   └─ SettingsPage.tsx
  │   ├─ hooks/
  │   │   ├─ useContainers.ts     # refreshInterval オプションあり
  │   │   ├─ useImages.ts
  │   │   ├─ useVolumes.ts
  │   │   ├─ useCompose.ts
  │   │   └─ useSettings.ts       # tauri-plugin-store ラッパー
  │   ├─ types/
  │   │   ├─ container.ts
  │   │   ├─ image.ts
  │   │   ├─ volume.ts
  │   │   ├─ compose.ts
  │   │   └─ settings.ts
  │   └─ App.tsx
  │
  ├─ src-tauri/
  │   ├─ src/
  │   │   ├─ lib.rs               # Tauri コマンド登録・tray セットアップ
  │   │   ├─ main.rs
  │   │   ├─ docker_client.rs     # bollard 接続
  │   │   ├─ colima.rs            # socket 検出・colima CLI
  │   │   ├─ container_service.rs
  │   │   ├─ image_service.rs
  │   │   ├─ volume_service.rs
  │   │   ├─ compose_service.rs
  │   │   ├─ error.rs
  │   │   └─ tray_icon.rgba       # 22×22 RGBA バイナリ（トレイアイコン）
  │   ├─ icons/
  │   │   ├─ icon.icns            # Dock アイコン（macOS）
  │   │   ├─ icon.ico             # Windows 用（未使用）
  │   │   ├─ 32x32.png
  │   │   ├─ 128x128.png
  │   │   ├─ 128x128@2x.png
  │   │   └─ tray-icon.png        # メニューバーアイコン（参照用）
  │   ├─ capabilities/
  │   │   └─ default.json         # Tauri v2 パーミッション定義
  │   ├─ Cargo.toml
  │   └─ tauri.conf.json
  │
  ├─ doc/
  │   ├─ SPEC.md                  # アプリ仕様書
  │   └─ DEVELOPMENT.md           # 本ファイル
  │
  ├─ package.json
  ├─ tsconfig.json
  └─ vite.config.ts
```

---

## 4. アーキテクチャ上の決定事項

### Docker socket 接続
- Frontend は socket に直接アクセスしない。すべて Rust の Tauri コマンド経由
- `docker_client::create_client(socket_path)` で bollard クライアントを都度生成
- socket path の検出順: ユーザー設定 → `~/.colima/{profile}/docker.sock` → `DOCKER_HOST` → `/var/run/docker.sock`

### `~` 展開について
- Rust では `~` を自動展開しない。`dirs::home_dir()` でホームディレクトリを取得すること
- フロントエンドから `~/.colima/...` 形式のパスを直接 Rust に渡さない
- profile → socket path 変換は `resolve_socket_for_profile` Tauri コマンドを使う

### Colima CLI の引数
```bash
colima start --profile {profile}   # ✅ 正しい
colima start {profile}             # ❌ 間違い（profile がインスタンス名になる）
```

### Colima 自動起動・自動停止
- **起動時**: `setup_tray` 内のバックグラウンドタスクで `colima::colima_start(None)` を呼ぶ。既起動時は即座に終了するため副作用なし。
- **終了時**: `RunEvent::Exit` で `colima::colima_stop(None)` を `block_on` で同期実行。実行中のコンテナもすべて停止する。

```rust
// 起動時（setup_tray 内）
tauri::async_runtime::spawn(async move {
    let _ = colima::colima_start(None).await;
    refresh_tray_status(&app_handle, &status_item_clone, &running_item_clone).await;
});

// 終了時（run ループ内）
.run(|_app_handle, event| {
    if let tauri::RunEvent::Exit = event {
        tauri::async_runtime::block_on(async {
            let _ = colima::colima_stop(None).await;
        });
    }
});
```

`RunEvent::Exit` はメインスレッドで発火するため `block_on` が使える（tokio スレッド内では使用不可）。

### async / CLI 実行
- Tauri コマンドはすべて `async fn`
- CLI サブプロセスは `tokio::process::Command`（ブロッキングを避ける）
- 同期の `std::process::Command` は使わない

---

## 5. Tauri v2 固有の注意事項

### トレイアイコンの二重生成
`tauri.conf.json` に `trayIcon` セクションがあり、かつ `lib.rs` で `TrayIconBuilder` を使うと
**トレイアイコンが2つ生成される**。片方はアイコンなし（白い四角）、片方はメニューなし、という状態になる。

対策: `tauri.conf.json` の `trayIcon` セクションは削除し、`lib.rs` の `TrayIconBuilder::with_id("main")` に統一する。

```rust
// lib.rs の正しい書き方
const ICON_RGBA: &[u8] = include_bytes!("tray_icon.rgba");
let tray_icon = tauri::image::Image::new(ICON_RGBA, 22, 22);

TrayIconBuilder::with_id("main")
    .icon(tray_icon)
    .icon_as_template(true)   // macOS: ダーク/ライト自動対応
    .menu(&menu)
    ...
```

### `tauri::image::Image` の生成
`Image::from_bytes()` は存在しない。PNG デコーダーを持たないため、raw RGBA データが必要：

```rust
// NG: Image::from_bytes(png_bytes)  ← コンパイルエラー
// OK: 事前に RGBA バイナリを用意して embed
const ICON_RGBA: &[u8] = include_bytes!("tray_icon.rgba");
let image = tauri::image::Image::new(ICON_RGBA, width, height);
```

### dev モードの Dock アイコン
`cargo tauri dev` は `.app` バンドルを作らないため、Dock アイコンが赤い四角になる。
`objc` クレートで起動時に `NSApp setApplicationIconImage:` を呼ぶことで解決：

```rust
// Cargo.toml
[target.'cfg(target_os = "macos")'.dependencies]
objc = "0.2"

// lib.rs
#[cfg(target_os = "macos")]
fn set_dock_icon() {
    const ICON: &[u8] = include_bytes!("../icons/icon.icns");
    unsafe {
        use objc::{class, msg_send, sel, sel_impl};
        let ns_data: *mut objc::runtime::Object = msg_send![
            class!(NSData),
            dataWithBytes: ICON.as_ptr() as *const std::ffi::c_void
            length: ICON.len()
        ];
        let ns_image: *mut objc::runtime::Object = msg_send![class!(NSImage), alloc];
        let ns_image: *mut objc::runtime::Object = msg_send![ns_image, initWithData: ns_data];
        let ns_app: *mut objc::runtime::Object = msg_send![class!(NSApplication), sharedApplication];
        let _: () = msg_send![ns_app, setApplicationIconImage: ns_image];
    }
}
```

### `capabilities/default.json` のパーミッション
Tauri v2 ではプラグインの使用に capabilities での明示的な許可が必要。
`tauri-plugin-store` を使う場合は必ず追加すること（ないと `save()` が権限エラーで無音失敗する）：

```json
{
  "permissions": [
    "core:default",
    "shell:allow-execute",
    "shell:allow-open",
    "store:allow-load",
    "store:allow-get",
    "store:allow-set",
    "store:allow-save",
    "store:allow-delete",
    "store:allow-has",
    "store:allow-keys"
  ]
}
```

---

## 6. Frontend の実装パターン

### 操作後の更新（楽観的更新なし）

```ts
const handleStop = async (id: string) => {
  setOperatingId(id);
  try {
    await invoke('stop_container', { containerId: id });
  } catch (err) {
    setError(String(err));
  } finally {
    setOperatingId(null);
    try { await refetch(); } catch {}   // refetch 失敗はサイレントに無視
  }
};
```

`setOperatingId(null)` を `refetch()` より前に呼ぶと、refetch 中にボタンが再活性化してしまう。
`finally` 内で `setOperatingId(null)` → `refetch()` の順で処理する。

### `useSettings` の settingsRef パターン

React Strict Mode では state updater 関数が2回呼ばれる場合があるため、
`updateSettings` 内で最新の settings を参照する際は `useRef` を使う：

```ts
const settingsRef = useRef<Settings>(DEFAULT_SETTINGS);
useEffect(() => { settingsRef.current = settings; }, [settings]);

const updateSettings = useCallback(async (partial: Partial<Settings>) => {
  const next = { ...settingsRef.current, ...partial };  // ref から参照
  setSettings(next);
  // ... store.save()
}, []);
```

### tauri-plugin-store の使い方

```ts
import { load } from "@tauri-apps/plugin-store";

const store = await load("settings.json", { defaults: {}, autoSave: false });
const theme = await store.get<"light" | "dark">("theme") ?? "light";

await store.set("theme", "dark");
await store.save();  // 明示的に保存（autoSave: false のため必須）
```

設定ファイルの保存先: `~/Library/Application Support/com.colima-desktop.app/settings.json`

---

## 7. bollard の使い方メモ

### Docker クライアント生成

```rust
// docker_client.rs
pub fn create_client(socket_path: &str) -> Result<Docker, AppError> {
    Docker::connect_with_unix(socket_path, 120, API_DEFAULT_VERSION)
        .map_err(|e| AppError::ConnectionFailed(e.to_string()))
}
```

### コンテナログ（multiplexed stream）

```rust
use futures_util::StreamExt;

let stream = docker.logs(container_id, Some(LogsOptions { stdout: true, stderr: true, tail: "200", follow: false, ..Default::default() }));
let mut output = String::new();
futures_util::pin_mut!(stream);
while let Some(chunk) = stream.next().await {
    match chunk? {
        LogOutput::StdOut { message } | LogOutput::StdErr { message } => {
            output.push_str(&String::from_utf8_lossy(&message));
        }
        _ => {}
    }
}
```

### イメージ Pull（ストリーム consume 必須）

```rust
// pull はストリームを最後まで consume しないと完了しない
let stream = docker.create_image(Some(CreateImageOptions { from_image: name, tag, ..Default::default() }), None, None);
futures_util::pin_mut!(stream);
while let Some(result) = stream.next().await {
    result?;
}
```

### Volume 使用コンテナの取得

```rust
// MountPointTypeEnum::VOLUME でフィルタリング
use bollard::models::MountPointTypeEnum;

for container in containers {
    for mount in container.mounts.unwrap_or_default() {
        if mount.typ == Some(MountPointTypeEnum::VOLUME) {
            if mount.name.as_deref() == Some(volume_name) {
                // このコンテナが volume を使用中
            }
        }
    }
}
```

---

## 8. アイコン生成

アイコンは Python の純正ライブラリ（PIL 不要）で生成している。
再生成が必要な場合:

### トレイアイコン（22×22 RGBA）

```bash
python3 - <<'EOF'
import struct, zlib
# ... (doc/ 配下に生成スクリプトを用意予定)
EOF
```

生成物:
- `src-tauri/icons/tray-icon.png` — 参照用 PNG
- `src-tauri/src/tray_icon.rgba` — Rust が `include_bytes!` で読む raw RGBA

### アプリアイコン（ICNS）

```bash
# 各サイズの PNG を /tmp/AppIcon.iconset/ に生成後:
iconutil -c icns /tmp/AppIcon.iconset -o src-tauri/icons/icon.icns
```

---

## 9. 既知の制限・将来対応候補

| 項目 | 現状 | 将来対応 |
|---|---|---|
| リアルタイムログ | tail=200 のスナップショットのみ | bollard の follow=true でストリーミング |
| メニューバー更新 | 起動時のみ | 定期更新（setInterval + Tauri event） |
| Exec terminal | 未実装 | Tauri shell plugin 経由 |
| Network 管理 | 未実装 | bollard `/networks` API |
| リモート Docker | 未実装 | TCP + TLS 対応 |
| 自動起動 | 手動 | macOS Login Items / LaunchAgent |
| 配布 | 手動ビルド | Homebrew cask |
