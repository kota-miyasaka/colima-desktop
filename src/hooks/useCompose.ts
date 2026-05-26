import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ComposeProject } from "../types/compose";

type UseComposeState = {
  projects: ComposeProject[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export function useCompose(): UseComposeState {
  const [projects, setProjects] = useState<ComposeProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<ComposeProject[]>("list_compose_projects");
      setProjects(result);
    } catch (err) {
      setError(String(err));
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { projects, loading, error, refetch };
}
