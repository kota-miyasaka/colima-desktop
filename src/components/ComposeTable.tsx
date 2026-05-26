import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ComposeProject } from "../types/compose";
import type { OperationResult } from "../types/container";

type Props = {
  projects: ComposeProject[];
  refetch: () => Promise<void>;
};

function StateBadge({ state }: { state: string }) {
  let className = "state-badge";
  if (state === "running") {
    className += " state-running";
  } else {
    className += " state-other";
  }
  return <span className={className}>{state}</span>;
}

export function ComposeTable({ projects, refetch }: Props) {
  const [operatingProject, setOperatingProject] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);

  async function handleOperation(
    projectName: string,
    workingDir: string,
    command: string
  ) {
    setOperatingProject(projectName);
    setOperationError(null);
    try {
      const result = await invoke<OperationResult>(command, { workingDir });
      if (!result.success && result.message) {
        setOperationError(result.message);
      }
    } catch (err) {
      setOperationError(String(err));
    } finally {
      await refetch();
      setOperatingProject(null);
    }
  }

  if (projects.length === 0) {
    return <p className="empty-message">Docker Compose プロジェクトが見つかりません</p>;
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
            <th>プロジェクト / サービス</th>
            <th>コンテナID</th>
            <th>State</th>
            <th>Status</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => {
            const isOperating = operatingProject === project.name;
            const isAnyOperating = operatingProject !== null;

            return (
              <>
                {/* プロジェクト行 */}
                <tr key={`project-${project.name}`} style={{ background: "var(--bg-secondary, #f5f5f5)" }}>
                  <td colSpan={1} style={{ fontWeight: "bold" }}>
                    {project.name}
                    {project.workingDir && (
                      <span
                        className="mono"
                        style={{ fontSize: "0.75rem", fontWeight: "normal", marginLeft: "0.5rem", opacity: 0.7 }}
                      >
                        {project.workingDir}
                      </span>
                    )}
                  </td>
                  <td className="mono" style={{ opacity: 0.5 }}>—</td>
                  <td>—</td>
                  <td>—</td>
                  <td className="col-actions">
                    <button
                      className="action-btn action-btn-start"
                      disabled={isAnyOperating}
                      onClick={() => handleOperation(project.name, project.workingDir, "compose_up")}
                    >
                      {isOperating ? "処理中..." : "Up"}
                    </button>
                    <button
                      className="action-btn action-btn-stop"
                      disabled={isAnyOperating}
                      onClick={() => handleOperation(project.name, project.workingDir, "compose_stop")}
                    >
                      {isOperating ? "処理中..." : "Stop"}
                    </button>
                    <button
                      className="action-btn action-btn-remove"
                      disabled={isAnyOperating}
                      onClick={() => handleOperation(project.name, project.workingDir, "compose_down")}
                    >
                      {isOperating ? "処理中..." : "Down"}
                    </button>
                    <button
                      className="action-btn action-btn-restart"
                      disabled={isAnyOperating}
                      onClick={() => handleOperation(project.name, project.workingDir, "compose_restart")}
                    >
                      {isOperating ? "処理中..." : "Restart"}
                    </button>
                  </td>
                </tr>
                {/* サービス行 */}
                {project.services.map((service) => (
                  <tr key={`service-${project.name}-${service.containerId}`}>
                    <td style={{ paddingLeft: "2rem" }}>
                      {service.name}
                    </td>
                    <td className="col-id mono">
                      {service.containerId.slice(0, 12)}
                    </td>
                    <td className="col-state">
                      <StateBadge state={service.state} />
                    </td>
                    <td className="col-status">{service.status}</td>
                    <td>—</td>
                  </tr>
                ))}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
