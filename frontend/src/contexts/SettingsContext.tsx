import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import * as api from '../api/client';

interface SettingsContextValue {
  settings: Record<string, unknown>;
  getSetting: <T>(key: string, defaultValue: T) => T;
  setSetting: (key: string, value: unknown) => Promise<void>;
  resetSetting: (key: string) => Promise<void>;
  reload: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Record<string, unknown>>({});

  const reload = useCallback(async () => {
    const data = await api.listSettings();
    setSettings(data || {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.listSettings().then(data => {
      if (!cancelled) setSettings(data || {});
    });
    return () => { cancelled = true; };
  }, []);

  const getSetting = useCallback(<T,>(key: string, defaultValue: T): T => {
    return key in settings ? (settings[key] as T) : defaultValue;
  }, [settings]);

  const handleSetSetting = useCallback(async (key: string, value: unknown) => {
    await api.setSetting(key, value);
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleResetSetting = useCallback(async (key: string) => {
    await api.resetSetting(key);
    setSettings(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  return (
    <SettingsContext.Provider value={{
      settings,
      getSetting,
      setSetting: handleSetSetting,
      resetSetting: handleResetSetting,
      reload,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
