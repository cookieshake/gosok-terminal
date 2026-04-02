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
  border: '1px solid #d1d5db',
  background: '#ffffff',
  color: '#374151',
  fontSize: '0.6875rem',
  fontWeight: 500,
  fontFamily: 'monospace',
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
  WebkitUserSelect: 'none',
  userSelect: 'none',
};

// Prevent button taps from dismissing the mobile keyboard
const preventBlur = (e: React.PointerEvent) => e.preventDefault();

export default function MobileKeybar({ onSendData, modifier = null, onModifierChange }: MobileKeybarProps) {
  const toggle = (m: 'ctrl' | 'alt' | 'shift') =>
    onModifierChange?.(modifier === m ? null : m);

  const modBtnStyle = (active: boolean, color: string): React.CSSProperties => ({
    ...btnStyle,
    background: active ? color : '#ffffff',
    color: active ? '#ffffff' : '#374151',
    borderColor: active ? color : '#d1d5db',
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
        background: '#f1f2f5', borderTop: '1px solid #e3e5e8',
        padding: '5px 8px',
        paddingBottom: 'max(5px, env(safe-area-inset-bottom))',
        flexShrink: 0,
      }}
    >
      <button tabIndex={-1} onPointerDown={preventBlur} onClick={() => toggle('ctrl')} style={modBtnStyle(modifier === 'ctrl', '#2563eb')}>
        Ctrl
      </button>
      <button tabIndex={-1} onPointerDown={preventBlur} onClick={() => toggle('alt')} style={modBtnStyle(modifier === 'alt', '#7c3aed')}>
        Alt
      </button>
      <button tabIndex={-1} onPointerDown={preventBlur} onClick={() => toggle('shift')} style={modBtnStyle(modifier === 'shift', '#d97706')}>
        Shift
      </button>

      {modifier === 'ctrl' && CTRL_PRESETS.map((key, i) => (
        <button key={`ctrl-${i}`} tabIndex={-1} onPointerDown={preventBlur} onClick={() => { onSendData(key.data); onModifierChange?.(null); }}
          style={presetStyle('#eff6ff', '#93c5fd', '#1d4ed8')}>
          {key.label}
        </button>
      ))}

      {modifier === 'alt' && ALT_PRESETS.map((key, i) => (
        <button key={`alt-${i}`} tabIndex={-1} onPointerDown={preventBlur} onClick={() => { onSendData(key.data); onModifierChange?.(null); }}
          style={presetStyle('#f5f3ff', '#c4b5fd', '#6d28d9')}>
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
            ...(modifier === 'shift' && key.shiftData ? { borderColor: '#d97706', background: '#fffbeb', color: '#92400e' } : {}),
          }}
        >
          {modifier === 'shift' && key.shiftData ? `S-${key.label}` : key.label}
        </button>
      ))}
    </div>
  );
}
