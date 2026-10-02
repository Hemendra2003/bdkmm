import { useState, useEffect } from 'react';
import {
  getState,
  subscribe,
  signOut,
  finishRecovery,
  saveCheckIn,
  saveQuestion,
  removeQuestion,
  type AppState,
} from './store.ts';
import { SignIn } from './screens/SignIn.tsx';
import { ResetPassword } from './screens/ResetPassword.tsx';
import { Setup } from './screens/Setup.tsx';
import { setupSkipped } from './auth/setup.ts';
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
        data-route-content
        style={{
          flex: 1,
          overflowY: 'auto',
          paddingBottom: 'calc(var(--nav-height) + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {route === 'today' && <Today state={state} onStartCheckIn={() => onNavigate('checkin')} />}
        {route === 'checkin' && state.userId && (
          <DatedCheckIn key={state.userId} state={state} onClose={() => onNavigate('today')} />
        )}
        {route === 'habits' && (
          <Habits questions={state.questions} onSave={saveQuestion} onRemove={removeQuestion} />
        )}
        {route === 'progress' && (
          <Progress historyCache={state.history} todayKey={state.todayKey} />
        )}
      </div>
      <BottomNav activeTab={activeTab} onNavigate={(t) => onNavigate(t)} />
    </div>
  );
}

function DatedCheckIn({ state, onClose }: { state: AppState; onClose: () => void }) {
  const [date] = useState(state.todayKey);
  if (!date || !state.userId) return null;
  return (
    <CheckIn
      questions={state.questions}
      initialAnswers={state.entries.find((entry) => entry.date === date)?.answers ?? null}
      todayKey={date}
      userId={state.userId}
      onSave={(answers) => saveCheckIn(date, answers)}
      onClose={onClose}
    />
  );
}

const routeTitles: Record<Route, string> = {
  today: 'Today',
  checkin: 'Check-in',
  habits: 'Habits',
  progress: 'Progress',
};
function focusRoute() {
  const content = document.querySelector<HTMLElement>('[data-route-content]');
  if (!content) return;
  content.scrollTop = 0;
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  const heading = content.querySelector<HTMLElement>('h1');
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
}

export function App() {
  const [state, setState] = useState<AppState>(getState);
  const [route, setRoute] = useState<Route>(parseRoute);
  const [setupDismissedFor, setSetupDismissedFor] = useState<string | null>(null);
  const showSetup =
    state.status === 'signed-in' &&
    !!state.userId &&
    state.questions.length === 0 &&
    setupDismissedFor !== state.userId &&
    !setupSkipped(state.userId);

  useEffect(() => subscribe(setState), []);

  useEffect(() => {
    const handler = () => setRoute(parseRoute());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  useEffect(() => {
    document.title =
      (state.recoveryMode
        ? 'Reset password'
        : showSetup
          ? 'Choose routine'
          : state.status === 'signed-out'
            ? 'Sign in'
            : routeTitles[route]) + ' · MOMENTUM';
    if (state.userId && state.status !== 'loading') focusRoute();
  }, [route, state.status, state.userId, state.recoveryMode, showSetup]);

  function navigate(r: Route) {
    window.location.hash = r;
    setRoute(r);
    if (r === route) focusRoute();
  }

  if (state.recoveryMode) {
    return (
      <ResetPassword
        key={state.userId ?? 'recovery'}
        state={state}
        onComplete={() => {
          finishRecovery();
          navigate('today');
        }}
      />
    );
  }
  if (state.status === 'loading') return <LoadingScreen />;
  if (state.status === 'signed-out') return <SignIn />;

  // Supabase config error — no session, no shell
  if (state.status === 'error' && !state.userId) {
    return <ConfigErrorScreen message={state.loadError ?? 'App not configured.'} />;
  }

  if (showSetup) {
    return (
      <Setup
        key={state.userId}
        onComplete={(saved) => {
          if (saved) {
            window.location.hash = 'checkin';
            window.location.reload();
          } else {
            setSetupDismissedFor(state.userId);
            navigate('today');
          }
        }}
      />
    );
  }

  return <Shell state={state} route={route} onNavigate={navigate} />;
}
