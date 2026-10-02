import { useState, useEffect } from 'react';
import {
  getState,
  subscribe,
  signOut,
  saveEntry,
  saveQuestion,
  removeQuestion,
  type AppState,
} from './store.ts';
import { SignIn } from './screens/SignIn.tsx';
import { Today } from './screens/Today.tsx';
import { CheckIn } from './screens/CheckIn.tsx';
import { Habits } from './screens/Habits.tsx';
import { Progress } from './screens/Progress.tsx';
import { BottomNav, type NavTab } from './components/BottomNav.tsx';
import { StatusLine } from './components/StatusLine.tsx';
import { Button } from './components/Button.tsx';

type Route = NavTab | 'checkin';

function parseRoute(): Route {
  const h = window.location.hash.slice(1);
  if (h === 'habits') return 'habits';
  if (h === 'progress') return 'progress';
  if (h === 'checkin') return 'checkin';
  return 'today';
}

function routeToTab(route: Route): NavTab {
  if (route === 'habits') return 'habits';
  if (route === 'progress') return 'progress';
  return 'today';
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
  route: Route;
  onNavigate: (r: Route) => void;
}

function Shell({ state, route, onNavigate }: ShellProps) {
  const activeTab = routeToTab(route);
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
        {route === 'checkin' ? (
          <Button
            variant="ghost"
            onClick={() => onNavigate('today')}
            style={{ fontSize: 'var(--text-xs)', minHeight: 36, padding: '0 var(--space-3)' }}
          >
            Cancel
          </Button>
        ) : (
          <Button
            variant="ghost"
            onClick={() => void signOut()}
            style={{ fontSize: 'var(--text-xs)', minHeight: 36, padding: '0 var(--space-3)' }}
          >
            Sign out
          </Button>
        )}
      </header>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          paddingBottom: 'calc(var(--nav-height) + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {route === 'today' && <Today state={state} onStartCheckIn={() => onNavigate('checkin')} />}
        {route === 'checkin' && state.todayKey && state.userId && (
          <CheckIn
            questions={state.questions}
            initialAnswers={state.todayEntry?.answers ?? null}
            todayKey={state.todayKey}
            userId={state.userId}
            onSave={saveEntry}
            onClose={() => onNavigate('today')}
          />
        )}
        {route === 'habits' && (
          <Habits questions={state.questions} onSave={saveQuestion} onRemove={removeQuestion} />
        )}
        {route === 'progress' && <Progress />}
      </div>
      <BottomNav activeTab={activeTab} onNavigate={(t) => onNavigate(t)} />
    </div>
  );
}

export function App() {
  const [state, setState] = useState<AppState>(getState);
  const [route, setRoute] = useState<Route>(parseRoute);

  useEffect(() => subscribe(setState), []);

  useEffect(() => {
    const handler = () => setRoute(parseRoute());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  function navigate(r: Route) {
    window.location.hash = r;
    setRoute(r);
  }

  if (state.status === 'loading') return <LoadingScreen />;
  if (state.status === 'signed-out') return <SignIn />;

  // Supabase config error — no session, no shell
  if (state.status === 'error' && !state.userId) {
    return <ConfigErrorScreen message={state.loadError ?? 'App not configured.'} />;
  }

  return <Shell state={state} route={route} onNavigate={navigate} />;
}
