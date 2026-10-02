export type NavTab = 'today' | 'habits' | 'progress';

interface BottomNavProps {
  activeTab: NavTab;
  onNavigate: (tab: NavTab) => void;
}

export function BottomNav({ activeTab, onNavigate }: BottomNavProps) {
  const tabs: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'today', label: 'Today', icon: <RocketIcon /> },
    { id: 'habits', label: 'Habits', icon: <CheckIcon /> },
    { id: 'progress', label: 'Progress', icon: <ChartIcon /> },
  ];

  return (
    <nav
      aria-label="Main navigation"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        background: 'var(--bg-nav)',
        borderTop: '1px solid var(--surface-border)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        zIndex: 100,
      }}
    >
      {tabs.map(({ id, label, icon }) => {
        const active = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            aria-current={active ? 'page' : undefined}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              minHeight: 'var(--touch-min)',
              background: 'transparent',
              border: 'none',
              borderTop: `2px solid ${active ? 'var(--color-gold)' : 'transparent'}`,
              color: active ? 'var(--color-gold)' : 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'color var(--duration-fast)',
              padding: 'var(--space-2) var(--space-1)',
            }}
          >
            {icon}
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function RocketIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="6" y="0" width="4" height="2" />
      <rect x="4" y="2" width="8" height="2" />
      <rect x="4" y="4" width="8" height="6" />
      <rect x="2" y="10" width="12" height="2" />
      <rect x="5" y="12" width="6" height="2" />
      <rect x="6" y="14" width="4" height="2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="0" y="10" width="2" height="2" />
      <rect x="2" y="12" width="4" height="2" />
      <rect x="6" y="10" width="2" height="2" />
      <rect x="8" y="8" width="2" height="2" />
      <rect x="10" y="6" width="2" height="2" />
      <rect x="12" y="4" width="2" height="2" />
      <rect x="14" y="2" width="2" height="2" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="1" y="2" width="4" height="12" />
      <rect x="6" y="6" width="4" height="8" />
      <rect x="11" y="10" width="4" height="4" />
      <rect x="0" y="14" width="16" height="2" />
    </svg>
  );
}
