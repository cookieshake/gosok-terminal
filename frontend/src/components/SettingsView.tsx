import { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import type { AiTool } from '../api/types';

export default function SettingsView() {
  const { getSetting, setSetting } = useSettings();
  const [tools, setTools] = useState<AiTool[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTools(getSetting<AiTool[]>('ai_tools', []));
    setDirty(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (updated: AiTool[]) => {
    setTools(updated);
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setSetting('ai_tools', tools);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (i: number, field: keyof AiTool, value: string | boolean) => {
    const next = tools.map((t, idx) => idx === i ? { ...t, [field]: value } : t);
    update(next);
  };

  const handleAdd = () => {
    update([...tools, { type: `tool-${Date.now()}`, label: 'New Tool', command: '', color: '#6b7280', enabled: true }]);
  };

  const handleDelete = (i: number) => {
    update(tools.filter((_, idx) => idx !== i));
  };

  const handleMove = (i: number, dir: -1 | 1) => {
    const next = [...tools];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  };

  const inputStyle: React.CSSProperties = {
    height: '28px', padding: '0 8px', borderRadius: '5px',
    border: '1px solid #e3e5e8', fontSize: '12px', color: '#111827',
    background: '#ffffff', outline: 'none',
  };

  return (
    <div className="flex h-full" style={{ background: '#f1f2f5' }}>
      {/* Category sidebar */}
      <div style={{ width: '180px', background: '#f8f9fb', borderRight: '1px solid #e3e5e8', padding: '16px 0' }}>
        <div style={{ padding: '0 12px 8px', fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.12em', color: '#9ca3af', textTransform: 'uppercase' }}>
          Settings
        </div>
        <div style={{
          margin: '0 8px', padding: '6px 10px', borderRadius: '6px',
          background: '#ffffff', border: '1px solid #e3e5e8',
          fontSize: '12.5px', fontWeight: 600, color: '#111827', cursor: 'default',
        }}>
          AI Tools
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '28px 32px', maxWidth: '680px' }}>
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>AI Tools</h2>
          <p style={{ fontSize: '12px', color: '#6b7280' }}>
            탭바에 표시되는 AI 툴 단축 버튼을 관리합니다. 클릭 시 해당 command로 새 탭이 열립니다.
          </p>
        </div>

        {/* Tool list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '28px 80px 1fr 140px 60px 70px', gap: '8px', padding: '0 4px', alignItems: 'center' }}>
            {['', 'Color', 'Label', 'Command', 'Enabled', ''].map((h, i) => (
              <span key={i} style={{ fontSize: '10px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
            ))}
          </div>

          {tools.map((tool, i) => (
            <div key={tool.type} style={{
              display: 'grid', gridTemplateColumns: '28px 80px 1fr 140px 60px 70px',
              gap: '8px', alignItems: 'center',
              background: '#ffffff', padding: '8px', borderRadius: '7px',
              border: '1px solid #e3e5e8',
            }}>
              {/* Up/Down */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                <button onClick={() => handleMove(i, -1)} disabled={i === 0}
                  style={{ border: 'none', background: 'transparent', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? '#d1d5db' : '#6b7280', padding: 0, lineHeight: 1 }}>
                  <ChevronUp style={{ width: '13px', height: '13px' }} />
                </button>
                <button onClick={() => handleMove(i, 1)} disabled={i === tools.length - 1}
                  style={{ border: 'none', background: 'transparent', cursor: i === tools.length - 1 ? 'default' : 'pointer', color: i === tools.length - 1 ? '#d1d5db' : '#6b7280', padding: 0, lineHeight: 1 }}>
                  <ChevronDown style={{ width: '13px', height: '13px' }} />
                </button>
              </div>

              {/* Color */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input type="color" value={tool.color}
                  onChange={e => handleChange(i, 'color', e.target.value)}
                  style={{ width: '24px', height: '24px', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: 0 }} />
                <input value={tool.color} onChange={e => handleChange(i, 'color', e.target.value)}
                  style={{ ...inputStyle, width: '52px', fontFamily: 'monospace', fontSize: '11px' }} />
              </div>

              {/* Label */}
              <input value={tool.label} onChange={e => handleChange(i, 'label', e.target.value)}
                style={inputStyle} placeholder="Label" />

              {/* Command */}
              <input value={tool.command} onChange={e => handleChange(i, 'command', e.target.value)}
                style={{ ...inputStyle, fontFamily: 'monospace' }} placeholder="command" />

              {/* Enabled toggle */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  onClick={() => handleChange(i, 'enabled', !tool.enabled)}
                  style={{
                    width: '36px', height: '20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                    background: tool.enabled ? '#3b82f6' : '#d1d5db',
                    position: 'relative', transition: 'background 0.15s',
                  }}
                >
                  <div style={{
                    position: 'absolute', top: '2px',
                    left: tool.enabled ? '18px' : '2px',
                    width: '16px', height: '16px', borderRadius: '50%',
                    background: '#ffffff', transition: 'left 0.15s',
                  }} />
                </button>
              </div>

              {/* Delete */}
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

        {/* Add + Save */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={handleAdd}
            style={{
              height: '30px', padding: '0 12px', borderRadius: '6px',
              border: '1px dashed #d1d5db', background: 'transparent',
              color: '#6b7280', fontSize: '12px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '5px',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#3b82f6'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#6b7280'; }}
          >
            <Plus style={{ width: '12px', height: '12px' }} />
            Add Tool
          </button>

          <button onClick={handleSave} disabled={!dirty || saving}
            style={{
              height: '30px', padding: '0 16px', borderRadius: '6px',
              border: 'none', cursor: dirty && !saving ? 'pointer' : 'default',
              background: dirty ? '#3b82f6' : '#e5e7eb',
              color: dirty ? '#ffffff' : '#9ca3af',
              fontSize: '12px', fontWeight: 600, transition: 'all 0.15s',
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>

          {!dirty && (
            <span style={{ fontSize: '11px', color: '#9ca3af' }}>Saved</span>
          )}
        </div>
      </div>
    </div>
  );
}
