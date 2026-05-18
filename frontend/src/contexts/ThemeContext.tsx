import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useSettings } from './SettingsContext';

export type UITheme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  uiTheme: UITheme;
  resolvedUiTheme: ResolvedTheme;
  setUiTheme: (theme: UITheme) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isUITheme(v: unknown): v is UITheme {
  return v === 'light' || v === 'dark' || v === 'system';
}

function readSystemPref(): ResolvedTheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { getSetting, setSetting } = useSettings();
  const rawTheme = getSetting<unknown>('ui_theme', 'system');
  const uiTheme: UITheme = isUITheme(rawTheme) ? rawTheme : 'system';

  const [systemPref, setSystemPref] = useState<ResolvedTheme>(readSystemPref);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemPref(e.matches ? 'dark' : 'light');
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const resolvedUiTheme: ResolvedTheme = uiTheme === 'system' ? systemPref : uiTheme;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolvedUiTheme === 'dark');
  }, [resolvedUiTheme]);

  const setUiTheme = useCallback(async (theme: UITheme) => {
    await setSetting('ui_theme', theme);
  }, [setSetting]);

  return (
    <ThemeContext.Provider value={{ uiTheme, resolvedUiTheme, setUiTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
