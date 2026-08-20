# Frontend モジュール構成（TypeScript / src）

## ディレクトリ構成と依存関係

```
src/
  main.tsx                 # React エントリポイント（App をマウント）
  App.tsx                  # ルーティング・サイドバー・テーマ管理
    ├─ ConnectionPage       # App.tsx 内の内部コンポーネント
    ├─ pages/
    │   ├─ ContainersPage  ← useContainers, ContainerTable
    │   ├─ ImagesPage      ← useImages, ImageTable
    │   ├─ ComposePage     ← useCompose, ComposeTable
    │   ├─ VolumesPage     ← useVolumes, VolumeTable
    │   └─ SettingsPage    ← Settings（props）
    ├─ components/
    │   ├─ ContainerTable
    │   ├─ ImageTable
    │   ├─ VolumeTable
    │   ├─ ComposeTable
    │   └─ LogViewer
    ├─ hooks/
    │   ├─ useContainers
    │   ├─ useImages
    │   ├─ useVolumes
    │   ├─ useCompose
    │   └─ useSettings
    └─ types/
        ├─ container.ts
        ├─ image.ts
        ├─ volume.ts
        └─ compose.ts
```

---

## 型定義（src/types）

### `container.ts`

```ts
type DockerConnectionInfo = {
  connected: boolean;
  socketPath: string;
  dockerVersion: string;
  apiVersion: string;
};

type ContainerPort = {
  privatePort: number;
  publicPort?: number;
  portType: string;
  ip?: string;
};

type ContainerSummary = {
  id: string;
  names: string[];
  image: string;
  state: "running" | "exited" | "created" | "paused" | "restarting" | "dead" | string;
  status: string;
  created: number;
  ports: ContainerPort[];
  labels: Record<string, string>;
};

type OperationResult = {
  success: boolean;
  message?: string;
};
```

### `image.ts`

```ts
type ImageSummary = {
  id: string;
  repoTags: string[];
  created: number;
  size: number;
};
```

### `volume.ts`

```ts
type VolumeSummary = {
  name: string;
  driver: string;
  mountpoint: string;
  usedByContainers: string[];
};
```

### `compose.ts`

```ts
type ComposeService = {
  name: string;
  containerId: string;
  state: string;
  status: string;
};

type ComposeProject = {
  name: string;
  workingDir: string;
  configFiles: string;
  services: ComposeService[];
};
```

---

## カスタムフック（src/hooks）

すべてのフックは `{ data, loading, error, refetch }` パターンを持つ。

### `useContainers(refreshInterval = 0)`

```ts
type UseContainersState = {
  containers: ContainerSummary[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};
```

- `invoke("list_containers", { all: true })` を呼ぶ
- `refreshInterval > 0` のとき `setInterval` で定期更新（秒単位）
- `refreshInterval` は `Settings.refreshInterval` から `ContainersPage` 経由で渡される

---

### `useImages()`

```ts
type UseImagesState = {
  images: ImageSummary[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};
```

- `invoke("list_images")` を呼ぶ

---

### `useVolumes()`

```ts
type UseVolumesState = {
  volumes: VolumeSummary[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};
```

- `invoke("list_volumes")` を呼ぶ

---

### `useCompose()`

```ts
type UseComposeState = {
  projects: ComposeProject[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};
```

- `invoke("list_compose_projects")` を呼ぶ

---

### `useSettings()`

```ts
type Settings = {
  socketPath: string;       // デフォルト: ""（空で自動検出）
  colimaProfile: string;   // デフォルト: "default"
  refreshInterval: number; // デフォルト: 0（off）
  theme: "light" | "dark"; // デフォルト: "light"
};

type UseSettingsState = {
  settings: Settings;
  updateSettings: (partial: Partial<Settings>) => Promise<void>;
  isLoaded: boolean;
};
```

