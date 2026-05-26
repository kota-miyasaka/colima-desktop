import { useContainers } from "../hooks/useContainers";
import { ContainerTable } from "../components/ContainerTable";

type Props = {
  refreshInterval?: number;
};

export function ContainersPage({ refreshInterval = 0 }: Props) {
  const { containers, loading, error, refetch } = useContainers(refreshInterval);

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Containers</h2>
        <button
          className="refresh-btn"
          onClick={refetch}
          disabled={loading}
        >
          {loading ? "読み込み中..." : "更新"}
        </button>
      </div>

      {loading && (
        <div className="loading-area">
          <div className="spinner" />
          <p className="loading">コンテナ一覧を取得しています...</p>
        </div>
      )}

      {error && !loading && (
        <div className="error-box">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && (
        <ContainerTable containers={containers} refetch={refetch} />
      )}
    </div>
  );
}
