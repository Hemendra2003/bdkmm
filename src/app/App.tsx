import { useState, useEffect } from 'react';
import { getState, subscribe, type AppState } from './store.ts';
import { SignIn } from './screens/SignIn.tsx';
import { Today } from './screens/Today.tsx';
import { StatusLine } from './components/StatusLine.tsx';

export function App() {
  const [state, setState] = useState<AppState>(getState);

  useEffect(() => subscribe(setState), []);

  if (state.status === 'loading') {
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

  if (state.status === 'signed-out') {
    return <SignIn />;
  }

  return <Today state={state} />;
}
