import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { confirm } from "@tauri-apps/plugin-dialog";
import type { ImageSummary } from "../types/image";
import type { OperationResult } from "../types/container";

type Props = {
  images: ImageSummary[];
  refetch: () => Promise<void>;
};

function parseRepoTag(repoTags: string[]): { repo: string; tag: string } {
  const first = repoTags[0];
  if (!first || first === "<none>:<none>") {
    return { repo: "<none>", tag: "<none>" };
  }
  const colonIdx = first.lastIndexOf(":");
  if (colonIdx === -1) {
    return { repo: first, tag: "<none>" };
  }
  return { repo: first.slice(0, colonIdx), tag: first.slice(colonIdx + 1) };
}

function formatImageId(id: string): string {
  const stripped = id.startsWith("sha256:") ? id.slice(7) : id;
  return stripped.slice(0, 12);
}

function formatCreated(unixTimestamp: number): string {
  const date = new Date(unixTimestamp * 1000);
  return date.toLocaleString();
}

function formatSize(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

function getDisplayName(image: ImageSummary): string {
  if (image.repoTags.length > 0 && image.repoTags[0] !== "<none>:<none>") {
    return image.repoTags[0];
  }
  return formatImageId(image.id);
}

export function ImageTable({ images, refetch }: Props) {
  const [operatingId, setOperatingId] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);

  async function handleRemove(image: ImageSummary) {
    const displayName = getDisplayName(image);
    const message = `「${displayName}」を削除しますか？この操作は元に戻せません。`;
    if (!(await confirm(message, { title: "確認", kind: "warning" }))) return;

    setOperatingId(image.id);
    setOperationError(null);
    try {
      await invoke<OperationResult>("remove_image", {
        idOrName: image.id,
        force: false,
      });
    } catch (err) {
      setOperationError(String(err));
    } finally {
      try {
        await refetch();
      } catch {
        // refetch の失敗はサイレントに無視（操作結果の表示を妨げない）
      } finally {
        setOperatingId(null);
      }
    }
  }

  if (images.length === 0) {
    return <p className="empty-message">イメージが見つかりません</p>;
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
            <th>Repository</th>
            <th>Tag</th>
            <th>Image ID</th>
            <th>作成日時</th>
            <th>Size</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {images.map((img) => {
            const { repo, tag } = parseRepoTag(img.repoTags);
            const isOperating = operatingId === img.id;
            const isAnyOperating = operatingId !== null;

            return (
              <tr key={img.id}>
                <td className="col-name">{repo}</td>
                <td className="mono">{tag}</td>
                <td className="col-id mono">{formatImageId(img.id)}</td>
                <td className="col-created">{formatCreated(img.created)}</td>
                <td className="mono">{formatSize(img.size)}</td>
                <td className="col-actions">
                  <button
                    className="action-btn action-btn-remove"
                    disabled={isAnyOperating}
                    onClick={() => handleRemove(img)}
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
