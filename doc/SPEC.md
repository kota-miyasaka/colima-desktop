# Colima Desktop アプリ仕様書

## 1. 概要

macOS 上で Colima により起動された Docker Engine に Unix Domain Socket 経由で接続し、
コンテナ・イメージ・Compose プロジェクト・Volume を軽量に管理するローカル専用デスクトップアプリ。

---

## 2. 技術構成

| レイヤー | 技術 |
|---|---|
| Desktop Shell | Tauri v2 |
| System Tray | tauri v2 組み込み（`tray-icon` feature） |
| Frontend | React 18 + TypeScript |
| Backend | Rust |
| Docker Client | bollard 0.17（Unix Socket 対応） |
| 設定保存 | tauri-plugin-store v2 |
| CLI 実行 | tokio::process::Command（async） |

---

## 3. アーキテクチャ

```
メニューバーアイコン（tray-icon）
  └─ メインウィンドウ
      └─ Frontend（React / TypeScript）
          └─ Tauri Command 呼び出し
              └─ Backend（Rust / bollard）
                  ├─ Unix Domain Socket → Colima Docker Engine
                  └─ CLI サブプロセス → colima / docker compose
```

- Frontend は Docker socket に直接アクセスしない
- 楽観的更新なし。操作後は必ず一覧を再取得する

---

## 4. Socket 検出優先順位

```
1. ユーザー設定値（Settings 画面で保存した socketPath）
2. ~/.colima/{profile}/docker.sock  ← profile はデフォルト "default"
3. DOCKER_HOST 環境変数
4. /var/run/docker.sock
```

---

## 5. 機能スコープ（全実装済み）

### 5.1 接続・Colima 管理

| 機能 | 実装方法 |
|---|---|
| Docker 接続確認（/version） | bollard |
| Colima start | `colima start --profile {profile}` CLI |
| Colima stop | `colima stop --profile {profile}` CLI |
| 複数 Colima profile 切り替え | socket path 切り替え |

### 5.2 コンテナ管理

| 機能 | 実装方法 |
|---|---|
| コンテナ一覧（全状態） | bollard（`/containers/json?all=true`） |
| Start / Stop / Restart | bollard |
| Remove | bollard（確認ダイアログあり） |
| ログ表示（tail=200） | bollard（multiplexed stream デコード） |

- Stop 中・起動中コンテナを Remove しようとした場合のみ「強制削除しますか？」を追加確認

### 5.3 Docker Compose 管理

| 機能 | 実装方法 |
|---|---|
| プロジェクト一覧（サービスをグルーピング） | bollard（`com.docker.compose.project` ラベル） |
| 各サービスの状態表示 | bollard |
| Up（ビルド含む） | `docker compose up -d` CLI |
| Stop / Down / Restart | `docker compose` CLI |

- working_dir は `com.docker.compose.project.working_dir` ラベルから自動解決

### 5.4 イメージ管理

| 機能 | 実装方法 |
|---|---|
| イメージ一覧 | bollard（`/images/json`） |
| Pull（`nginx:latest` 形式） | bollard（ストリーム consume で完了） |
| Remove | bollard（確認ダイアログあり） |

### 5.5 Volume 管理

| 機能 | 実装方法 |
|---|---|
| Volume 一覧（名前 / Driver / 使用コンテナ） | bollard（`/volumes`） |
| 個別削除 | bollard（確認ダイアログあり） |
| 未使用 Volume 一括削除（prune） | bollard（確認ダイアログあり） |

### 5.6 メニューバー常駐

```
メニューバーアイコン
  ├─ 接続状態（● Connected / ✕ Disconnected）
  ├─ 実行中コンテナ数（例: "3 running"）
  ├─ ─────────────
  ├─ [Open Colima Manager]
  ├─ ─────────────
  └─ [Quit]
```

### 5.7 Settings 画面

| 設定項目 | 詳細 |
|---|---|
| Docker socket path | デフォルト: `~/.colima/default/docker.sock`（空欄で自動検出） |
| Colima profile 選択 | 複数 profile 対応 |
| refresh interval | off / 5秒 / 10秒 / 30秒 / 60秒 |
| theme | light / dark |
| 接続テストボタン | 手動で接続確認を実行 |

