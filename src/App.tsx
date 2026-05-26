import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { DockerConnectionInfo } from "./types/container";
import { ContainersPage } from "./pages/ContainersPage";
import { ImagesPage } from "./pages/ImagesPage";
import { ComposePage } from "./pages/ComposePage";
import { VolumesPage } from "./pages/VolumesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { useSettings } from "./hooks/useSettings";
import "./index.css";

type Page = "connection" | "containers" | "images" | "compose" | "volumes" | "settings";

type ConnectionState =
  | { status: "loading" }
  | { status: "connected"; info: DockerConnectionInfo }
  | { status: "error"; message: string };

type ColimaActionState = "idle" | "running";

function ConnectionPage() {
  const [state, setState] = useState<ConnectionState>({ status: "loading" });
  const [profiles, setProfiles] = useState<string[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>("default");
  const [colimaAction, setColimaAction] = useState<ColimaActionState>("idle");
  const [colimaError, setColimaError] = useState<string | null>(null);

  const checkConnection = useCallback(
    async (profile?: string) => {
      setState({ status: "loading" });
      setColimaError(null);
      const p = profile ?? selectedProfile;
      try {
        // ~ を展開できないため Rust 側でパスを解決する
        let socketPath: string | null = null;
        if (p !== "default") {
          socketPath = await invoke<string>("resolve_socket_for_profile", { profile: p });
        }
        const info = await invoke<DockerConnectionInfo>(
          "check_docker_connection",
          { socketPath }
        );
        setState({ status: "connected", info });
      } catch (err) {
        setState({ status: "error", message: String(err) });
      }
    },
    [selectedProfile]
  );

  // 起動時にプロファイル一覧を取得し、接続確認も実行
  useEffect(() => {
    invoke<string[]>("list_colima_profiles")
      .then((list) => {
        setProfiles(list);
      })
      .catch(() => {
        // 取得失敗時は空リスト（default のみ表示）
        setProfiles([]);
      });

    checkConnection();
  // checkConnection は初回のみ実行するため依存配列から除外
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleProfileChange = useCallback(
    (profile: string) => {
      setSelectedProfile(profile);
      checkConnection(profile);
    },
    [checkConnection]
  );

  const handleColimaStart = useCallback(async () => {
    setColimaAction("running");
    setColimaError(null);
    try {
      const result = await invoke<{ success: boolean; message?: string }>(
        "colima_start",
        { profile: selectedProfile === "default" ? null : selectedProfile }
      );
      if (!result.success) {
        setColimaError(result.message ?? "colima start に失敗しました");
      }
    } catch (err) {
      setColimaError(String(err));
    } finally {
      try {
        await checkConnection();
      } catch {
        // 接続確認失敗は無視（状態はエラー表示に任せる）
      } finally {
        setColimaAction("idle");
      }
    }
  }, [selectedProfile, checkConnection]);

  const handleColimaStop = useCallback(async () => {
    setColimaAction("running");
    setColimaError(null);
    try {
      const result = await invoke<{ success: boolean; message?: string }>(
        "colima_stop",
        { profile: selectedProfile === "default" ? null : selectedProfile }
      );
      if (!result.success) {
        setColimaError(result.message ?? "colima stop に失敗しました");
      }
    } catch (err) {
      setColimaError(String(err));
    } finally {
      try {
        await checkConnection();
      } catch {
        // 接続確認失敗は無視（状態はエラー表示に任せる）
      } finally {
        setColimaAction("idle");
      }
    }
  }, [selectedProfile, checkConnection]);

  const displayProfiles = profiles.length > 0 ? profiles : ["default"];

  return (
    <div className="page connection-page">
      <div className="connection-card">
        <h2>Docker 接続</h2>

        {/* プロファイル選択 */}
        <div className="profile-section">
          <label className="profile-label" htmlFor="profile-select">
            Colima Profile
          </label>
          <select
            id="profile-select"
            className="profile-select"
            value={selectedProfile}
            onChange={(e) => handleProfileChange(e.target.value)}
            disabled={colimaAction === "running"}
          >
            {displayProfiles.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {/* Colima start / stop ボタン */}
        <div className="colima-actions">
          <button
            className="colima-btn colima-btn-start"
            onClick={handleColimaStart}
            disabled={colimaAction === "running"}
          >
            {colimaAction === "running" ? (
              <>
                <span className="btn-spinner" />
                実行中...
              </>
            ) : (
              "Colima Start"
            )}
          </button>
          <button
            className="colima-btn colima-btn-stop"
            onClick={handleColimaStop}
            disabled={colimaAction === "running"}
          >
            {colimaAction === "running" ? (
              <>
                <span className="btn-spinner" />
                実行中...
              </>
            ) : (
              "Colima Stop"
            )}
          </button>
        </div>

        {colimaError && (
          <div className="error-box colima-error-box">
            <p>{colimaError}</p>
          </div>
        )}

        {/* 接続状態 */}
        {state.status === "loading" && (
          <>
            <div className="spinner" />
            <p className="loading">Docker 接続を確認しています...</p>
          </>
        )}

        {state.status === "connected" && (
          <>
            <div className="status-badge connected">
              <span>●</span>
              <span>Connected</span>
            </div>
            <table className="info-table">
              <tbody>
                <tr>
                  <td>Socket Path</td>
                  <td>{state.info.socketPath}</td>
                </tr>
                <tr>
                  <td>Docker Version</td>
                  <td>{state.info.dockerVersion}</td>
                </tr>
                <tr>
                  <td>API Version</td>
                  <td>{state.info.apiVersion}</td>
                </tr>
              </tbody>
            </table>
            <button
              className="retry-btn"
              onClick={() => checkConnection()}
              disabled={colimaAction === "running"}
            >
              再確認
            </button>
          </>
        )}

        {state.status === "error" && (
          <>
            <div className="status-badge disconnected">
              <span>✕</span>
              <span>Disconnected</span>
            </div>
            <div className="error-box">
              <p>{state.message}</p>
            </div>
            <button
              className="retry-btn"
              onClick={() => checkConnection()}
              disabled={colimaAction === "running"}
            >
              再試行
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function App() {
  const [currentPage, setCurrentPage] = useState<Page>("containers");
  const { settings, updateSettings, isLoaded } = useSettings();

  // 設定読み込み完了後の初期化
  useEffect(() => {
    if (!isLoaded) return;

    const socketPath = settings.socketPath.trim() || null;
    invoke("check_docker_connection", { socketPath }).catch(() => {});

    document.body.className = `theme-${settings.theme}`;
  // 初回のみ実行する
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  // テーマ変更を即時反映する
  useEffect(() => {
    if (!isLoaded) return;
    document.body.className = `theme-${settings.theme}`;
  }, [settings.theme, isLoaded]);

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-logo">Colima</span>
        </div>
        <nav className="sidebar-nav">
          <button
            className={`nav-item ${currentPage === "containers" ? "active" : ""}`}
            onClick={() => setCurrentPage("containers")}
          >
            Containers
          </button>
          <button
            className={`nav-item ${currentPage === "images" ? "active" : ""}`}
            onClick={() => setCurrentPage("images")}
          >
            Images
          </button>
          <button
            className={`nav-item ${currentPage === "compose" ? "active" : ""}`}
            onClick={() => setCurrentPage("compose")}
          >
            Compose
          </button>
          <button
            className={`nav-item ${currentPage === "volumes" ? "active" : ""}`}
            onClick={() => setCurrentPage("volumes")}
          >
            Volumes
          </button>
          <button
            className={`nav-item ${currentPage === "connection" ? "active" : ""}`}
            onClick={() => setCurrentPage("connection")}
          >
            Connection
          </button>
          <button
            className={`nav-item ${currentPage === "settings" ? "active" : ""}`}
            onClick={() => setCurrentPage("settings")}
          >
            Settings
          </button>
        </nav>
      </aside>

      <main className="main-content">
        {currentPage === "containers" && <ContainersPage refreshInterval={settings.refreshInterval} />}
        {currentPage === "images" && <ImagesPage />}
        {currentPage === "compose" && <ComposePage />}
        {currentPage === "volumes" && <VolumesPage />}
        {currentPage === "connection" && <ConnectionPage />}
        {currentPage === "settings" && (
          <SettingsPage settings={settings} updateSettings={updateSettings} />
        )}
      </main>
    </div>
  );
}

export default App;
