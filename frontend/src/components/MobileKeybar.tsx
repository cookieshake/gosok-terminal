interface MobileKeybarProps {
  onSendData: (data: string) => void;
}

interface KeyDef {
  label: string;
  data: string;
  wide?: boolean;
  separator?: boolean;
}

const KEYS: KeyDef[] = [
  // Common Ctrl shortcuts
  { label: 'C-c', data: '\x03' },
  { label: 'C-d', data: '\x04' },
  { label: 'C-z', data: '\x1a' },
  { label: 'C-l', data: '\x0c' },
  { label: 'C-r', data: '\x12' },
  { label: 'C-a', data: '\x01' },
  { label: 'C-e', data: '\x05' },
  { label: 'C-u', data: '\x15' },
  { label: 'C-w', data: '\x17' },
  // Navigation
  { label: 'Esc', data: '\x1b', separator: true },
  { label: 'Tab', data: '\t', wide: true },
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

export default function MobileKeybar({ onSendData }: MobileKeybarProps) {
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
      {KEYS.map((key, i) => (
        <button
          key={i}
          onPointerDown={(e) => {
            e.preventDefault(); // prevent keyboard from appearing
            onSendData(key.data);
          }}
          style={{
            flexShrink: 0,
            minWidth: key.wide ? '52px' : '38px',
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
            marginLeft: key.separator ? '8px' : undefined,
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
            WebkitUserSelect: 'none',
            userSelect: 'none',
          }}
        >
          {key.label}
        </button>
      ))}
    </div>
  );
}
