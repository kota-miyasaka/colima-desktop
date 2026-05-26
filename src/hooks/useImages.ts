import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ImageSummary } from "../types/image";

type UseImagesState = {
  images: ImageSummary[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export function useImages(): UseImagesState {
  const [images, setImages] = useState<ImageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<ImageSummary[]>("list_images");
      setImages(result);
    } catch (err) {
      setError(String(err));
      setImages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { images, loading, error, refetch };
}
