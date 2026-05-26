import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Settings } from "../hooks/useSettings";

type Props = {
  settings: Settings;
  updateSettings: (partial: Partial<Settings>) => Promise<void>;
};

type ConnectionTestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

const REFRESH_OPTIONS = [
  { value: 0, label: "off" },
  { value: 5, label: "5秒" },
  { value: 10, label: "10秒" },
  { value: 30, label: "30秒" },
  { value: 60, label: "60秒" },
] as const;

export function SettingsPage({ settings, updateSettings }: Props) {
  const [localSettings, setLocalSettings] = useState<Settings>(settings);
  const [profiles, setProfiles] = useState<string[]>([]);
  const [connectionTest, setConnectionTest] = useState<ConnectionTestState>({
    status: "idle",
  });
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // 外部からの settings 変更を local state に同期する
  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  // プロファイル一覧を取得する
  useEffect(() => {
    invoke<string[]>("list_colima_profiles")
      .then((list) => setProfiles(list.length > 0 ? list : ["default"]))
      .catch(() => setProfiles(["default"]));
  }, []);

  const handleConnectionTest = useCallback(async () => {
    setConnectionTest({ status: "testing" });
    try {
      const socketPath = localSettings.socketPath.trim() || null;
      const info = await invoke<{
        socketPath: string;
        dockerVersion: string;
        apiVersion: string;
      }>("check_docker_connection", { socketPath });
      setConnectionTest({
        status: "ok",
        message: `接続成功: Docker ${info.dockerVersion} (${info.socketPath})`,
      });
    } catch (err) {
      setConnectionTest({ status: "error", message: String(err) });
    }
  }, [localSettings.socketPath]);

  const handleSave = useCallback(async () => {
    await updateSettings(localSettings);
    setSaveMessage("設定を保存しました");
    setTimeout(() => setSaveMessage(null), 3000);
  }, [localSettings, updateSettings]);

  return (
    <div className="page settings-page">
      <div className="page-header">
        <h2 className="page-title">Settings</h2>
      </div>

      <div className="settings-card">
        {/* Docker socket path */}
        <div className="settings-section">
          <label className="settings-label" htmlFor="socket-path">
            Docker Socket Path
          </label>
          <p className="settings-hint">空欄の場合は自動検出します</p>
          <div className="settings-input-row">
            <input
              id="socket-path"
              type="text"
              className="settings-input"
              placeholder="~/.colima/default/docker.sock"
              value={localSettings.socketPath}
              onChange={(e) =>
                setLocalSettings((prev) => ({
                  ...prev,
                  socketPath: e.target.value,
                }))
              }
            />
            <button
              className="test-btn"
              onClick={handleConnectionTest}
              disabled={connectionTest.status === "testing"}
            >
              {connectionTest.status === "testing" ? (
                <>
                  <span className="btn-spinner" />
                  テスト中...
                </>
              ) : (
                "接続テスト"
              )}
            </button>
          </div>

          {connectionTest.status === "ok" && (
            <p className="settings-result settings-result-ok">
              {connectionTest.message}
            </p>
          )}
          {connectionTest.status === "error" && (
            <p className="settings-result settings-result-error">
              {connectionTest.message}
            </p>
          )}
        </div>

        {/* Colima profile */}
        <div className="settings-section">
          <label className="settings-label" htmlFor="colima-profile">
            Colima Profile
          </label>
          <select
            id="colima-profile"
            className="settings-select"
            value={localSettings.colimaProfile}
            onChange={(e) =>
              setLocalSettings((prev) => ({
                ...prev,
                colimaProfile: e.target.value,
              }))
            }
          >
            {profiles.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {/* Refresh interval */}
        <div className="settings-section">
          <label className="settings-label" htmlFor="refresh-interval">
            自動更新間隔
          </label>
          <select
            id="refresh-interval"
            className="settings-select"
            value={localSettings.refreshInterval}
            onChange={(e) =>
              setLocalSettings((prev) => ({
                ...prev,
                refreshInterval: Number(e.target.value),
              }))
            }
          >
            {REFRESH_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Theme */}
        <div className="settings-section">
          <span className="settings-label">テーマ</span>
          <div className="settings-radio-group">
            <label className="settings-radio-label">
              <input
                type="radio"
                name="theme"
                value="light"
                checked={localSettings.theme === "light"}
                onChange={() =>
                  setLocalSettings((prev) => ({ ...prev, theme: "light" }))
                }
              />
              Light
            </label>
            <label className="settings-radio-label">
              <input
                type="radio"
                name="theme"
                value="dark"
                checked={localSettings.theme === "dark"}
                onChange={() =>
                  setLocalSettings((prev) => ({ ...prev, theme: "dark" }))
                }
              />
              Dark
            </label>
          </div>
        </div>

        {/* Save button */}
        <div className="settings-footer">
          <button className="save-btn" onClick={handleSave}>
            保存
          </button>
          {saveMessage && (
            <span className="save-message">{saveMessage}</span>
          )}
        </div>
      </div>
    </div>
  );
}
