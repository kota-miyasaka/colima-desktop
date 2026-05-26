import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { VolumeSummary } from "../types/volume";
import type { OperationResult } from "../types/container";

type Props = {
  volumes: VolumeSummary[];
  refetch: () => Promise<void>;
};

export function VolumeTable({ volumes, refetch }: Props) {
  const [operatingName, setOperatingName] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);

  async function handleRemove(volume: VolumeSummary) {
    if (
      !window.confirm(
        `「${volume.name}」を削除しますか？この操作は元に戻せません。`
      )
    ) {
      return;
    }

    setOperatingName(volume.name);
    setOperationError(null);
    try {
      const result = await invoke<OperationResult>("remove_volume", {
        name: volume.name,
      });
      if (!result.success && result.message) {
        setOperationError(result.message);
      }
    } catch (err) {
      setOperationError(String(err));
    } finally {
      try {
        await refetch();
      } catch {
        // refetch の失敗はサイレントに無視
      } finally {
        setOperatingName(null);
      }
    }
  }

  if (volumes.length === 0) {
    return <p className="empty-message">Volume が見つかりません</p>;
  }

  return (
    <div className="container-table-wrapper">
      {operationError && (
        <div className="error-box" style={{ marginBottom: "1rem" }}>
          <p>{operationError}</p>
        </div>
      )}
      <table className="container-table">
        <thead>
          <tr>
            <th>名前</th>
            <th>Driver</th>
            <th>Mountpoint</th>
            <th>使用コンテナ</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {volumes.map((vol) => {
            const isOperating = operatingName === vol.name;
            const isAnyOperating = operatingName !== null;

            return (
              <tr key={vol.name}>
                <td className="col-name">{vol.name}</td>
                <td className="mono">{vol.driver}</td>
                <td
                  className="mono col-id"
                  title={vol.mountpoint}
                  style={{ maxWidth: "240px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {vol.mountpoint}
                </td>
                <td>
                  {vol.usedByContainers.length > 0
                    ? vol.usedByContainers.join(", ")
                    : "-"}
                </td>
                <td className="col-actions">
                  <button
                    className="action-btn action-btn-remove"
                    disabled={isAnyOperating}
                    onClick={() => handleRemove(vol)}
                  >
                    {isOperating ? "処理中..." : "Remove"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
