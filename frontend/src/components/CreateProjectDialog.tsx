import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface CreateProjectDialogProps {
  open: boolean;
  onSubmit: (data: { name: string; path: string; description: string }) => void;
  onCancel: () => void;
}

export default function CreateProjectDialog({ open, onSubmit, onCancel }: CreateProjectDialogProps) {
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [description, setDescription] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setPath('');
      setDescription('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !path.trim()) return;
    onSubmit({ name: name.trim(), path: path.trim(), description: description.trim() });
  };

  const canSubmit = name.trim() && path.trim();

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
          width: '420px',
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
            New Project
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
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
              Name
            </label>
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-project"
              style={{
                width: '100%', padding: '9px 12px', borderRadius: '7px',
                background: '#f9fafb', border: '1px solid #e5e7eb',
                color: '#111827', fontSize: '13px', outline: 'none',
                fontFamily: 'inherit', transition: 'border-color 0.15s',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#93c5fd'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#e5e7eb'; }}
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
              Working Directory
            </label>
            <input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/home/user/project"
              style={{
                width: '100%', padding: '9px 12px', borderRadius: '7px',
                background: '#f9fafb', border: '1px solid #e5e7eb',
                color: '#111827', fontSize: '12px', outline: 'none',
                fontFamily: 'monospace', transition: 'border-color 0.15s',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#93c5fd'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#e5e7eb'; }}
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
              Description <span style={{ color: '#d1d5db', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>optional</span>
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project about?"
              style={{
                width: '100%', padding: '9px 12px', borderRadius: '7px',
                background: '#f9fafb', border: '1px solid #e5e7eb',
                color: '#111827', fontSize: '13px', outline: 'none',
                fontFamily: 'inherit', transition: 'border-color 0.15s',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#93c5fd'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#e5e7eb'; }}
            />
          </div>

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
              disabled={!canSubmit}
              style={{
                padding: '8px 20px', borderRadius: '7px', border: 'none',
                background: canSubmit ? '#3b82f6' : '#e5e7eb',
                color: canSubmit ? '#ffffff' : '#9ca3af',
                fontSize: '13px', fontWeight: 600, cursor: canSubmit ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s',
              }}
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
