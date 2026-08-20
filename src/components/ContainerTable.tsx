import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ContainerSummary, OperationResult } from "../types/container";
import { LogViewer } from "./LogViewer";

type Props = {
  containers: ContainerSummary[];
  refetch: () => Promise<void>;
};

function StateBadge({ state }: { state: string }) {
  let className = "state-badge";
  if (state === "running") {
    className += " state-running";
  } else if (state === "exited") {
    className += " state-other";
  } else {
    className += " state-other";
  }
  return <span className={className}>{state}</span>;
}

function formatCreated(unixTimestamp: number): string {
  const date = new Date(unixTimestamp * 1000);
  return date.toLocaleString();
}

function formatPorts(container: ContainerSummary): string {
  if (container.ports.length === 0) return "";
  return container.ports
    .map((p) => {
      if (p.publicPort != null) {
        return `${p.publicPort}:${p.privatePort}/${p.portType}`;
      }
      return `${p.privatePort}/${p.portType}`;
    })
    .join("\n");
}

function getContainerName(container: ContainerSummary): string {
  if (container.names.length === 0) return container.id.slice(0, 7);
  return container.names[0].replace(/^\//, "");
}

type LogTarget = {
  containerId: string;
  containerName: string;
};

export function ContainerTable({ containers, refetch }: Props) {
  const [operatingId, setOperatingId] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [logTarget, setLogTarget] = useState<LogTarget | null>(null);

  async function handleOperation(
    containerId: string,
    op: () => Promise<OperationResult>
  ) {
    setOperatingId(containerId);
    setOperationError(null);
    try {
      await op();
    } catch (err) {
      setOperationError(String(err));
    } finally {
      await refetch();
      setOperatingId(null);
    }
  }

  function handleStart(container: ContainerSummary) {
    return handleOperation(container.id, () =>
      invoke<OperationResult>("start_container", { containerId: container.id })
    );
  }

  function handleStop(container: ContainerSummary) {
    return handleOperation(container.id, () =>
      invoke<OperationResult>("stop_container", { containerId: container.id })
    );
  }

  function handleRestart(container: ContainerSummary) {
    return handleOperation(container.id, () =>
      invoke<OperationResult>("restart_container", {
        containerId: container.id,
      })
    );
  }

  function handleRemove(container: ContainerSummary) {
    const name = getContainerName(container);
    const isRunning = container.state === "running";
    const message = isRunning
      ? `「${name}」は起動中です。強制削除しますか？この操作は元に戻せません。`
      : `「${name}」を削除しますか？この操作は元に戻せません。`;

    if (!window.confirm(message)) return;

    return handleOperation(container.id, () =>
      invoke<OperationResult>("remove_container", {
        containerId: container.id,
        force: isRunning,
      })
    );
  }

  function handleOpenLogs(container: ContainerSummary) {
    setLogTarget({
      containerId: container.id,
      containerName: getContainerName(container),
    });
  }

  if (containers.length === 0) {
    return <p className="empty-message">コンテナが見つかりません</p>;
  }

  return (
    <>
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
            <th>State</th>
            <th>ポート</th>
            <th>操作</th>
            <th>ログ</th>
            <th>ID</th>
            <th>イメージ</th>
            <th>Status</th>
            <th>作成日時</th>
          </tr>
        </thead>
        <tbody>
          {containers.map((c) => {
            const isOperating = operatingId === c.id;
            const isAnyOperating = operatingId !== null;

            return (
              <tr key={c.id}>
                <td className="col-name">{getContainerName(c)}</td>
                <td className="col-state">
                  <StateBadge state={c.state} />
                </td>
                <td className="col-ports mono">
                  {formatPorts(c)
                    .split("\n")
                    .map((line, i) => (
                      <span key={i} className="port-line">
                        {line}
                      </span>
                    ))}
                </td>
                <td className="col-actions">
                  {c.state === "running" ? (
                    <>
                      <button
                        className="action-btn action-btn-stop"
                        disabled={isAnyOperating}
                        onClick={() => handleStop(c)}
                      >
                        {isOperating ? "処理中..." : "Stop"}
                      </button>
                      <button
                        className="action-btn action-btn-restart"
                        disabled={isAnyOperating}
                        onClick={() => handleRestart(c)}
                      >
                        {isOperating ? "処理中..." : "Restart"}
                      </button>
                      <button
                        className="action-btn action-btn-remove"
                        disabled={isAnyOperating}
                        onClick={() => handleRemove(c)}
                      >
                        {isOperating ? "処理中..." : "Remove"}
                      </button>
                    </>
                  ) : c.state === "exited" || c.state === "created" ? (
                    <>
                      <button
                        className="action-btn action-btn-start"
                        disabled={isAnyOperating}
                        onClick={() => handleStart(c)}
                      >
                        {isOperating ? "処理中..." : "Start"}
                      </button>
                      <button
                        className="action-btn action-btn-remove"
                        disabled={isAnyOperating}
                        onClick={() => handleRemove(c)}
                      >
                        {isOperating ? "処理中..." : "Remove"}
                      </button>
                    </>
                  ) : (
                    <button
                      className="action-btn action-btn-remove"
                      disabled={isAnyOperating}
                      onClick={() => handleRemove(c)}
                    >
                      {isOperating ? "処理中..." : "Remove"}
                    </button>
                  )}
                </td>
                <td className="col-logs">
                  <button
                    className="action-btn action-btn-logs"
                    onClick={() => handleOpenLogs(c)}
                  >
                    Logs
                  </button>
                </td>
                <td className="col-id mono">{c.id.slice(0, 7)}</td>
                <td className="col-image">{c.image}</td>
                <td className="col-status">{c.status}</td>
                <td className="col-created">{formatCreated(c.created)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    {logTarget && (
      <LogViewer
        containerId={logTarget.containerId}
        containerName={logTarget.containerName}
        onClose={() => setLogTarget(null)}
      />
    )}
    </>
  );
}
