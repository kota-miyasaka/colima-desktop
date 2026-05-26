import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { VolumeSummary } from "../types/volume";

type UseVolumesState = {
  volumes: VolumeSummary[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export function useVolumes(): UseVolumesState {
  const [volumes, setVolumes] = useState<VolumeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<VolumeSummary[]>("list_volumes");
      setVolumes(result);
    } catch (err) {
      setError(String(err));
      setVolumes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { volumes, loading, error, refetch };
}