- 起動時に `tauri-plugin-store` の `settings.json` から読み込む
- `autoSave: false` で手動保存（`updateSettings` 内で `store.save()` を明示的に呼ぶ）
- `settingsRef` パターン: React Strict Mode での二重呼び出し対策として `useRef` で最新値を保持
- 保存先: `~/Library/Application Support/com.colima-desktop.app/settings.json`

---

## コンポーネント（src/components）

### `ContainerTable`

| Props | 型 |
|---|---|
| `containers` | `ContainerSummary[]` |
| `onRefetch` | `() => Promise<void>` |

- Start / Stop / Restart / Remove ボタンを持つ
- Remove 時に確認ダイアログを表示（停止中コンテナの場合は強制削除の追加確認あり）
- ログアイコンクリックで `LogViewer` モーダルを開く
- 操作中は `operatingId` state で対象行のボタンをdisable
- 操作完了後は `finally` で `onRefetch()` を呼ぶ（`operatingId` リセット → `refetch` の順）

---

### `ImageTable`

| Props | 型 |
|---|---|
| `images` | `ImageSummary[]` |
| `onRefetch` | `() => Promise<void>` |

- Pull（テキスト入力 `name:tag`）と Remove ボタンを持つ
- Remove 時に確認ダイアログを表示

---

### `VolumeTable`

| Props | 型 |
|---|---|
| `volumes` | `VolumeSummary[]` |
| `onRefetch` | `() => Promise<void>` |

- 個別削除と「Prune（未使用を一括削除）」ボタンを持つ
- いずれも確認ダイアログを表示

---

### `ComposeTable`

| Props | 型 |
|---|---|
| `projects` | `ComposeProject[]` |
| `onRefetch` | `() => Promise<void>` |

- プロジェクト単位で Up / Stop / Down / Restart を操作
- 各サービスの状態（state / status）を一覧表示

---

### `LogViewer`

| Props | 型 |
|---|---|
| `containerId` | `string` |
| `containerName` | `string` |
| `onClose` | `() => void` |

- モーダルとして表示
- `invoke("get_container_logs", { containerId, tail: 200 })` でログを取得
- 等幅フォントでスクロール可能な領域に表示

---

## ページ（src/pages）

### `ContainersPage`

```ts
type Props = { refreshInterval: number };
```

- `useContainers(refreshInterval)` → `ContainerTable`

---

### `ImagesPage`

- `useImages()` → `ImageTable`

---

### `VolumesPage`

- `useVolumes()` → `VolumeTable`

---

### `ComposePage`

- `useCompose()` → `ComposeTable`

---

### `SettingsPage`

```ts
type Props = {
  settings: Settings;
  updateSettings: (partial: Partial<Settings>) => Promise<void>;
};
```

- Socket path・Colima profile・refresh interval・theme の設定フォーム
- 「接続テスト」ボタンで `invoke("check_docker_connection")` を実行
- profile 選択肢は `invoke("list_colima_profiles")` で取得

---

## App.tsx

### `ConnectionPage`（内部コンポーネント）

Colima の手動 start / stop と接続状態表示を担当。

```
state: ConnectionState = "loading" | "connected" | "error"
colimaAction: "idle" | "running"
```

- 起動時に `list_colima_profiles` でプロファイル一覧を取得
- プロファイル切り替えで `resolve_socket_for_profile` を呼び接続先を変更
- Start/Stop 完了後は必ず `checkConnection()` で接続状態を再確認

---

### `App`（ルートコンポーネント）

```
currentPage: "containers" | "images" | "compose" | "volumes" | "connection" | "settings"
```

- `useSettings()` でテーマ・設定を管理
- `settings.theme` が変わるたびに `document.body.className = "theme-{theme}"` を更新
- サイドバーのナビゲーションボタンで `currentPage` を切り替える
- `ContainersPage` にのみ `settings.refreshInterval` を渡す
- `SettingsPage` には `settings` と `updateSettings` を props で渡す（グローバル状態は持たない）
