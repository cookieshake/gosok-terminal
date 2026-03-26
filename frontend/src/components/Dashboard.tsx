import { useIsMobile } from '../hooks/useIsMobile';
import type { Project } from '../api/types';

interface DashboardProps {
  projects: Project[];
  onSelectProject: (id: string) => void;
}

export default function Dashboard({ projects, onSelectProject }: DashboardProps) {
  const isMobile = useIsMobile();
  return (
    <div className="flex flex-col h-full" style={{ background: '#f1f2f5' }}>
      {/* Top bar */}
      <div
        className="shrink-0 flex items-center"
        style={{ height: '52px', borderBottom: '1px solid #e3e5e8', background: '#ffffff', paddingLeft: isMobile ? '48px' : '32px' }}
      >
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827', letterSpacing: '-0.01em' }}>
          Dashboard
        </span>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ padding: '32px' }}>
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full pb-24" style={{ textAlign: 'center' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginBottom: '20px' }}>
              {[0.4, 0.2, 0.2, 0.1].map((op, i) => (
                <div key={i} style={{ width: '20px', height: '20px', borderRadius: '5px', border: `1px solid rgba(59,130,246,${op})` }} />
              ))}
            </div>
            <p style={{ fontSize: '13px', color: '#9ca3af', fontWeight: 500 }}>No projects</p>
            <p style={{ fontSize: '11px', color: '#d1d5db', marginTop: '4px' }}>Create one from the sidebar to get started</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px', maxWidth: '960px' }}>
            {projects.map((p, i) => (
              <button
                key={p.id}
                onClick={() => onSelectProject(p.id)}
                className="text-left transition-all group"
                style={{
                  display: 'block', padding: '20px', borderRadius: '10px',
                  background: '#ffffff', border: '1px solid #e3e5e8', cursor: 'pointer',
                  animationDelay: `${i * 40}ms`,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#bfdbfe';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(59,130,246,0.08)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#e3e5e8';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Icon row */}
                <div className="flex items-start justify-between mb-3">
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '8px', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    background: '#eff6ff', border: '1px solid #dbeafe',
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M3 7C3 5.89 3.89 5 5 5H10.17C10.7 5 11.21 5.21 11.59 5.59L12.41 6.41C12.79 6.79 13.3 7 13.83 7H19C20.11 7 21 7.89 21 9V17C21 18.11 20.11 19 19 19H5C3.89 19 3 18.11 3 17V7Z" stroke="#3b82f6" strokeWidth="1.5" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#e5e7eb', marginTop: '6px' }} />
                </div>

                {/* Name */}
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827', letterSpacing: '-0.02em', marginBottom: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name}
                </div>

                {/* Path */}
                <div style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: p.description ? '10px' : 0 }}>
                  {p.path}
                </div>

                {/* Description */}
                {p.description && (
                  <div style={{ fontSize: '12px', color: '#6b7280', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {p.description}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
