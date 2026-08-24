import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { confirm } from "@tauri-apps/plugin-dialog";
import type { OperationResult } from "../types/container";
import { useVolumes } from "../hooks/useVolumes";
import { VolumeTable } from "../components/VolumeTable";

export function VolumesPage() {
  const { volumes, loading, error, refetch } = useVolumes();
  const [pruning, setPruning] = useState(false);
  const [pruneError, setPruneError] = useState<string | null>(null);

  async function handlePrune() {
    if (
      !(await confirm(
        "未使用の Volume をすべて削除しますか？この操作は元に戻せません。",
        { title: "確認", kind: "warning" }
      ))
    ) {
      return;
    }

    setPruning(true);
    setPruneError(null);
    try {
      const result = await invoke<OperationResult>("prune_volumes");
      if (!result.success && result.message) {
        setPruneError(result.message);
      }
    } catch (err) {
      setPruneError(String(err));
    } finally {
      // refetch は prune の成否に関わらず実行するが、例外は握りつぶして pruneError を汚染しない
      try {
        await refetch();
      } catch {
        // refetch の失敗はサイレントに無視
      } finally {
        setPruning(false);
      }
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Volumes</h2>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            className="action-btn action-btn-remove"
            onClick={handlePrune}
            disabled={loading || pruning}
          >
            {pruning ? "処理中..." : "未使用 Volume を一括削除（Prune）"}
          </button>
          <button
            className="refresh-btn"
            onClick={refetch}
            disabled={loading || pruning}
          >
            {loading ? "読み込み中..." : "更新"}
          </button>
        </div>
      </div>

      {pruneError && (
        <div className="error-box" style={{ marginBottom: "1rem" }}>
          <p>{pruneError}</p>
        </div>
      )}

      {loading && (
        <div className="loading-area">
          <div className="spinner" />
          <p className="loading">Volume 一覧を取得しています...</p>
        </div>
      )}

      {error && !loading && (
        <div className="error-box">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && (
        <VolumeTable volumes={volumes} refetch={refetch} />
      )}
    </div>
  );
}
