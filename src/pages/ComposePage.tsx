import { useCompose } from "../hooks/useCompose";
import { ComposeTable } from "../components/ComposeTable";

export function ComposePage() {
  const { projects, loading, error, refetch } = useCompose();

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Compose</h2>
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
          <p className="loading">Compose プロジェクト一覧を取得しています...</p>
        </div>
      )}

      {error && !loading && (
        <div className="error-box">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && (
        <ComposeTable projects={projects} refetch={refetch} />
      )}
    </div>
  );
}
