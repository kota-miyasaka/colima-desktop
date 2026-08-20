# Backend モジュール構成（Rust / src-tauri/src）

## モジュール依存関係

```
main.rs
  └─ lib.rs
       ├─ error.rs
       ├─ docker_client.rs  ←── error.rs
       ├─ colima.rs         ←── error.rs, container_service.rs (OperationResult)
       ├─ container_service.rs  ←── colima.rs, docker_client.rs, error.rs
       ├─ image_service.rs      ←── colima.rs, docker_client.rs, error.rs, container_service.rs
       ├─ volume_service.rs     ←── colima.rs, docker_client.rs, error.rs, container_service.rs
       └─ compose_service.rs    ←── colima.rs, docker_client.rs, error.rs, container_service.rs
```

---

## モジュール詳細

### `main.rs`
エントリポイント。`lib::run()` を呼び出すだけ。

---

### `lib.rs`
Tauri アプリのコア。コマンド登録・トレイ・ライフサイクルを管理する。

#### 公開 Tauri コマンド（`invoke_handler` 登録済み）

| コマンド | シグネチャ |
|---|---|
| `check_docker_connection` | `(socket_path: Option<String>) -> DockerConnectionInfo` |
| `list_containers` | `(all: bool) -> Vec<ContainerSummary>` |
| `start_container` | `(container_id: String) -> OperationResult` |
| `stop_container` | `(container_id: String) -> OperationResult` |
| `restart_container` | `(container_id: String) -> OperationResult` |
| `remove_container` | `(container_id: String, force: bool) -> OperationResult` |
| `get_container_logs` | `(container_id: String, tail: u32) -> String` |
| `list_images` | `() -> Vec<ImageSummary>` |
| `pull_image` | `(image: String) -> OperationResult` |
| `remove_image` | `(id_or_name: String, force: bool) -> OperationResult` |
| `list_compose_projects` | `() -> Vec<ComposeProject>` |
| `compose_up` | `(working_dir: String) -> OperationResult` |
| `compose_stop` | `(working_dir: String) -> OperationResult` |
| `compose_down` | `(working_dir: String) -> OperationResult` |
| `compose_restart` | `(working_dir: String) -> OperationResult` |
| `list_volumes` | `() -> Vec<VolumeSummary>` |
| `remove_volume` | `(name: String) -> OperationResult` |
| `prune_volumes` | `() -> OperationResult` |
| `list_colima_profiles` | `() -> Vec<String>` |
| `resolve_socket_for_profile` | `(profile: String) -> String` |
| `colima_start` | `(profile: Option<String>) -> OperationResult` |
| `colima_stop` | `(profile: Option<String>) -> OperationResult` |

#### 内部関数

```rust
fn setup_tray(app: &mut tauri::App) -> tauri::Result<()>
// トレイアイコン・メニュー・イベントハンドラのセットアップ
// 起動時に colima_start(None) をバックグラウンドで実行し、完了後に refresh_tray_status を呼ぶ

async fn refresh_tray_status(app, status_item, running_item)
// Docker 接続確認 → トレイメニューの "Connected/Disconnected" と実行中コンテナ数を更新

async fn get_running_container_count(socket_path: &str) -> usize
// running 状態のコンテナ数を返す（失敗時 0）

fn set_dock_icon()  // #[cfg(target_os = "macos")]
// objc 経由で NSApp に icon.icns をセット（dev モード用）
```

#### ライフサイクル

```
Builder::default()
  .setup()    → setup_tray() + set_dock_icon()
  .build()
  .run(|_, RunEvent::Exit| colima_stop(None))  // アプリ終了時に Colima を停止
```

---

### `error.rs`

#### `enum AppError`

| バリアント | 説明 |
|---|---|
| `ColimaNotRunning` | Colima が未起動 |
| `SocketNotFound(String)` | Docker socket ファイルが存在しない |
| `DockerApiError(String)` | bollard API エラー |
| `ContainerOperationFailed { name, op, message }` | コンテナ操作失敗 |
| `ColimaCliError(String)` | Colima CLI 失敗 |
| `CommandFailed(String)` | サブプロセス実行失敗 |
| `Internal(String)` | 内部エラー |

- `From<bollard::errors::Error>` 実装済み（ConnectionRefused → `ColimaNotRunning` に変換）
- `serde::Serialize` 実装済み（エラーメッセージを文字列として Frontend に返す）
- `type Result<T> = std::result::Result<T, AppError>` を定義

---

### `docker_client.rs`

#### 型

```rust
pub struct DockerConnectionInfo {
    pub connected: bool,
    pub socket_path: String,
    pub docker_version: String,
    pub api_version: String,
}
```

#### 関数

