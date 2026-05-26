# Colima Desktop

macOS 上で [Colima](https://github.com/abiosoft/colima) により起動された Docker Engine を GUI で管理するデスクトップアプリ。

メニューバー常駐型の軽量アプリで、コンテナ・イメージ・Docker Compose・Volume の操作を一元管理できる。

## スクリーンショット

| コンテナ管理 | Docker Compose | Settings |
|---|---|---|
| _(準備中)_ | _(準備中)_ | _(準備中)_ |

## 機能

- **コンテナ管理** — 一覧表示・Start / Stop / Restart / Remove・ログ表示
- **Docker Compose** — プロジェクト一覧・Up / Stop / Down / Restart
- **イメージ管理** — 一覧表示・Pull・Remove
- **Volume 管理** — 一覧表示・削除・未使用 Volume の一括 prune
- **メニューバー常駐** — 接続状態と実行中コンテナ数を常時表示
- **複数 Colima Profile** — profile 切り替えによる複数 Docker Engine 対応
- **Settings** — socket path・refresh interval・テーマ（light / dark）の永続化

## 技術構成

| レイヤー | 技術 |
|---|---|
| Desktop Shell | [Tauri v2](https://tauri.app/) |
| Frontend | React 18 + TypeScript |
| Backend | Rust |
| Docker Client | [bollard](https://github.com/fussybeaver/bollard) 0.17 |
| 設定保存 | tauri-plugin-store v2 |
| CLI 実行 | tokio::process::Command |

## 必要な環境

| ツール | バージョン |
|---|---|
| macOS | 12 Monterey 以降推奨 |
| [Colima](https://github.com/abiosoft/colima) | 最新 |
| Rust (stable) | aarch64-apple-darwin |
| Node.js | 20.x |

```bash
# Colima のインストール
brew install colima docker
```

## セットアップ

```bash
git clone https://github.com/yourname/colima-desktop.git
cd colima-desktop
npm install
```

### PATH の設定（Homebrew 経由で rustup をインストールした場合）

`~/.zshrc` に追加：

```sh
export PATH="$HOME/.rustup/toolchains/stable-aarch64-apple-darwin/bin:$PATH"
```

## 開発モードで起動

```bash
# Colima を先に起動しておく
colima start

# 開発サーバー起動
unset npm_config_prefix
export PATH="$HOME/.rustup/toolchains/stable-aarch64-apple-darwin/bin:$PATH"
export NVM_DIR="$HOME/.nvm" && source "/opt/homebrew/opt/nvm/nvm.sh" && nvm use 20 --silent
npm run tauri -- dev
```

## リリースビルド

```bash
npm run tauri -- build
# → src-tauri/target/release/bundle/macos/Colima Desktop.app
```

## Docker socket の検出順

```
1. Settings 画面で保存した socketPath
2. ~/.colima/{profile}/docker.sock（profile デフォルト: "default"）
3. DOCKER_HOST 環境変数
4. /var/run/docker.sock
```

## ドキュメント

- [仕様書](doc/SPEC.md) — 機能スコープ・型定義・Tauri コマンド一覧
- [開発ガイド](doc/DEVELOPMENT.md) — アーキテクチャ・Tauri v2 の注意事項・実装パターン

## ライセンス

MIT
