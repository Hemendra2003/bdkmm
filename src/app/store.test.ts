import { vi, describe, it, expect, beforeEach } from 'vitest';

// Each test gets a fresh module instance so module-level store state is reset.
beforeEach(() => {
  vi.resetModules();
});

function makeSupabaseMock(
  authOverrides: {
    getSession?: unknown;
    signOut?: 'reject' | { error: { message: string } | null };
  } = {},
) {
  const signOutMock = vi.fn();
  if (authOverrides.signOut === 'reject') {
    signOutMock.mockRejectedValue(new Error('Network error'));
  } else if (authOverrides.signOut) {
    signOutMock.mockResolvedValue(authOverrides.signOut);
  } else {
    signOutMock.mockResolvedValue({ error: null });
  }

  return {
    SUPABASE_SETUP_ERROR: null,
    supabase: {
      auth: {
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
        getSession: vi
          .fn()
          .mockResolvedValue(authOverrides.getSession ?? { data: { session: null }, error: null }),
        signOut: signOutMock,
      },
    },
  };
}

describe('store — readSession error', () => {
  it('sets error state when getSession returns an error object', async () => {
    vi.doMock('./supabase.ts', () =>
      makeSupabaseMock({
        getSession: { data: { session: null }, error: { message: 'Session load failed' } },
      }),
    );
    const { getState } = await import('./store.ts');
    // Allow the controller.start() → readSession() → onError chain to settle.
    await new Promise((r) => setTimeout(r, 10));
    expect(getState().status).toBe('error');
    expect(getState().loadError).toBe('Session load failed');
  });
});

describe('store — signOut error paths', () => {
  it('sets error state when signOut returns {error}', async () => {
    vi.doMock('./supabase.ts', () =>
      makeSupabaseMock({ signOut: { error: { message: 'Logout failed' } } }),
    );
    const { signOut, getState } = await import('./store.ts');
    await new Promise((r) => setTimeout(r, 10));
    await signOut();
    expect(getState().status).toBe('error');
    expect(getState().loadError).toBe('Logout failed');
  });

  it('sets error state when signOut rejects', async () => {
    vi.doMock('./supabase.ts', () => makeSupabaseMock({ signOut: 'reject' }));
    const { signOut, getState } = await import('./store.ts');
    await new Promise((r) => setTimeout(r, 10));
    await signOut();
    expect(getState().status).toBe('error');
    expect(getState().loadError).toBe('Network error');
  });
});
