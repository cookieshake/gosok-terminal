import { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import type { Shortcut } from '../api/types';

type Section = 'terminal' | 'editor' | 'appearance' | 'shortcuts';

const FONT_OPTIONS = [
  { label: 'MonoplexNerd', value: 'MonoplexNerd, Menlo, Monaco, "Courier New", monospace' },
];

export default function SettingsView() {
  const { settings, getSetting, setSetting } = useSettings();
  const [section, setSection] = useState<Section>('terminal');

  // Terminal settings
  const terminalFontSize = getSetting<number>('terminal_font_size', 14);
  const terminalFontFamily = getSetting<string>('terminal_font_family', 'MonoplexNerd, Menlo, Monaco, "Courier New", monospace');
  // Editor settings
  const editorFontSize = getSetting<number>('editor_font_size', 14);
  const editorFontFamily = getSetting<string>('editor_font_family', 'MonoplexNerd, Menlo, Monaco, "Courier New", monospace');
  // Appearance settings
  const textScale = getSetting<number>('text_scale', 1);

  // Shortcuts settings
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!dirty) {
      setShortcuts(getSetting<Shortcut[]>('shortcuts', []));
    }
  }, [settings, dirty]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (updated: Shortcut[]) => { setShortcuts(updated); setDirty(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setSetting('shortcuts', shortcuts);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (i: number, field: keyof Omit<Shortcut, 'type'>, value: string | boolean) => {
    update(shortcuts.map((t, idx) => idx === i ? { ...t, [field]: value } : t));
  };

  const handleAdd = () => {
    update([...shortcuts, { type: crypto.randomUUID(), label: 'New Shortcut', command: '', enabled: true }]);
  };

  const handleDelete = (i: number) => update(shortcuts.filter((_, idx) => idx !== i));

  const handleMove = (i: number, dir: -1 | 1) => {
    const next = [...shortcuts];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  };

  const inputStyle: React.CSSProperties = {
    height: '28px', padding: '0 8px', borderRadius: '5px',
    border: '1px solid #e3e5e8', fontSize: '0.75rem', color: '#111827',
    background: '#ffffff', outline: 'none',
  };

  const clientItems: { key: Section; label: string }[] = [
    { key: 'terminal', label: 'Terminal' },
    { key: 'editor', label: 'Editor' },
    { key: 'appearance', label: 'Appearance' },
  ];

  const serverItems: { key: Section; label: string }[] = [
    { key: 'shortcuts', label: 'Shortcuts' },
  ];

  const renderItem = (item: { key: Section; label: string }) => (
    <div
      key={item.key}
      onClick={() => setSection(item.key)}
      style={{
        margin: '0 8px 2px', padding: '6px 10px', borderRadius: '6px',
        background: section === item.key ? '#ffffff' : 'transparent',
        border: section === item.key ? '1px solid #e3e5e8' : '1px solid transparent',
        fontSize: '0.781rem', fontWeight: section === item.key ? 600 : 400,
        color: section === item.key ? '#111827' : '#6b7280',
        cursor: 'pointer',
      }}
    >
      {item.label}
    </div>
  );

  return (
    <div className="flex h-full" style={{ background: '#f1f2f5' }}>
      {/* Category sidebar */}
      <div style={{ width: '180px', background: '#f8f9fb', borderRight: '1px solid #e3e5e8', padding: '16px 0' }}>
        <div style={{ padding: '0 12px 8px', fontSize: '0.594rem', fontWeight: 700, letterSpacing: '0.12em', color: '#9ca3af', textTransform: 'uppercase' }}>
          Client
        </div>
        {clientItems.map(renderItem)}
        <div style={{ padding: '12px 12px 8px', fontSize: '0.594rem', fontWeight: 700, letterSpacing: '0.12em', color: '#9ca3af', textTransform: 'uppercase' }}>
          Server
        </div>
        {serverItems.map(renderItem)}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '28px 32px', maxWidth: '680px' }}>

        {section === 'terminal' && (
          <>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>Terminal</h2>
              <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>Font settings for the terminal. Synced with the A-/A+ buttons when in Terminals mode.</p>
            </div>

            {/* Font Size */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Font Size</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setSetting('terminal_font_size', Math.max(10, Math.round((terminalFontSize - 0.5) * 10) / 10))}
                  style={{ ...inputStyle, width: '28px', height: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 600 }}
                >−</button>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827', minWidth: '32px', textAlign: 'center' }}>{terminalFontSize}</span>
                <button
                  onClick={() => setSetting('terminal_font_size', Math.min(24, Math.round((terminalFontSize + 0.5) * 10) / 10))}
                  style={{ ...inputStyle, width: '28px', height: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 600 }}
                >+</button>
                <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>px (10–24)</span>
              </div>
            </div>

            {/* Font Family */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Font Family</div>
              <select
                value={terminalFontFamily}
                onChange={e => setSetting('terminal_font_family', e.target.value)}
                style={{ ...inputStyle, width: '240px', fontFamily: terminalFontFamily, cursor: 'pointer' }}
              >
                {FONT_OPTIONS.map(o => (
                  <option key={o.label} value={o.value} style={{ fontFamily: o.value }}>{o.label}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {section === 'editor' && (
          <>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>Editor</h2>
              <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>Font settings for the Monaco editor. Synced with the A-/A+ buttons when in Editor mode.</p>
            </div>

            {/* Font Size */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Font Size</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setSetting('editor_font_size', Math.max(10, Math.round((editorFontSize - 0.5) * 10) / 10))}
                  style={{ ...inputStyle, width: '28px', height: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 600 }}
                >−</button>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827', minWidth: '32px', textAlign: 'center' }}>{editorFontSize}</span>
                <button
                  onClick={() => setSetting('editor_font_size', Math.min(24, Math.round((editorFontSize + 0.5) * 10) / 10))}
                  style={{ ...inputStyle, width: '28px', height: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 600 }}
                >+</button>
                <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>px (10–24)</span>
              </div>
            </div>

            {/* Font Family */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Font Family</div>
              <select
                value={editorFontFamily}
                onChange={e => setSetting('editor_font_family', e.target.value)}
                style={{ ...inputStyle, width: '240px', fontFamily: editorFontFamily, cursor: 'pointer' }}
              >
                {FONT_OPTIONS.map(o => (
                  <option key={o.label} value={o.value} style={{ fontFamily: o.value }}>{o.label}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {section === 'appearance' && (
          <>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>Appearance</h2>
              <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>Scales text throughout the UI. Layout dimensions are not affected.</p>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Text Scale</div>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827' }}>{Math.round(textScale * 100)}%</span>
              </div>
              <input
                type="range"
                min={60}
                max={250}
                step={5}
                value={Math.round(textScale * 100)}
                onChange={e => setSetting('text_scale', Number(e.target.value) / 100)}
                style={{ width: '100%', cursor: 'pointer', accentColor: '#3b82f6' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>60%</span>
                <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>250%</span>
              </div>
            </div>
          </>
        )}

        {section === 'shortcuts' && (
          <>
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>Shortcuts</h2>
              <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                Manage shortcut buttons shown in the tab bar. Clicking one opens a new tab and runs the command.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr 60px 60px 70px', gap: '8px', padding: '0 8px', alignItems: 'center' }}>
                {['', 'Label', 'Command', 'Enter', 'Enabled', ''].map((h, i) => (
                  <span key={h || `col-${i}`} style={{ fontSize: '0.625rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
                ))}
              </div>

              {shortcuts.map((sc, i) => (
                <div key={sc.type} style={{
                  display: 'grid', gridTemplateColumns: '28px 1fr 1fr 60px 60px 70px',
                  gap: '8px', alignItems: 'center',
                  background: '#ffffff', padding: '8px', borderRadius: '7px',
                  border: '1px solid #e3e5e8',
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    <button onClick={() => handleMove(i, -1)} disabled={i === 0}
                      style={{ border: 'none', background: 'transparent', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? '#d1d5db' : '#6b7280', padding: 0, lineHeight: 1 }}>
                      <ChevronUp style={{ width: '13px', height: '13px' }} />
                    </button>
                    <button onClick={() => handleMove(i, 1)} disabled={i === shortcuts.length - 1}
                      style={{ border: 'none', background: 'transparent', cursor: i === shortcuts.length - 1 ? 'default' : 'pointer', color: i === shortcuts.length - 1 ? '#d1d5db' : '#6b7280', padding: 0, lineHeight: 1 }}>
                      <ChevronDown style={{ width: '13px', height: '13px' }} />
                    </button>
                  </div>

                  <input value={sc.label} onChange={e => handleChange(i, 'label', e.target.value)}
                    style={inputStyle} placeholder="Label" />

                  <input value={sc.command} onChange={e => handleChange(i, 'command', e.target.value)}
                    style={{ ...inputStyle, fontFamily: 'monospace' }} placeholder="command" />

                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <button
                      onClick={() => handleChange(i, 'appendEnter', !sc.appendEnter)}
                      style={{
                        width: '36px', height: '20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                        background: sc.appendEnter ? '#3b82f6' : '#d1d5db',
                        position: 'relative', transition: 'background 0.15s',
                      }}
                    >
                      <div style={{
                        position: 'absolute', top: '2px',
                        left: sc.appendEnter ? '18px' : '2px',
                        width: '16px', height: '16px', borderRadius: '50%',
                        background: '#ffffff', transition: 'left 0.15s',
                      }} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <button
                      onClick={() => handleChange(i, 'enabled', !sc.enabled)}
                      style={{
                        width: '36px', height: '20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                        background: sc.enabled ? '#3b82f6' : '#d1d5db',
                        position: 'relative', transition: 'background 0.15s',
                      }}
                    >
                      <div style={{
                        position: 'absolute', top: '2px',
                        left: sc.enabled ? '18px' : '2px',
                        width: '16px', height: '16px', borderRadius: '50%',
                        background: '#ffffff', transition: 'left 0.15s',
                      }} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <button onClick={() => handleDelete(i)}
                      style={{
                        width: '26px', height: '26px', borderRadius: '5px', border: 'none',
                        background: 'transparent', cursor: 'pointer', color: '#9ca3af',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#ef4444'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9ca3af'; }}
                    >
                      <Trash2 style={{ width: '12px', height: '12px' }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button onClick={handleAdd}
                style={{
                  height: '30px', padding: '0 12px', borderRadius: '6px',
                  border: '1px dashed #d1d5db', background: 'transparent',
                  color: '#6b7280', fontSize: '0.75rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '5px',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#3b82f6'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#6b7280'; }}
              >
                <Plus style={{ width: '12px', height: '12px' }} />
                Add Shortcut
              </button>

              <button onClick={handleSave} disabled={!dirty || saving}
                style={{
                  height: '30px', padding: '0 16px', borderRadius: '6px',
                  border: 'none', cursor: dirty && !saving ? 'pointer' : 'default',
                  background: dirty ? '#3b82f6' : '#e5e7eb',
                  color: dirty ? '#ffffff' : '#9ca3af',
                  fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.15s',
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>

              {!dirty && (
                <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>Saved</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
