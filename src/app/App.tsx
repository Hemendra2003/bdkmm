import { useState, useEffect } from 'react';
import { getState, subscribe, signOut, type AppState } from './store.ts';
import { SignIn } from './screens/SignIn.tsx';
import { Today } from './screens/Today.tsx';
import { Habits } from './screens/Habits.tsx';
import { Progress } from './screens/Progress.tsx';
import { BottomNav, type NavTab } from './components/BottomNav.tsx';
import { StatusLine } from './components/StatusLine.tsx';
import { Button } from './components/Button.tsx';

function parseTab(): NavTab {
  const h = window.location.hash.slice(1) as NavTab;
  return h === 'habits' || h === 'progress' ? h : 'today';
}

function LoadingScreen() {
  return (
    <div
      role="main"
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100dvh',
      }}
    >
      <StatusLine text="Loading…" tone="muted" />
    </div>
  );
}

function ConfigErrorScreen({ message }: { message: string }) {
  return (
    <div
      role="main"
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
        minHeight: '100dvh',
      }}
    >
      <StatusLine text={message} tone="error" />
    </div>
  );
}

interface ShellProps {
  state: AppState;
  tab: NavTab;
  onNavigate: (t: NavTab) => void;
}

function Shell({ state, tab, onNavigate }: ShellProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-3) var(--space-4)',
          borderBottom: '1px solid var(--surface-border)',
          background: 'var(--bg-nav)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          paddingTop: 'calc(var(--space-3) + env(safe-area-inset-top, 0px))',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-pixel)',
            fontSize: '10px',
            color: 'var(--color-gold)',
            letterSpacing: '.04em',
            lineHeight: 1,
          }}
        >
          MOMENTUM
        </span>
        <Button
          variant="ghost"
          onClick={() => void signOut()}
          style={{
            fontSize: 'var(--text-xs)',
            minHeight: 36,
            padding: '0 var(--space-3)',
          }}
        >
          Sign out
        </Button>
      </header>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          paddingBottom: 'calc(var(--nav-height) + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {tab === 'today' && <Today state={state} />}
        {tab === 'habits' && <Habits />}
        {tab === 'progress' && <Progress />}
      </div>
      <BottomNav activeTab={tab} onNavigate={onNavigate} />
    </div>
  );
}

export function App() {
  const [state, setState] = useState<AppState>(getState);
  const [tab, setTab] = useState<NavTab>(parseTab);

  useEffect(() => subscribe(setState), []);

  useEffect(() => {
    const handler = () => setTab(parseTab());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  function navigate(t: NavTab) {
    window.location.hash = t;
    setTab(t);
  }

  if (state.status === 'loading') return <LoadingScreen />;
  if (state.status === 'signed-out') return <SignIn />;

  // Supabase config error — no session, no shell
  if (state.status === 'error' && !state.userId) {
    return <ConfigErrorScreen message={state.loadError ?? 'App not configured.'} />;
  }

  return <Shell state={state} tab={tab} onNavigate={navigate} />;
}
