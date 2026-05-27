import type { ITheme } from '@xterm/xterm';

export type TerminalThemeId =
  | 'catppuccin-latte'
  | 'catppuccin-mocha'
  | 'solarized-light'
  | 'solarized-dark'
  | 'tokyo-night'
  | 'gruvbox-dark'
  | 'dracula'
  | 'github-light'
  | 'catppuccin-frappe'
  | 'catppuccin-macchiato'
  | 'nord'
  | 'rose-pine-moon'
  | 'github-dark'
  | 'everforest-dark'
  | 'one-dark'
  | 'kanagawa'
  | 'rose-pine-dawn'
  | 'everforest-light'
  | 'tokyo-night-day'
  | 'one-light'
  | 'gruvbox-light';

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
  'catppuccin-frappe': {
    label: 'Catppuccin Frappé',
    isDark: true,
    theme: {
      background: '#303446', foreground: '#c6d0f5',
      cursor: '#f2d5cf', selectionBackground: '#626880',
      black: '#51576d', red: '#e78284', green: '#a6d189', yellow: '#e5c890',
      blue: '#8caaee', magenta: '#ca9ee6', cyan: '#81c8be', white: '#b5bfe2',
      brightBlack: '#626880', brightRed: '#e78284', brightGreen: '#a6d189',
      brightYellow: '#e5c890', brightBlue: '#8caaee', brightMagenta: '#ca9ee6',
      brightCyan: '#81c8be', brightWhite: '#a5adce',
    },
  },
  'catppuccin-macchiato': {
    label: 'Catppuccin Macchiato',
    isDark: true,
    theme: {
      background: '#24273a', foreground: '#cad3f5',
      cursor: '#f4dbd6', selectionBackground: '#5b6078',
      black: '#494d64', red: '#ed8796', green: '#a6da95', yellow: '#eed49f',
      blue: '#8aadf4', magenta: '#c6a0f6', cyan: '#8bd5ca', white: '#b8c0e0',
      brightBlack: '#5b6078', brightRed: '#ed8796', brightGreen: '#a6da95',
      brightYellow: '#eed49f', brightBlue: '#8aadf4', brightMagenta: '#c6a0f6',
      brightCyan: '#8bd5ca', brightWhite: '#a5adcb',
    },
  },
  'nord': {
    label: 'Nord',
    isDark: true,
    theme: {
      background: '#2e3440', foreground: '#d8dee9',
      cursor: '#d8dee9', selectionBackground: '#434c5e',
      black: '#3b4252', red: '#bf616a', green: '#a3be8c', yellow: '#ebcb8b',
      blue: '#81a1c1', magenta: '#b48ead', cyan: '#88c0d0', white: '#e5e9f0',
      brightBlack: '#4c566a', brightRed: '#bf616a', brightGreen: '#a3be8c',
      brightYellow: '#ebcb8b', brightBlue: '#81a1c1', brightMagenta: '#b48ead',
      brightCyan: '#8fbcbb', brightWhite: '#eceff4',
    },
  },
  'rose-pine-moon': {
    label: 'Rosé Pine Moon',
    isDark: true,
    theme: {
      background: '#232136', foreground: '#e0def4',
      cursor: '#e0def4', selectionBackground: '#312f44',
      black: '#393552', red: '#eb6f92', green: '#3e8fb0', yellow: '#f6c177',
      blue: '#9ccfd8', magenta: '#c4a7e7', cyan: '#ea9a97', white: '#e0def4',
      brightBlack: '#6e6a86', brightRed: '#eb6f92', brightGreen: '#3e8fb0',
      brightYellow: '#f6c177', brightBlue: '#9ccfd8', brightMagenta: '#c4a7e7',
      brightCyan: '#ea9a97', brightWhite: '#e0def4',
    },
  },
  'github-dark': {
    label: 'GitHub Dark',
    isDark: true,
    theme: {
      background: '#0d1117', foreground: '#c9d1d9',
      cursor: '#c9d1d9', selectionBackground: '#264f78',
      black: '#484f58', red: '#ff7b72', green: '#3fb950', yellow: '#d29922',
      blue: '#58a6ff', magenta: '#bc8cff', cyan: '#39c5cf', white: '#b1bac4',
      brightBlack: '#6e7681', brightRed: '#ffa198', brightGreen: '#56d364',
      brightYellow: '#e3b341', brightBlue: '#79c0ff', brightMagenta: '#d2a8ff',
      brightCyan: '#56d4dd', brightWhite: '#f0f6fc',
    },
  },
  'everforest-dark': {
    label: 'Everforest Dark',
    isDark: true,
    theme: {
      background: '#2d353b', foreground: '#d3c6aa',
      cursor: '#d3c6aa', selectionBackground: '#503946',
      black: '#475258', red: '#e67e80', green: '#a7c080', yellow: '#dbbc7f',
      blue: '#7fbbb3', magenta: '#d699b6', cyan: '#83c092', white: '#d3c6aa',
      brightBlack: '#7a8478', brightRed: '#e67e80', brightGreen: '#a7c080',
      brightYellow: '#dbbc7f', brightBlue: '#7fbbb3', brightMagenta: '#d699b6',
      brightCyan: '#83c092', brightWhite: '#d3c6aa',
    },
  },
  'one-dark': {
    label: 'One Dark',
    isDark: true,
    theme: {
      background: '#282c34', foreground: '#abb2bf',
      cursor: '#528bff', selectionBackground: '#3e4451',
      black: '#282c34', red: '#e06c75', green: '#98c379', yellow: '#d19a66',
      blue: '#61afef', magenta: '#c678dd', cyan: '#56b6c2', white: '#abb2bf',
      brightBlack: '#5c6370', brightRed: '#e06c75', brightGreen: '#98c379',
      brightYellow: '#d19a66', brightBlue: '#61afef', brightMagenta: '#c678dd',
      brightCyan: '#56b6c2', brightWhite: '#ffffff',
    },
  },
  'kanagawa': {
    label: 'Kanagawa',
    isDark: true,
    theme: {
      background: '#1f1f28', foreground: '#dcd7ba',
      cursor: '#dcd7ba', selectionBackground: '#223249',
      black: '#16161d', red: '#c34043', green: '#76946a', yellow: '#c0a36e',
      blue: '#7e9cd8', magenta: '#957fb8', cyan: '#6a9589', white: '#c8c093',
      brightBlack: '#727169', brightRed: '#e82424', brightGreen: '#98bb6c',
      brightYellow: '#e6c384', brightBlue: '#7fb4ca', brightMagenta: '#938aa9',
      brightCyan: '#7aa89f', brightWhite: '#dcd7ba',
    },
  },
  'rose-pine-dawn': {
    label: 'Rosé Pine Dawn',
    isDark: false,
    theme: {
      background: '#faf4ed', foreground: '#575279',
      cursor: '#575279', selectionBackground: '#dfdad9',
      black: '#575279', red: '#b4637a', green: '#286983', yellow: '#ea9d34',
      blue: '#56949f', magenta: '#907aa9', cyan: '#d7827e', white: '#f2e9e1',
      brightBlack: '#9893a5', brightRed: '#b4637a', brightGreen: '#286983',
      brightYellow: '#ea9d34', brightBlue: '#56949f', brightMagenta: '#907aa9',
      brightCyan: '#d7827e', brightWhite: '#575279',
    },
  },
  'everforest-light': {
    label: 'Everforest Light',
    isDark: false,
    theme: {
      background: '#fdf6e3', foreground: '#5c6a72',
      cursor: '#5c6a72', selectionBackground: '#eaedc8',
      black: '#5c6a72', red: '#f85552', green: '#8da101', yellow: '#dfa000',
      blue: '#3a94c5', magenta: '#df69ba', cyan: '#35a77c', white: '#e0dcc7',
      brightBlack: '#939f91', brightRed: '#f85552', brightGreen: '#8da101',
      brightYellow: '#dfa000', brightBlue: '#3a94c5', brightMagenta: '#df69ba',
      brightCyan: '#35a77c', brightWhite: '#5c6a72',
    },
  },
  'tokyo-night-day': {
    label: 'Tokyo Night Day',
    isDark: false,
    theme: {
      background: '#e1e2e7', foreground: '#3760bf',
      cursor: '#3760bf', selectionBackground: '#b6bfe2',
      black: '#3760bf', red: '#f52a65', green: '#587539', yellow: '#8c6c3e',
      blue: '#2e7de9', magenta: '#9854f1', cyan: '#007197', white: '#b4b5b9',
      brightBlack: '#a1a6c5', brightRed: '#f52a65', brightGreen: '#587539',
      brightYellow: '#8c6c3e', brightBlue: '#2e7de9', brightMagenta: '#9854f1',
      brightCyan: '#007197', brightWhite: '#3760bf',
    },
  },
  'one-light': {
    label: 'One Light',
    isDark: false,
    theme: {
      background: '#fafafa', foreground: '#383a42',
      cursor: '#526eff', selectionBackground: '#e5e5e6',
      black: '#383a42', red: '#e45649', green: '#50a14f', yellow: '#c18401',
      blue: '#4078f2', magenta: '#a626a4', cyan: '#0184bc', white: '#a0a1a7',
      brightBlack: '#696c77', brightRed: '#e45649', brightGreen: '#50a14f',
      brightYellow: '#c18401', brightBlue: '#4078f2', brightMagenta: '#a626a4',
      brightCyan: '#0184bc', brightWhite: '#383a42',
    },
  },
  'gruvbox-light': {
    label: 'Gruvbox Light',
    isDark: false,
    theme: {
      background: '#fbf1c7', foreground: '#3c3836',
      cursor: '#3c3836', selectionBackground: '#ebdbb2',
      black: '#3c3836', red: '#cc241d', green: '#98971a', yellow: '#d79921',
      blue: '#458588', magenta: '#b16286', cyan: '#689d6a', white: '#ebdbb2',
      brightBlack: '#928374', brightRed: '#9d0006', brightGreen: '#79740e',
      brightYellow: '#b57614', brightBlue: '#076678', brightMagenta: '#8f3f71',
      brightCyan: '#427b58', brightWhite: '#fbf1c7',
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