```rust
pub async fn connect_and_verify(socket_path: &str) -> Result<DockerConnectionInfo>
// socket の存在確認 → Docker::version() を呼んでバージョン情報を取得

pub fn create_client(socket_path: &str) -> Result<Docker>
// bollard::Docker::connect_with_unix() でクライアントを生成（検証なし）
```

---

### `colima.rs`

#### 関数

```rust
pub fn find_binary(name: &str) -> String
// /opt/homebrew/bin → /usr/local/bin → /usr/bin の順に探してフルパスを返す
// .app バンドル起動時に PATH が通っていない問題への対策

pub fn resolve_socket_path(socket_path: Option<String>) -> String
// 検出優先順: 引数 → ~/.colima/default/docker.sock → DOCKER_HOST → /var/run/docker.sock

pub fn colima_profile_socket(profile: &str) -> Option<PathBuf>
// ~/.colima/{profile}/docker.sock のパスを返す

pub fn list_colima_profiles() -> Result<Vec<String>>
// ~/.colima/ 以下のサブディレクトリ名を一覧（隠しディレクトリ除外）

pub async fn colima_start(profile: Option<String>) -> Result<OperationResult>
// `colima start [--profile {profile}]` を tokio::process::Command で実行

pub async fn colima_stop(profile: Option<String>) -> Result<OperationResult>
// `colima stop [--profile {profile}]` を tokio::process::Command で実行
```

---

### `container_service.rs`

#### 型

```rust
pub struct OperationResult {        // 全サービスで共通利用
    pub success: bool,
    pub message: Option<String>,
}

pub struct ContainerPort {
    pub private_port: u16,
    pub public_port: Option<u16>,
    pub port_type: String,
    pub ip: Option<String>,
}

pub struct ContainerSummary {
    pub id: String,
    pub names: Vec<String>,
    pub image: String,
    pub state: String,              // "running" | "exited" | "created" | ...
    pub status: String,
    pub created: i64,
    pub ports: Vec<ContainerPort>,
    pub labels: HashMap<String, String>,
}
```

#### 関数

```rust
pub async fn list_containers(all: bool) -> Result<Vec<ContainerSummary>>
pub async fn start_container(container_id: &str) -> Result<OperationResult>
pub async fn stop_container(container_id: &str) -> Result<OperationResult>
pub async fn restart_container(container_id: &str) -> Result<OperationResult>
pub async fn remove_container(container_id: &str, force: bool) -> Result<OperationResult>
pub async fn get_container_logs(container_id: &str, tail: u32) -> Result<String>
// bollard の multiplexed stream (StdOut/StdErr) を結合して返す
```

---

### `image_service.rs`

#### 型

```rust
pub struct ImageSummary {
    pub id: String,
    pub repo_tags: Vec<String>,
    pub created: i64,
    pub size: i64,
}
```

#### 関数

```rust
pub async fn list_images() -> Result<Vec<ImageSummary>>
pub async fn pull_image(image: &str) -> Result<OperationResult>
// "name:tag" を分解して bollard::create_image を呼ぶ
// ストリームを末尾まで consume しないと pull が完了しない

pub async fn remove_image(id_or_name: &str, force: bool) -> Result<OperationResult>
```

---

### `volume_service.rs`

#### 型

```rust
pub struct VolumeSummary {
    pub name: String,
    pub driver: String,
    pub mountpoint: String,
    pub used_by_containers: Vec<String>,
}
```

#### 関数

```rust
pub async fn list_volumes() -> Result<Vec<VolumeSummary>>
// list_volumes + list_containers(all=true) を呼び、
// MountPointTypeEnum::VOLUME でフィルタして usedByContainers を構築

pub async fn remove_volume(name: &str) -> Result<OperationResult>
pub async fn prune_volumes() -> Result<OperationResult>
```

---

### `compose_service.rs`

#### 型

```rust
pub struct ComposeService {
    pub name: String,
    pub container_id: String,
    pub state: String,
    pub status: String,
}

pub struct ComposeProject {
    pub name: String,
    pub working_dir: String,
    pub config_files: String,
    pub services: Vec<ComposeService>,
}
```

#### 関数

```rust
pub async fn list_compose_projects() -> Result<Vec<ComposeProject>>
// コンテナの labels から com.docker.compose.project でグルーピング

pub async fn compose_up(working_dir: &str) -> Result<OperationResult>
// `docker compose up -d` を tokio::process::Command で実行

pub async fn compose_stop(working_dir: &str) -> Result<OperationResult>
pub async fn compose_down(working_dir: &str) -> Result<OperationResult>
pub async fn compose_restart(working_dir: &str) -> Result<OperationResult>
// いずれも find_binary("docker") でフルパスを解決して実行
```
