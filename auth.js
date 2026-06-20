// auth.js
// Owns Supabase Auth only. App logic should not depend on auth provider details.

const SB_URL = 'https://ejrlskbemmdxomznmutx.supabase.co';
const SB_KEY = 'sb_publishable_weoYF06na2nVB4WAkdhI5A_5BoESARI';

window.supabaseClient = supabase.createClient(SB_URL, SB_KEY);

window.Auth = {
  session: null,
  user: null,

  async init(onChange) {
    const { data, error } = await window.supabaseClient.auth.getSession();

    if (error) {
      console.error('Auth session error:', error.message);
    }

    this.session = data?.session || null;
    this.user = this.session?.user || null;

    if (typeof onChange === 'function') {
      await onChange(this.session, 'INITIAL_SESSION');
    }

    window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
      this.session = session || null;
      this.user = session?.user || null;

      if (typeof onChange === 'function') {
        await onChange(this.session, event);
      }
    });
  },

  getUserId() {
    return this.user?.id || null;
  },

  isLoggedIn() {
    return Boolean(this.user?.id);
  },

  normalizeCredentials(email, password) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPassword = String(password || '');

    if (!cleanEmail) {
      throw new Error('Enter your email.');
    }

    if (!cleanPassword) {
      throw new Error('Enter your password.');
    }

    if (cleanPassword.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    return { email: cleanEmail, password: cleanPassword };
  },

  async signInWithPassword(email, password) {
    const credentials = this.normalizeCredentials(email, password);

    const { data, error } = await window.supabaseClient.auth.signInWithPassword(credentials);

    if (error) throw error;
    return data;
  },

  async signUpWithPassword(email, password) {
    const credentials = this.normalizeCredentials(email, password);

    const { data, error } = await window.supabaseClient.auth.signUp({
      ...credentials,
      options: {
        emailRedirectTo: window.location.origin + window.location.pathname,
      },
    });

    if (error) throw error;
    return data;
  },

  async signInWithGoogle() {
    const { error } = await window.supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname,
      },
    });

    if (error) throw error;
    return true;
  },

  async signOut() {
    const { error } = await window.supabaseClient.auth.signOut();

    if (error) throw error;

    this.session = null;
    this.user = null;
  },
};
