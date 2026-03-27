import { useIsMobile } from '../hooks/useIsMobile';
import type { Project } from '../api/types';

interface DashboardProps {
  projects: Project[];
  onSelectProject: (id: string) => void;
}

const CARD_ACCENTS = ['#179299', '#d20f39', '#df8e1d', '#6c6f85'];

export default function Dashboard({ projects, onSelectProject }: DashboardProps) {
  const isMobile = useIsMobile();
  return (
    <div className="flex flex-col h-full" style={{ background: 'transparent' }}>
      {/* Top bar */}
      <div
        className="shrink-0 flex items-center"
        style={{ height: '52px', borderBottom: '2px solid #5c5470', background: '#faf7f2', paddingLeft: isMobile ? '48px' : '32px' }}
      >
        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#4c4f69', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Dashboard
        </span>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ padding: '32px' }}>
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full pb-24" style={{ textAlign: 'center' }}>
            <div style={{
              padding: '20px 28px', border: '2px solid #5c5470', borderRadius: '4px',
              background: '#faf7f2', boxShadow: '4px 4px 0 #5c5470', marginBottom: '16px',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                {[0.8, 0.4, 0.4, 0.2].map((op, i) => (
                  <div key={i} style={{ width: '20px', height: '20px', borderRadius: '2px', border: `2px solid rgba(45,155,138,${op})` }} />
                ))}
              </div>
            </div>
            <p style={{ fontSize: '0.8125rem', color: '#5c5f77', fontWeight: 700 }}>No projects</p>
            <p style={{ fontSize: '0.6875rem', color: '#8c8fa1', marginTop: '4px' }}>Create one from the sidebar to get started</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', maxWidth: '960px' }}>
            {projects.map((p, i) => {
              const accent = CARD_ACCENTS[i % CARD_ACCENTS.length];
              return (
                <button
                  key={p.id}
                  onClick={() => onSelectProject(p.id)}
                  className="text-left transition-all group"
                  style={{
                    display: 'block', padding: '0', borderRadius: '4px',
                    background: '#faf7f2', border: '2px solid #5c5470', cursor: 'pointer',
                    animationDelay: `${i * 40}ms`,
                    boxShadow: '4px 4px 0 #5c5470',
                    overflow: 'hidden',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translate(-2px, -2px)';
                    e.currentTarget.style.boxShadow = '6px 6px 0 #5c5470';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translate(0, 0)';
                    e.currentTarget.style.boxShadow = '4px 4px 0 #5c5470';
                  }}
                  onMouseDown={e => {
                    e.currentTarget.style.transform = 'translate(2px, 2px)';
                    e.currentTarget.style.boxShadow = '2px 2px 0 #5c5470';
                  }}
                  onMouseUp={e => {
                    e.currentTarget.style.transform = 'translate(-2px, -2px)';
                    e.currentTarget.style.boxShadow = '6px 6px 0 #5c5470';
                  }}
                >
                  {/* Accent title bar */}
                  <div style={{ height: '8px', background: accent, borderBottom: '2px solid #5c5470' }} />

                  <div style={{ padding: '16px 20px 20px' }}>
                    {/* Icon row */}
                    <div className="flex items-start justify-between mb-3">
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '3px', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        background: accent + '22', border: `2px solid ${accent}`,
                      }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="M3 7C3 5.89 3.89 5 5 5H10.17C10.7 5 11.21 5.21 11.59 5.59L12.41 6.41C12.79 6.79 13.3 7 13.83 7H19C20.11 7 21 7.89 21 9V17C21 18.11 20.11 19 19 19H5C3.89 19 3 18.11 3 17V7Z" stroke={accent} strokeWidth="2" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: accent, border: '1px solid #5c5470', marginTop: '4px' }} />
                    </div>

                    {/* Name */}
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#4c4f69', letterSpacing: '-0.01em', marginBottom: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name}
                    </div>

                    {/* Path */}
                    <div style={{ fontSize: '0.6875rem', color: '#8c8fa1', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: p.description ? '10px' : 0 }}>
                      {p.path}
                    </div>

                    {/* Description */}
                    {p.description && (
                      <div style={{ fontSize: '0.75rem', color: '#5c5f77', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {p.description}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
