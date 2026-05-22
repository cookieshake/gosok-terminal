import type { ITheme } from '@xterm/xterm';

export type TerminalThemeId =
  | 'catppuccin-latte'
  | 'catppuccin-mocha'
  | 'solarized-light'
  | 'solarized-dark'
  | 'tokyo-night'
  | 'gruvbox-dark'
  | 'dracula'
  | 'github-light';

interface ThemeEntry {
  label: string;
  isDark: boolean;
  theme: ITheme;
}

export const TERMINAL_THEMES: Record<TerminalThemeId, ThemeEntry> = {
  'catppuccin-latte': {
    label: 'Catppuccin Latte',
    isDark: false,
    theme: {
      background: '#eff1f5', foreground: '#4c4f69',
      cursor: '#dc8a78', selectionBackground: '#acb0be',
      black: '#5c5f77', red: '#d20f39', green: '#40a02b', yellow: '#df8e1d',
      blue: '#1e66f5', magenta: '#8839ef', cyan: '#179299', white: '#acb0be',
      brightBlack: '#6c6f85', brightRed: '#d20f39', brightGreen: '#40a02b',
      brightYellow: '#df8e1d', brightBlue: '#1e66f5', brightMagenta: '#8839ef',
      brightCyan: '#179299', brightWhite: '#4c4f69',
    },
  },
  'catppuccin-mocha': {
    label: 'Catppuccin Mocha',
    isDark: true,
    theme: {
      background: '#1e1e2e', foreground: '#cdd6f4',
      cursor: '#f5e0dc', selectionBackground: '#585b70',
      black: '#45475a', red: '#f38ba8', green: '#a6e3a1', yellow: '#f9e2af',
      blue: '#89b4fa', magenta: '#cba6f7', cyan: '#94e2d5', white: '#bac2de',
      brightBlack: '#585b70', brightRed: '#f38ba8', brightGreen: '#a6e3a1',
      brightYellow: '#f9e2af', brightBlue: '#89b4fa', brightMagenta: '#cba6f7',
      brightCyan: '#94e2d5', brightWhite: '#a6adc8',
    },
  },
  'solarized-light': {
    label: 'Solarized Light',
    isDark: false,
    theme: {
      background: '#fdf6e3', foreground: '#657b83',
      cursor: '#586e75', selectionBackground: '#eee8d5',
      black: '#073642', red: '#dc322f', green: '#859900', yellow: '#b58900',
      blue: '#268bd2', magenta: '#d33682', cyan: '#2aa198', white: '#eee8d5',
      brightBlack: '#002b36', brightRed: '#cb4b16', brightGreen: '#586e75',
      brightYellow: '#657b83', brightBlue: '#839496', brightMagenta: '#6c71c4',
      brightCyan: '#93a1a1', brightWhite: '#fdf6e3',
    },
  },
  'solarized-dark': {
    label: 'Solarized Dark',
    isDark: true,
    theme: {
      background: '#002b36', foreground: '#839496',
      cursor: '#93a1a1', selectionBackground: '#073642',
      black: '#073642', red: '#dc322f', green: '#859900', yellow: '#b58900',
      blue: '#268bd2', magenta: '#d33682', cyan: '#2aa198', white: '#eee8d5',
      brightBlack: '#002b36', brightRed: '#cb4b16', brightGreen: '#586e75',
      brightYellow: '#657b83', brightBlue: '#839496', brightMagenta: '#6c71c4',
      brightCyan: '#93a1a1', brightWhite: '#fdf6e3',
    },
  },
  'tokyo-night': {
    label: 'Tokyo Night',
    isDark: true,
    theme: {
      background: '#1a1b26', foreground: '#a9b1d6',
      cursor: '#c0caf5', selectionBackground: '#33467c',
      black: '#15161e', red: '#f7768e', green: '#9ece6a', yellow: '#e0af68',
      blue: '#7aa2f7', magenta: '#bb9af7', cyan: '#7dcfff', white: '#a9b1d6',
      brightBlack: '#414868', brightRed: '#f7768e', brightGreen: '#9ece6a',
      brightYellow: '#e0af68', brightBlue: '#7aa2f7', brightMagenta: '#bb9af7',
      brightCyan: '#7dcfff', brightWhite: '#c0caf5',
    },
  },
  'gruvbox-dark': {
    label: 'Gruvbox Dark',
    isDark: true,
    theme: {
      background: '#282828', foreground: '#ebdbb2',
      cursor: '#ebdbb2', selectionBackground: '#504945',
      black: '#282828', red: '#cc241d', green: '#98971a', yellow: '#d79921',
      blue: '#458588', magenta: '#b16286', cyan: '#689d6a', white: '#a89984',
      brightBlack: '#928374', brightRed: '#fb4934', brightGreen: '#b8bb26',
      brightYellow: '#fabd2f', brightBlue: '#83a598', brightMagenta: '#d3869b',
      brightCyan: '#8ec07c', brightWhite: '#ebdbb2',
    },
  },
  'dracula': {
    label: 'Dracula',
    isDark: true,
    theme: {
      background: '#282a36', foreground: '#f8f8f2',
      cursor: '#f8f8f2', selectionBackground: '#44475a',
      black: '#21222c', red: '#ff5555', green: '#50fa7b', yellow: '#f1fa8c',
      blue: '#bd93f9', magenta: '#ff79c6', cyan: '#8be9fd', white: '#f8f8f2',
      brightBlack: '#6272a4', brightRed: '#ff6e6e', brightGreen: '#69ff94',
      brightYellow: '#ffffa5', brightBlue: '#d6acff', brightMagenta: '#ff92df',
      brightCyan: '#a4ffff', brightWhite: '#ffffff',
    },
  },
  'github-light': {
    label: 'GitHub Light',
    isDark: false,
    theme: {
      background: '#ffffff', foreground: '#24292f',
      cursor: '#24292f', selectionBackground: '#bdd7ff',
      black: '#24292f', red: '#cf222e', green: '#116329', yellow: '#4d2d00',
      blue: '#0969da', magenta: '#8250df', cyan: '#1b7c83', white: '#6e7781',
      brightBlack: '#57606a', brightRed: '#a40e26', brightGreen: '#1a7f37',
      brightYellow: '#633c01', brightBlue: '#218bff', brightMagenta: '#a475f9',
      brightCyan: '#3192aa', brightWhite: '#8c959f',
    },
  },
};

export const DEFAULT_TERMINAL_THEME_ID: TerminalThemeId = 'catppuccin-latte';

export function getTerminalTheme(id: string): ITheme {
  return (TERMINAL_THEMES[id as TerminalThemeId] ?? TERMINAL_THEMES[DEFAULT_TERMINAL_THEME_ID]).theme;
}

export function getTerminalThemeMeta(id: string): ThemeEntry {
  return TERMINAL_THEMES[id as TerminalThemeId] ?? TERMINAL_THEMES[DEFAULT_TERMINAL_THEME_ID];
}
