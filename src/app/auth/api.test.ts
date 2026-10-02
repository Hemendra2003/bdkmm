import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  reset: vi.fn(),
  resend: vi.fn(),
  update: vi.fn(),
  oauth: vi.fn(),
  context: { userId: 'A' as string | null, generation: 1 },
  ready: true,
}));
vi.mock('../supabase.ts', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: mocks.reset,
      resend: mocks.resend,
      updateUser: mocks.update,
      signInWithOAuth: mocks.oauth,
    },
  },
}));
vi.mock('../store.ts', () => ({
  getAuthContext: () => ({ ...mocks.context }),
  isAuthContextCurrent: (context: typeof mocks.context) =>
    context.userId === mocks.context.userId && context.generation === mocks.context.generation,
  getState: () => ({ recoveryReady: mocks.ready }),
}));
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-02T00:00:00Z'));
  window.history.replaceState(null, '', '/app/');
  mocks.context = { userId: 'A', generation: 1 };
  mocks.ready = true;
  for (const mock of [mocks.reset, mocks.resend, mocks.update, mocks.oauth])
    mock.mockReset().mockResolvedValue({ error: null });
});
afterEach(() => vi.useRealTimers());
it('sends recovery to the explicit app URL and enforces a shared 60s resend cooldown', async () => {
  const api = await import('./api.ts');
  await api.sendAuthEmail(' a@example.test ', 'recovery');
  expect(mocks.reset).toHaveBeenCalledWith('a@example.test', {
    redirectTo: window.location.origin + '/app/?flow=recovery',
  });
  expect(api.emailCooldown('A@example.test', 'recovery')).toBe(60);
  await expect(api.sendAuthEmail('a@example.test', 'recovery')).rejects.toThrow(/Wait/);
  vi.advanceTimersByTime(60000);
  await api.sendAuthEmail('a@example.test', 'recovery');
  expect(mocks.reset).toHaveBeenCalledTimes(2);
});
it('resends confirmation through the correct SDK method; recovery uses a separate bucket', async () => {
  const api = await import('./api.ts');
  await api.sendAuthEmail('a@example.test', 'confirmation');
  expect(mocks.resend).toHaveBeenCalledWith({
    type: 'signup',
    email: 'a@example.test',
    options: { emailRedirectTo: window.location.origin + '/app/' },
  });
  await api.sendAuthEmail('a@example.test', 'recovery');
  expect(mocks.reset).toHaveBeenCalledTimes(1);
});
it('rejects invalid email before sending and handles backend failure without exposing details', async () => {
  const api = await import('./api.ts');
  await expect(api.sendAuthEmail('bad', 'recovery')).rejects.toThrow(/valid email/);
  expect(mocks.reset).not.toHaveBeenCalled();
  mocks.reset.mockResolvedValue({ error: { message: 'User does not exist: secret' } });
  await expect(api.sendAuthEmail('a@example.test', 'recovery')).rejects.toThrow(
    'Email could not be sent. Try again after the wait.',
  );
  expect(api.emailCooldown('a@example.test', 'recovery')).toBe(60);
});
it('requires a valid recovery session, validates password and drops a late account completion', async () => {
  const api = await import('./api.ts');
  mocks.ready = false;
  await expect(api.updateRecoveryPassword('longpassword')).rejects.toThrow(/expired/);
  mocks.ready = true;
  await expect(api.updateRecoveryPassword('short')).rejects.toThrow(/8/);
  expect(mocks.update).not.toHaveBeenCalled();
  mocks.update.mockImplementation(async () => {
    mocks.context.generation++;
    return { error: null };
  });
  await expect(api.updateRecoveryPassword('longpassword')).rejects.toThrow(/Account changed/);
});
it('updates only the current recovery user and supports Google redirect', async () => {
  const api = await import('./api.ts');
  await api.updateRecoveryPassword('longpassword');
  expect(mocks.update).toHaveBeenCalledWith({ password: 'longpassword' });
  await api.signInWithGoogle();
  expect(mocks.oauth).toHaveBeenCalledWith({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/app/' },
  });
});
