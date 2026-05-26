import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ContainerSummary } from "../types/container";

type UseContainersState = {
  containers: ContainerSummary[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export function useContainers(refreshInterval = 0): UseContainersState {
  const [containers, setContainers] = useState<ContainerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<ContainerSummary[]>("list_containers", {
        all: true,
      });
      setContainers(result);
    } catch (err) {
      setError(String(err));
      setContainers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (refreshInterval <= 0) return;
    const id = setInterval(() => {
      refetch();
    }, refreshInterval * 1000);
    return () => clearInterval(id);
  }, [refreshInterval, refetch]);

  return { containers, loading, error, refetch };
}