---

## 6. Tauri コマンド一覧

### 接続・Colima

```
check_docker_connection(socket_path?) -> DockerConnectionInfo
colima_start(profile?) -> OperationResult
colima_stop(profile?) -> OperationResult
list_colima_profiles() -> string[]
resolve_socket_for_profile(profile) -> string
```

### コンテナ

```
list_containers(all: bool) -> ContainerSummary[]
start_container(id) -> OperationResult
stop_container(id) -> OperationResult
restart_container(id) -> OperationResult
remove_container(id, force: bool) -> OperationResult
get_container_logs(id, tail: u32) -> string
```

### Docker Compose

```
list_compose_projects() -> ComposeProject[]
compose_up(working_dir) -> OperationResult
compose_stop(working_dir) -> OperationResult
compose_down(working_dir) -> OperationResult
compose_restart(working_dir) -> OperationResult
```

### イメージ

```
list_images() -> ImageSummary[]
pull_image(image: string) -> OperationResult
remove_image(id_or_name, force: bool) -> OperationResult
```

### Volume

```
list_volumes() -> VolumeSummary[]
remove_volume(name) -> OperationResult
prune_volumes() -> OperationResult
```

---

## 7. 型定義

```ts
type ContainerSummary = {
  id: string
  names: string[]
  image: string
  state: 'running' | 'exited' | 'created' | 'paused' | 'restarting' | 'dead' | string
  status: string
  created: number
  ports: ContainerPort[]
  labels: Record<string, string>
}

type ContainerPort = {
  privatePort: number
  publicPort?: number
  type: 'tcp' | 'udp' | string
  ip?: string
}

type ImageSummary = {
  id: string
  repoTags: string[]
  created: number
  size: number
}

type VolumeSummary = {
  name: string
  driver: string
  mountpoint: string
  usedByContainers: string[]
}

type ComposeProject = {
  name: string
  workingDir: string
  configFiles: string
  services: ComposeService[]
}

type ComposeService = {
  name: string
  containerId: string
  state: string
  status: string
}

type DockerConnectionInfo = {
  connected: boolean
  socketPath: string
  dockerVersion: string
  apiVersion: string
}

type OperationResult = {
  success: boolean
  message?: string
}

type Settings = {
  socketPath: string
  colimaProfile: string
  refreshInterval: number
  theme: 'light' | 'dark'
}
```

---

## 8. UI 画面構成

```
Sidebar
  ├─ Containers
  ├─ Compose
  ├─ Images
  ├─ Volumes
  ├─ Connection
  └─ Settings

Logs はコンテナ行からモーダルで表示
```

---

## 9. エラーハンドリング

| ケース | 表示内容 |
|---|---|
| Colima 未起動 | 「Colima が起動しているか確認してください」 |
| socket 不存在 | 「Docker socket が見つかりません。設定済み path: {path}」 |
| Docker API エラー | 「Docker Engine API の呼び出しに失敗しました。{message}」 |
| 操作失敗 | 「コンテナ操作に失敗しました。対象: {name} 操作: {op} 理由: {message}」 |
| Colima start/stop 失敗 | CLI の標準エラー出力をそのまま表示 |

---

## 10. 操作後更新ポリシー

```
操作ボタン押下
  → Backend Tauri Command 実行
  → Docker API / CLI 実行
  → 成功 / 失敗を返却
  → 一覧を再取得（refetch）
  → UI 更新
```

楽観的更新は行わない。

---

## 11. セキュリティ方針

- Docker socket へのアクセスは Backend（Rust）のみに限定
- Frontend から直接 socket path を扱わない
- exec terminal は実装しない
- remove / prune 系操作には必ず確認ダイアログを表示
- 外部ネットワークから操作できる API サーバーを立てない

---

## 12. 将来拡張候補

- リモート Docker ホスト管理（TCP / TLS）
- リアルタイムログ follow
- Exec terminal
- Network 管理
- CPU / Memory 使用量グラフ
- 自動アップデート
- Homebrew cask 配布
