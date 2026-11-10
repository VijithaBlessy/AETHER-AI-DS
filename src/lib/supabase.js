import { createClient } from '@supabase/supabase-js';

export const hasSupabaseConfig = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
const persistence = { remember: window.localStorage.getItem('aether-auth-remember') !== 'false' };
const safeStorage = {
  getItem: (key) => persistence.remember ? (window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key)) : (window.sessionStorage.getItem(key) ?? window.localStorage.getItem(key)),
  setItem: (key, value) => {
    const target = persistence.remember ? window.localStorage : window.sessionStorage;
    const other = persistence.remember ? window.sessionStorage : window.localStorage;
    other.removeItem(key);
    target.setItem(key, value);
  },
  removeItem: (key) => { window.localStorage.removeItem(key); window.sessionStorage.removeItem(key); },
};

export const supabase = hasSupabaseConfig ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
  auth: { storage: safeStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;

export function setRememberSession(remember) { persistence.remember = remember; window.localStorage.setItem('aether-auth-remember', String(remember)); }
