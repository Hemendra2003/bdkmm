export interface Session {
  user: { id: string };
  [field: string]: unknown;
}
export interface SessionContext {
  userId: string | null;
  generation: number;
}
export interface SessionDependencies {
  subscribe: (receive: (event: string, session: Session | null) => void) => () => void;
  readSession: () => Promise<Session | null>;
  publish: (session: Session | null) => void;
  clear: (previous: string | null, current: string | null) => void;
  boot: (session: Session | null, event: string, context: SessionContext) => Promise<void> | void;
  schedule: (work: () => void) => void;
  onError: (error: unknown) => void;
}

// No browser/client/clock dependencies. The scheduler must defer work until
// after the synchronous auth notification returns (a task, not an awaited callback).
export function createSessionController(deps: SessionDependencies) {
  let userId: string | null = null,
    generation = 0,
    initialized = false;
  let notifications = 0,
    startPromise: Promise<void> | null = null;
  let unsubscribe: (() => void) | null = null;
  let disposed = false;
  const snapshot = (): SessionContext => ({ userId, generation });
  const isCurrent = (context: SessionContext): boolean =>
    !disposed && context.generation === generation && context.userId === userId;
  function receive(event: string, session: Session | null): void {
    if (disposed) return;
    notifications++;
    const next = session?.user.id ?? null;
    deps.publish(session);
    // A repeated SIGNED_IN/INITIAL_SESSION and TOKEN_REFRESHED update the
    // credential snapshot but never restart boot or clear the current UI.
    if (initialized && next === userId) return;
    const previous = userId;
    initialized = true;
    userId = next;
    generation++;
    deps.clear(previous, next);
    const context = snapshot();
    deps.schedule(() => {
      if (!isCurrent(context)) return;
      Promise.resolve()
        .then(() => {
          if (isCurrent(context)) return deps.boot(session, event, context);
        })
        .catch((error: unknown) => {
          if (isCurrent(context)) deps.onError(error);
        });
    });
  }
  function start(): Promise<void> {
    if (startPromise) return startPromise;
    if (disposed) return Promise.reject(new Error('Session controller disposed.'));
    // Subscribe once before loading the snapshot; a newer auth event wins over
    // an old getSession result, even if it switches away and back to the same ID.
    const version = notifications;
    unsubscribe = deps.subscribe(receive);
    startPromise = deps
      .readSession()
      .then((session) => {
        if (!disposed && notifications === version) receive('INITIAL_SESSION', session);
      })
      .catch((error: unknown) => {
        if (!disposed && notifications === version) deps.onError(error);
      });
    return startPromise;
  }
  function dispose(): void {
    if (disposed) return;
    disposed = true;
    generation++;
    unsubscribe?.();
    unsubscribe = null;
  }
  return { start, snapshot, isCurrent, dispose };
}
