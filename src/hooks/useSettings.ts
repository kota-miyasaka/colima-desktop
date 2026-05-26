import { useState, useEffect, useCallback, useRef } from "react";
import { load } from "@tauri-apps/plugin-store";

export type Settings = {
  socketPath: string;
  colimaProfile: string;
  refreshInterval: number;
  theme: "light" | "dark";
};

const DEFAULT_SETTINGS: Settings = {
  socketPath: "",
  colimaProfile: "default",
  refreshInterval: 0,
  theme: "light",
};

const STORE_FILE = "settings.json";

type UseSettingsState = {
  settings: Settings;
  updateSettings: (partial: Partial<Settings>) => Promise<void>;
  isLoaded: boolean;
};

export function useSettings(): UseSettingsState {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);
  // 非同期保存時に最新の settings を参照するための ref
  const settingsRef = useRef<Settings>(DEFAULT_SETTINGS);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // 起動時にストアから設定を読み込む
  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        // autoSave は無効化して手動保存に統一する
        const store = await load(STORE_FILE, {
          defaults: {},
          autoSave: false,
        });

        const socketPath =
          (await store.get<string>("socketPath")) ?? DEFAULT_SETTINGS.socketPath;
        const colimaProfile =
          (await store.get<string>("colimaProfile")) ??
          DEFAULT_SETTINGS.colimaProfile;
        const refreshInterval =
          (await store.get<number>("refreshInterval")) ??
          DEFAULT_SETTINGS.refreshInterval;
        const theme =
          (await store.get<"light" | "dark">("theme")) ??
          DEFAULT_SETTINGS.theme;

        if (!cancelled) {
          setSettings({ socketPath, colimaProfile, refreshInterval, theme });
        }
      } catch {
        // 読み込み失敗時はデフォルト値を使用する
      } finally {
        if (!cancelled) {
          setIsLoaded(true);
        }
      }
    }

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  const updateSettings = useCallback(async (partial: Partial<Settings>) => {
    // 1. 次の値を計算する
    const next = { ...settingsRef.current, ...partial };
    // 2. state を更新する（副作用なし）
    setSettings(next);
    // 3. 保存は updater の外で実行する（エラーはサイレントに無視）
    try {
      const store = await load(STORE_FILE, { defaults: {}, autoSave: false });
      for (const [key, value] of Object.entries(next)) {
        await store.set(key, value);
      }
      await store.save();
    } catch {
      // 保存失敗はサイレントに無視
    }
  }, []);

  return { settings, updateSettings, isLoaded };
}
