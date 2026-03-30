import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import * as api from '../api/client';

// Client-side settings are stored in localStorage (per-browser appearance prefs).
// Server-side settings are stored in SQLite via API (shared across clients).
const CLIENT_KEYS = new Set([
  'terminal_font_size',
  'terminal_font_family',
  'editor_font_size',
  'editor_font_family',
  'file_panel_width',
  'text_scale',
]);

const LOCAL_STORAGE_KEY = 'gosok-client-settings';

function loadClientSettings(): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveClientSettings(settings: Record<string, unknown>) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
}

interface SettingsContextValue {
  settings: Record<string, unknown>;
  getSetting: <T>(key: string, defaultValue: T) => T;
  setSetting: (key: string, value: unknown) => Promise<void>;
  resetSetting: (key: string) => Promise<void>;
  reload: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [serverSettings, setServerSettings] = useState<Record<string, unknown>>({});
  const [clientSettings, setClientSettings] = useState<Record<string, unknown>>(loadClientSettings);

  const reload = useCallback(async () => {
    const data = await api.listSettings();
    setServerSettings(data || {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.listSettings().then(data => {
      if (!cancelled) setServerSettings(data || {});
    });
    return () => { cancelled = true; };
  }, []);

  const merged = { ...serverSettings, ...clientSettings };

  const getSetting = useCallback(<T,>(key: string, defaultValue: T): T => {
    if (CLIENT_KEYS.has(key)) {
      return key in clientSettings ? (clientSettings[key] as T) : defaultValue;
    }
    return key in serverSettings ? (serverSettings[key] as T) : defaultValue;
  }, [clientSettings, serverSettings]);

  const handleSetSetting = useCallback(async (key: string, value: unknown) => {
    if (CLIENT_KEYS.has(key)) {
      setClientSettings(prev => {
        const next = { ...prev, [key]: value };
        saveClientSettings(next);
        return next;
      });
    } else {
      await api.setSetting(key, value);
      setServerSettings(prev => ({ ...prev, [key]: value }));
    }
  }, []);

  const handleResetSetting = useCallback(async (key: string) => {
    if (CLIENT_KEYS.has(key)) {
      setClientSettings(prev => {
        const next = { ...prev };
        delete next[key];
        saveClientSettings(next);
        return next;
      });
    } else {
      await api.resetSetting(key);
      setServerSettings(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }, []);

  return (
    <SettingsContext.Provider value={{
      settings: merged,
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
