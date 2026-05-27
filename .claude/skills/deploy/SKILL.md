---
description: Colima Desktop をリリースビルドして /Applications にインストールするスキル
---

# deploy — Colima Desktop ビルド & インストール

このスキルは以下を順番に実行する：

1. `npm run tauri -- build` でリリースビルド
2. 生成された `.app` を `/Applications` に上書きコピー
3. アドホック再署名（コピーで署名が壊れるため必須）
4. アプリを起動

## 実行手順

### 1. 既存アプリを停止

```bash
pkill -x "Colima Desktop" 2>/dev/null || true
```

### 2. 環境変数を設定してビルド

```bash
unset npm_config_prefix
export PATH="$HOME/.rustup/toolchains/stable-aarch64-apple-darwin/bin:$PATH"
export NVM_DIR="$HOME/.nvm" && source "/opt/homebrew/opt/nvm/nvm.sh" && nvm use 20 --silent
npm run tauri -- build
```

ビルドには 5〜15 分かかる。完了すると以下が生成される：
- `.app`: `src-tauri/target/release/bundle/macos/Colima Desktop.app`
- `.dmg`: `src-tauri/target/release/bundle/dmg/Colima Desktop_*.dmg`

### 3. /Applications にコピー & 再署名

```bash
cp -R "src-tauri/target/release/bundle/macos/Colima Desktop.app" /Applications/
codesign --force --deep --sign - "/Applications/Colima Desktop.app"
```

**再署名は必須**。コピー後に macOS が署名を検証し、アドホック署名のままでは `SIGKILL (Code Signature Invalid)` でクラッシュする。

### 4. 起動確認

```bash
open "/Applications/Colima Desktop.app"
sleep 3 && pgrep -l "colima-desktop"
```

プロセスが表示されれば起動成功。

## 注意事項

- `npm_config_prefix` が設定されていると nvm と競合してエラーになる。必ず `unset` すること。
- Rust は `~/.rustup/toolchains/stable-aarch64-apple-darwin/bin` を PATH に追加しないと見つからない場合がある（Homebrew 経由の rustup の場合）。
- `codesign --sign -` はアドホック署名（開発者証明書不要）。Apple Developer 証明書があれば `-` の代わりにチーム ID を指定すると配布可能になる。
- `/Applications` への書き込みには権限プロンプトが出る場合がある。
