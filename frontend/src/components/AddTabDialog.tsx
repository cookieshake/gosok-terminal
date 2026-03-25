import { useState, useEffect } from 'react';
import { TAB_TYPES, type TabType } from '../api/types';
import { X } from 'lucide-react';

interface AddTabDialogProps {
  open: boolean;
  onSubmit: (data: { tab_type: string }) => void;
  onCancel: () => void;
}

const TAB_COLORS: Record<TabType, string> = {
  'shell':       '#0d9488',
  'claude-code': '#2563eb',
  'codex':       '#16a34a',
  'gemini-cli':  '#d97706',
  'opencode':    '#7c3aed',
};

export default function AddTabDialog({ open, onSubmit, onCancel }: AddTabDialogProps) {
  const [tabType, setTabType] = useState<TabType>('shell');

  useEffect(() => {
    if (open) setTabType('shell');
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ tab_type: tabType });
  };

  const accentColor = TAB_COLORS[tabType];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          width: '400px',
          background: '#ffffff',
          border: '1px solid #e3e5e8',
          borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid #f3f4f6',
        }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827', letterSpacing: '-0.01em' }}>
            New Tab
          </span>
          <button
            onClick={onCancel}
            style={{
              width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '5px', border: 'none', cursor: 'pointer',
              background: 'transparent', color: '#d1d5db',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#6b7280'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#d1d5db'; }}
          >
            <X style={{ width: '13px', height: '13px' }} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Type selector */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
              Type
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {(Object.entries(TAB_TYPES) as [TabType, { label: string; command: string }][]).map(([key, def]) => {
                const color = TAB_COLORS[key];
                const isSelected = tabType === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTabType(key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 12px', borderRadius: '7px', cursor: 'pointer',
                      background: isSelected ? color + '0f' : 'transparent',
                      border: `1px solid ${isSelected ? color + '40' : 'transparent'}`,
                      textAlign: 'left', transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f9fafb'; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                      background: isSelected ? color : '#e5e7eb',
                      boxShadow: isSelected ? `0 0 8px ${color}60` : 'none',
                    }} />
                    <span style={{ fontSize: '13px', fontWeight: isSelected ? 600 : 400, color: isSelected ? color : '#6b7280', flex: 1 }}>
                      {def.label}
                    </span>
                    <span style={{ fontSize: '10.5px', color: '#d1d5db', fontFamily: 'monospace' }}>
                      {def.command}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '8px 16px', borderRadius: '7px', border: '1px solid #e5e7eb',
                background: 'transparent', color: '#6b7280', fontSize: '13px',
                fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.color = '#374151'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6b7280'; }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: '8px 20px', borderRadius: '7px', border: 'none',
                background: accentColor,
                color: '#ffffff',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              Open
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
