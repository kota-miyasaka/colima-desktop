# リリース手順

`v*` タグを push すると [`.github/workflows/release.yml`](../.github/workflows/release.yml) が .dmg をビルドし、GitHub Release を **下書き（Draft）** として作成します。

## 手順

1. バージョンを 3 箇所で揃える（ワークフローが不一致を検出して失敗します）
   - `package.json` の `version`
   - `src-tauri/tauri.conf.json` の `version`
   - `src-tauri/Cargo.toml` の `version`（`npm install` / `cargo build` で `package-lock.json`・`src-tauri/Cargo.lock` も更新される）
2. コミットして main に反映
3. タグを打って push

   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

4. Actions の完了後、Releases に下書きができているので、.dmg を確認してリリースノートを整え **Publish release**
5. README の「インストール」節は Releases 公開後の内容になっています。**Release を Publish してから** README の変更を main にマージしてください（公開前だと `releases/latest` が 404 になります）

## ローカルで .dmg を作る

```bash
npm run tauri -- build            # .app と .dmg
npm run tauri -- build --bundles dmg
```

生成物: `src-tauri/target/release/bundle/dmg/Colima Desktop_<version>_aarch64.dmg`

### .dmg の生成が `bundle_dmg.sh` で失敗する場合

エラー表示は `error running bundle_dmg.sh` だけで、`.app` は生成されます。Tauri が使う `create-dmg`（`bundle_dmg.sh`）は、既定で `osascript` から Finder を操作してウィンドウの見た目（アイコン配置）を整えます。この AppleScript が失敗すると `Failed running AppleScript`（exit 64）で終了し、次が取り残されます。

- `src-tauri/target/release/bundle/macos/rw.<pid>.Colima Desktop_*.dmg`
- マウントされたままの `/Volumes/dmg.XXXXXX`

確認できた原因:

- **サンドボックス内で実行した場合**: Finder に接続できず（`osascript` が `-600` / `Connection invalid`）、必ず失敗する。
- **サンドボックス外でも不定期に失敗する**: 同一コマンドで失敗した回と成功した回がある。失敗時のログは取得できていないが、Finder への Apple Events が使えない・Finder の応答待ちのタイミング次第、という同じ工程で落ちていると考えられる。

対処: `CI=true` を付けると Tauri が `--skip-jenkins` を渡して AppleScript をスキップします。`Applications` へのリンクは作られ、ウィンドウ背景とアイコン配置のカスタマイズだけが無効になります。GitHub Actions は `CI=true` が自動で設定されるため、Release 用ビルドは常にこの経路です。

```bash
CI=true npm run tauri -- build
```

Claude Code などのサンドボックス内からビルドする場合は、サンドボックス外（`dangerouslyDisableSandbox`）で実行する必要があります（ビルド自体が `Operation not permitted` になるため）。

失敗後に取り残されたものは手動で片付けます。

```bash
hdiutil info | grep -i "dmg\."     # マウントが残っていれば diskutil eject /Volumes/dmg.XXXXXX
rm -f src-tauri/target/release/bundle/macos/rw.*.dmg
```

### アドホック署名

`tauri.conf.json` の `bundle.macOS.signingIdentity` を `"-"` にしてあるため、Tauri が .app 全体にアドホック署名を行います（`null` のときはリンカーが付けた実行ファイル単体の署名のみで、Info.plist・リソースが署名に含まれず、コピー後に署名検証で落ちる原因になっていました）。署名の確認:

```bash
codesign --verify --deep --strict --verbose=2 "src-tauri/target/release/bundle/macos/Colima Desktop.app"
```

## 署名と公証の選択肢

| 方式 | 必要なもの | 利用者側の手間 |
|---|---|---|
| **A. アドホック署名のみ（現在の既定）** | なし | Gatekeeper の警告を手動で回避（`xattr -cr` / 「このまま開く」） |
| **B. Developer ID 署名 + 公証** | Apple Developer Program（年 $99）、Developer ID Application 証明書、公証用の資格情報 | なし（ダブルクリックで開ける） |

B にする場合、`tauri-apps/tauri-action` の `env` に次のシークレットを渡します（値はリポジトリに書かない）。

| Secret | 内容 |
|---|---|
| `APPLE_CERTIFICATE` | Developer ID Application 証明書（.p12）の base64 |
| `APPLE_CERTIFICATE_PASSWORD` | .p12 のパスワード |
| `APPLE_SIGNING_IDENTITY` | 例: `Developer ID Application: Your Name (TEAMID)` |
| `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID` | 公証用（`APPLE_PASSWORD` は App 用パスワード）。または API キー方式の `APPLE_API_ISSUER` / `APPLE_API_KEY` / `APPLE_API_KEY_PATH` |

詳細: <https://v2.tauri.app/distribute/sign/macos/>

## Intel Mac 対応

`release.yml` の matrix にコメントアウトした `x86_64-apple-darwin` の行があります。Apple Silicon 上の runner でクロスコンパイルするだけで追加できますが、現状 Intel 実機では動作確認していないため既定では無効です。Intel の利用者が見込まれ、確認できる環境が用意できた時点で有効化してください（アセット名は `_x64.dmg` になります）。
