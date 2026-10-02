// Resolve from the hosted /app/ path, including deployments below a subdirectory.
export function authRedirectUrl(recovery = false): string {
  const url = new URL('./', window.location.href);
  url.search = recovery ? '?flow=recovery' : '';
  url.hash = '';
  return url.href;
}
export function recoveryIntent(): boolean {
  return new URLSearchParams(window.location.search).get('flow') === 'recovery';
}
export function clearRecoveryIntent(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('flow');
  url.hash = '';
  window.history.replaceState(null, '', url);
}

// Capture the callback failure before the SDK cleans the URL. Never keep tokens.
export const recoveryLinkFailed =
  new URLSearchParams(window.location.search).has('error') ||
  new URLSearchParams(window.location.hash.slice(1)).has('error');
