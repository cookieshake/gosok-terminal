import { useState, useEffect, useRef } from 'react';

interface MobileKeybarProps {
  onSendData: (data: string) => void;
}

interface KeyDef {
  label: string;
  data: string;
  wide?: boolean;
  separator?: boolean;
}

const CTRL_KEYS: KeyDef[] = [
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

// Alt in terminal = ESC prefix (\x1b + key)
const ALT_KEYS: KeyDef[] = [
  { label: 'B', data: '\x1bb' },   // word back
  { label: 'F', data: '\x1bf' },   // word forward
  { label: 'D', data: '\x1bd' },   // delete word forward
  { label: '⌫', data: '\x1b\x7f' }, // delete word backward
  { label: '.', data: '\x1b.' },   // last argument
  { label: 'U', data: '\x1bu' },   // upcase word
  { label: 'L', data: '\x1bl' },   // downcase word
  { label: 'T', data: '\x1bt' },   // transpose words
];

const KEYS: KeyDef[] = [
  // Navigation
  { label: 'Esc', data: '\x1b' },
  { label: 'Tab', data: '\t', wide: true },
  { label: 'S-Tab', data: '\x1b[Z', wide: true },
  { label: '↑', data: '\x1b[A' },
  { label: '↓', data: '\x1b[B' },
  { label: '←', data: '\x1b[D' },
  { label: '→', data: '\x1b[C' },
  // Symbols
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

type ModifierMode = 'none' | 'ctrl' | 'alt';

export default function MobileKeybar({ onSendData }: MobileKeybarProps) {
  const [modifier, setModifier] = useState<ModifierMode>('none');
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);

  // Track virtual keyboard: position bar just above it
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const offset = window.innerHeight - vv.height - vv.offsetTop;
      setKeyboardOffset(Math.max(0, offset));
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  const toggleModifier = (m: ModifierMode) =>
    setModifier(prev => prev === m ? 'none' : m);

  const modifierBtnStyle = (active: boolean, color: string): React.CSSProperties => ({
    ...btnStyle,
    background: active ? color : '#ffffff',
    color: active ? '#ffffff' : '#374151',
    borderColor: active ? color : '#d1d5db',
    fontWeight: 700,
  });

  return (
    <div
      ref={barRef}
      style={{
        position: 'fixed',
        left: 0, right: 0,
        bottom: keyboardOffset,
        zIndex: 50,
        display: 'flex', alignItems: 'center', gap: '4px',
        overflowX: 'auto', scrollbarWidth: 'none',
        background: '#f1f2f5', borderTop: '1px solid #e3e5e8',
        padding: '5px 8px',
        paddingBottom: keyboardOffset > 0 ? '5px' : 'max(5px, env(safe-area-inset-bottom))',
        flexShrink: 0,
      }}
    >
      {/* Ctrl toggle */}
      <button
        tabIndex={-1}
        onClick={() => toggleModifier('ctrl')}
        style={modifierBtnStyle(modifier === 'ctrl', '#2563eb')}
      >
        Ctrl
      </button>

      {/* Alt toggle */}
      <button
        tabIndex={-1}
        onClick={() => toggleModifier('alt')}
        style={modifierBtnStyle(modifier === 'alt', '#7c3aed')}
      >
        Alt
      </button>

      {modifier === 'ctrl' && CTRL_KEYS.map((key, i) => (
        <button
          key={`ctrl-${i}`}
          tabIndex={-1}
          onClick={() => onSendData(key.data)}
          style={{
            ...btnStyle,
            background: '#eff6ff',
            borderColor: '#93c5fd',
            color: '#1d4ed8',
          }}
        >
          {key.label}
        </button>
      ))}

      {modifier === 'alt' && ALT_KEYS.map((key, i) => (
        <button
          key={`alt-${i}`}
          tabIndex={-1}
          onClick={() => onSendData(key.data)}
          style={{
            ...btnStyle,
            background: '#f5f3ff',
            borderColor: '#c4b5fd',
            color: '#6d28d9',
          }}
        >
          {key.label}
        </button>
      ))}

      {modifier === 'none' && KEYS.map((key, i) => (
        <button
          key={i}
          tabIndex={-1}
          onClick={() => onSendData(key.data)}
          style={{
            ...btnStyle,
            minWidth: key.wide ? '52px' : '38px',
            marginLeft: key.separator ? '8px' : undefined,
          }}
        >
          {key.label}
        </button>
      ))}
    </div>
  );
}
