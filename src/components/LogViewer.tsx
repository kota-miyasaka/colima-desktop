import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

type Props = {
  containerId: string;
  containerName: string;
  onClose: () => void;
};

export function LogViewer({ containerId, containerName, onClose }: Props) {
  const [logs, setLogs] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<string>("get_container_logs", {
        containerId,
        tail: 200,
      });
      setLogs(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [containerId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // オーバーレイクリックで閉じる
  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{containerName} — ログ</span>
          <div className="modal-actions">
            <button
              className="action-btn action-btn-restart"
              onClick={fetchLogs}
              disabled={loading}
            >
              {loading ? "取得中..." : "更新"}
            </button>
            <button className="modal-close-btn" onClick={onClose}>
              ×
            </button>
          </div>
        </div>
        <div className="modal-body">
          {loading && !logs && (
            <p className="loading">取得中...</p>
          )}
          {error && (
            <div className="error-box">
              <p>{error}</p>
            </div>
          )}
          {logs !== null && (
            <pre className="log-output">{logs || "（ログなし）"}</pre>
          )}
        </div>
      </div>
    </div>
  );
}
