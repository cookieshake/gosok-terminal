import { useState } from 'react';

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

export default function MobileKeybar({ onSendData }: MobileKeybarProps) {
  const [ctrlOpen, setCtrlOpen] = useState(false);

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
      {/* Ctrl group */}
      <button
        tabIndex={-1}
        onClick={() => setCtrlOpen(o => !o)}
        style={{
          ...btnStyle,
          background: ctrlOpen ? '#2563eb' : '#ffffff',
          color: ctrlOpen ? '#ffffff' : '#374151',
          borderColor: ctrlOpen ? '#2563eb' : '#d1d5db',
          fontWeight: 700,
        }}
      >
        Ctrl
      </button>
      {ctrlOpen && CTRL_KEYS.map((key, i) => (
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

      {!ctrlOpen && KEYS.map((key, i) => (
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
