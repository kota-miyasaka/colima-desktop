import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { OperationResult } from "../types/container";
import { useImages } from "../hooks/useImages";
import { ImageTable } from "../components/ImageTable";

export function ImagesPage() {
  const { images, loading, error, refetch } = useImages();
  const [pullInput, setPullInput] = useState("");
  const [pulling, setPulling] = useState(false);
  const [pullError, setPullError] = useState<string | null>(null);

  async function handlePull() {
    const image = pullInput.trim();
    if (!image) return;

    setPulling(true);
    setPullError(null);
    try {
      await invoke<OperationResult>("pull_image", { image });
      await refetch();
    } catch (err) {
      setPullError(String(err));
    } finally {
      setPulling(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !pulling) {
      handlePull();
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Images</h2>
        <button
          className="refresh-btn"
          onClick={refetch}
          disabled={loading || pulling}
        >
          {loading ? "読み込み中..." : "更新"}
        </button>
      </div>

      <div className="pull-form">
        <input
          className="pull-input"
          type="text"
          placeholder="nginx:latest"
          value={pullInput}
          onChange={(e) => setPullInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={pulling}
        />
        <button
          className="pull-btn"
          onClick={handlePull}
          disabled={pulling || pullInput.trim() === ""}
        >
          {pulling ? "取得中..." : "Pull"}
        </button>
      </div>

      {pullError && (
        <div className="error-box" style={{ marginBottom: "1rem" }}>
          <p>{pullError}</p>
        </div>
      )}

      {loading && (
        <div className="loading-area">
          <div className="spinner" />
          <p className="loading">イメージ一覧を取得しています...</p>
        </div>
      )}

      {error && !loading && (
        <div className="error-box">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && (
        <ImageTable images={images} refetch={refetch} />
      )}
    </div>
  );
}
