import { supabase } from '../supabase.ts';
import { getAuthContext, isAuthContextCurrent, getState } from '../store.ts';
import { authRedirectUrl } from './redirect.ts';

export const EMAIL_COOLDOWN_SECONDS = 60;
export type EmailAction = 'recovery' | 'confirmation';
const sentUntil = new Map<string, number>();
function validEmail(value: string): string {
  const email = value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    throw new Error('Enter a valid email address.');
  return email;
}
export function emailCooldown(email: string, action: EmailAction): number {
  return Math.max(
    0,
    Math.ceil(
      ((sentUntil.get(action + ':' + email.trim().toLowerCase()) ?? 0) - Date.now()) / 1000,
    ),
  );
}
export async function sendAuthEmail(value: string, action: EmailAction): Promise<void> {
  const email = validEmail(value);
  const key = action + ':' + email.toLowerCase();
  if (emailCooldown(email, action)) throw new Error('Wait before requesting another email.');
  sentUntil.set(key, Date.now() + EMAIL_COOLDOWN_SECONDS * 1000);
  try {
    const { error } =
      action === 'recovery'
        ? await supabase.auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl(true) })
        : await supabase.auth.resend({
            type: 'signup',
            email,
            options: { emailRedirectTo: authRedirectUrl() },
          });
    if (error) throw new Error('Email could not be sent. Try again after the wait.');
  } catch {
    // Keep the cooldown on failure too: repeated clicks must not flood the service.
    throw new Error('Email could not be sent. Try again after the wait.');
  }
}
export async function updateRecoveryPassword(password: string): Promise<void> {
  const context = getAuthContext();
  if (!context.userId || !getState().recoveryReady)
    throw new Error('This recovery link has expired. Request a new link.');
  if (password.length < 8) throw new Error('Use at least 8 characters.');
  const { error } = await supabase.auth.updateUser({ password });
  if (!isAuthContextCurrent(context))
    throw new Error('Account changed. Open your recovery link again.');
  if (error)
    throw new Error('Password could not be updated. Try again, or request a new recovery link.');
}
export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: authRedirectUrl() },
  });
  if (error) throw new Error('Google sign in could not start. Try again.');
}
