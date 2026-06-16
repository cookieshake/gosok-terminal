import { useEffect, useRef } from 'react';

type Modifier = 'ctrl' | 'alt' | 'shift' | null;

interface MobileKeybarProps {
  onSendData: (data: string) => void;
  modifier?: Modifier;
  onModifierChange?: (m: Modifier) => void;
}

interface KeyDef {
  label: string;
  data: string;
  wide?: boolean;
  separator?: boolean;
  // Shifted variant of the escape sequence (for arrow keys etc.)
  shiftData?: string;
}

const CTRL_PRESETS: KeyDef[] = [
  { label: 'C', data: '\x03' },
  { label: 'D', data: '\x04' },
  { label: 'Z', data: '\x1a' },
  { label: 'L', data: '\x0c' },
  { label: 'R', data: '\x12' },
  { label: 'A', data: '\x01' },
  { label: 'E', data: '\x05' },
  { label: 'U', data: '\x15' },
  { label: 'V', data: '\x16' },
  { label: 'W', data: '\x17' },
];

const ALT_PRESETS: KeyDef[] = [
  { label: 'B', data: '\x1bb' },
  { label: 'F', data: '\x1bf' },
  { label: 'D', data: '\x1bd' },
  { label: '⌫', data: '\x1b\x7f' },
  { label: '.', data: '\x1b.' },
  { label: 'U', data: '\x1bu' },
  { label: 'L', data: '\x1bl' },
  { label: 'T', data: '\x1bt' },
];

const KEYS: KeyDef[] = [
  { label: 'Esc', data: '\x1b' },
  { label: 'Tab', data: '\t', wide: true, shiftData: '\x1b[Z' },
  { label: '↑', data: '\x1b[A', shiftData: '\x1b[1;2A' },
  { label: '↓', data: '\x1b[B', shiftData: '\x1b[1;2B' },
  { label: '←', data: '\x1b[D', shiftData: '\x1b[1;2D' },
  { label: '→', data: '\x1b[C', shiftData: '\x1b[1;2C' },
  { label: '|', data: '|', separator: true },
  { label: '~', data: '~' },
  { label: '`', data: '`' },
  { label: '\\', data: '\\' },
  { label: '!', data: '!' },
  { label: '$', data: '$' },
  { label: '&', data: '&' },
];

const btnStyle: React.CSSProperties = {
  flexShrink: 0,
  minWidth: '38px',
  height: '34px',
  paddingInline: '6px',
  borderRadius: '6px',
  border: '1px solid var(--ctp-surface2)',
  background: 'var(--surface-raised)',
  color: 'var(--ctp-subtext1)',
  fontSize: '0.6875rem',
  fontWeight: 500,
  fontFamily: 'monospace',
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
  WebkitUserSelect: 'none',
  userSelect: 'none',
};

export default function MobileKeybar({ onSendData, modifier = null, onModifierChange }: MobileKeybarProps) {
  // Track whether the soft keyboard is currently visible. With
  // interactive-widget=resizes-content (see index.html) Android Chrome shrinks
  // both the layout and visual viewport when the keyboard opens, so an absolute
  // height diff is useless — we watch the visualViewport resize *transitions*
  // instead (shrink = opened, grow = closed).
  const keyboardOpenRef = useRef(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let lastHeight = vv.height;
    const onResize = () => {
      const h = vv.height;
      if (h < lastHeight - 100) keyboardOpenRef.current = true;
      else if (h > lastHeight + 100) keyboardOpenRef.current = false;
      lastHeight = h;
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  // Keep focus on the terminal textarea only while the keyboard is already up,
  // so tapping a key (e.g. an arrow) doesn't close it mid-typing. When the
  // keyboard is dismissed the textarea stays focused-but-hidden; preventing the
  // blur there would let the tap gesture re-summon the keyboard, so we let the
  // tap blur it instead — the key data is sent over the WS regardless of focus.
  const preventBlur = (e: React.PointerEvent) => {
    if (keyboardOpenRef.current) e.preventDefault();
  };

  const toggle = (m: 'ctrl' | 'alt' | 'shift') =>
    onModifierChange?.(modifier === m ? null : m);

  const modBtnStyle = (active: boolean, color: string): React.CSSProperties => ({
    ...btnStyle,
    background: active ? color : 'var(--surface-raised)',
    color: active ? 'var(--on-accent)' : 'var(--ctp-subtext1)',
    borderColor: active ? color : 'var(--ctp-surface2)',
    fontWeight: 700,
  });

  const handleKey = (key: KeyDef) => {
    if (modifier === 'shift' && key.shiftData) {
      onSendData(key.shiftData);
    } else {
      onSendData(key.data);
    }
  };

  const presetStyle = (bg: string, border: string, fg: string): React.CSSProperties => ({
    ...btnStyle, background: bg, borderColor: border, color: fg,
  });

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: '4px',
        overflowX: 'auto', scrollbarWidth: 'none',
        background: 'var(--ctp-base)', borderTop: '1px solid var(--ctp-surface0)',
        padding: '5px 8px',
        paddingBottom: 'max(5px, env(safe-area-inset-bottom))',
        flexShrink: 0,
      }}
    >
      <button tabIndex={-1} onPointerDown={preventBlur} onClick={() => toggle('ctrl')} style={modBtnStyle(modifier === 'ctrl', 'var(--ctp-blue)')}>
        Ctrl
      </button>
      <button tabIndex={-1} onPointerDown={preventBlur} onClick={() => toggle('alt')} style={modBtnStyle(modifier === 'alt', 'var(--ctp-mauve)')}>
        Alt
      </button>
      <button tabIndex={-1} onPointerDown={preventBlur} onClick={() => toggle('shift')} style={modBtnStyle(modifier === 'shift', 'var(--ctp-peach)')}>
        Shift
      </button>

      {modifier === 'ctrl' && CTRL_PRESETS.map((key, i) => (
        <button key={`ctrl-${i}`} tabIndex={-1} onPointerDown={preventBlur} onClick={() => { onSendData(key.data); onModifierChange?.(null); }}
          style={presetStyle('var(--tint-blue)', 'var(--ctp-sky)', 'var(--ctp-blue)')}>
          {key.label}
        </button>
      ))}

      {modifier === 'alt' && ALT_PRESETS.map((key, i) => (
        <button key={`alt-${i}`} tabIndex={-1} onPointerDown={preventBlur} onClick={() => { onSendData(key.data); onModifierChange?.(null); }}
          style={presetStyle('var(--tint-mauve)', 'var(--ctp-lavender)', 'var(--ctp-mauve)')}>
          {key.label}
        </button>
      ))}

      {(modifier === null || modifier === 'shift') && KEYS.map((key, i) => (
        <button
          key={i}
          tabIndex={-1}
          onPointerDown={preventBlur}
          onClick={() => handleKey(key)}
          style={{
            ...btnStyle,
            minWidth: key.wide ? '52px' : '38px',
            marginLeft: key.separator ? '8px' : undefined,
            ...(modifier === 'shift' && key.shiftData ? { borderColor: 'var(--ctp-peach)', background: 'var(--tint-yellow)', color: 'var(--ctp-yellow)' } : {}),
          }}
        >
          {modifier === 'shift' && key.shiftData ? `S-${key.label}` : key.label}
        </button>
      ))}
    </div>
  );
}
