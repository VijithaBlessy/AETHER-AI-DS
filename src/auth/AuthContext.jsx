import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { hasSupabaseConfig, setRememberSession, supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);
const DEMO_ACCOUNTS = [
  { role: 'student', email: 'student.demo@aether.edu', registerId: 'AETHER-STUDENT-001', password: 'AetherStudent2026!', full_name: 'AETHER Demo Student', department: 'Artificial Intelligence and Data Science', academic_year: '3rd Year', academic_session:'2024-2025', section: 'A' },
  { role: 'faculty', email: 'faculty.demo@aether.edu', faculty_id: 'AETHER-FACULTY-001', password: 'AetherFaculty2026!', full_name: 'AETHER Local Faculty', department: 'Artificial Intelligence and Data Science', designation: 'Local Demo Faculty' },
  { role: 'admin', email: 'admin.demo@aether.edu', faculty_id: 'AETHER-ADMIN-001', password: 'AetherAdmin2026!', full_name: 'AETHER Local Administrator', department: 'Artificial Intelligence and Data Science', designation: 'Local Demo Administrator' },
];
const DEMO_SESSION_KEY = 'aether-demo-session';
const LOCAL_ACCOUNTS_KEY = 'aether-local-accounts-v1';

async function hashLocalPassword(password, salt) {
  if (!globalThis.crypto?.subtle) throw new Error('Secure local registration needs a modern browser on localhost or HTTPS.');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' }, key, 256);
  return Array.from(new Uint8Array(bits), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
const fromHex = (hex) => Uint8Array.from(hex.match(/.{1,2}/g)||[], (byte) => parseInt(byte,16));

async function getProfile(user) {
  if (!supabase || !user) return null;
  const { data, error } = await supabase.from('profiles').select('id,role,requested_role,full_name,email,register_id,faculty_id,department,academic_year,academic_session,section,designation').eq('id', user.id).maybeSingle();
  if (error) throw new Error('Could not verify your account role. Try again shortly.');
  return data;
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState({ user: null, profile: null, aal: 'aal1', ready: false });
  const [recovery, setRecovery] = useState(false);

  const hydrate = useCallback(async (user) => {
    if (!user) { setAuth({ user: null, profile: null, aal: 'aal1', ready: true }); return; }
    try {
      let profile = await getProfile(user);
      const { data: membership, error: membershipError } = await supabase.from('admin_members').select('user_id').eq('user_id', user.id).maybeSingle();
      if (membershipError) throw membershipError;
      if (membership) profile = { ...(profile || {}), id: user.id, email: user.email, role: 'admin', full_name: profile?.full_name || user.email };
      const requestedRole = window.sessionStorage.getItem('aether-google-role');
      if (requestedRole) {
        window.sessionStorage.removeItem('aether-google-role');
        const resolvedRole = membership ? 'admin' : profile?.role;
        if (resolvedRole !== requestedRole) {
          window.sessionStorage.setItem('aether-login-error', `This Google account is not authorized for ${requestedRole} access. Use a verified account or choose the correct role.`);
          await supabase.auth.signOut();
          return;
        }
      }
      const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      setAuth({ user, profile, aal: assurance?.currentLevel || 'aal1', ready: true });
    }
    catch { setAuth({ user, profile: null, ready: true }); }
  }, []);

  useEffect(() => {
    if (supabase) {
      let alive = true;
      supabase.auth.getSession().then(({ data }) => { if (alive) hydrate(data.session?.user || null); });
      const { data: listener } = supabase.auth.onAuthStateChange((event, session) => { if (event === 'PASSWORD_RECOVERY') setRecovery(true); if (alive) queueMicrotask(() => hydrate(session?.user || null)); });
      return () => { alive = false; listener.subscription.unsubscribe(); };
    }
    const stored = window.localStorage.getItem(DEMO_SESSION_KEY) || window.sessionStorage.getItem(DEMO_SESSION_KEY);
    try {
      const session = stored ? JSON.parse(stored) : null;
      if (session?.user?.demo && ['student','faculty','admin'].includes(session?.profile?.role)) setAuth({ ...session, aal: 'aal2', ready: true });
      else {
        window.localStorage.removeItem(DEMO_SESSION_KEY); window.sessionStorage.removeItem(DEMO_SESSION_KEY);
        setAuth({ user: null, profile: null, ready: true });
      }
    } catch {
      window.localStorage.removeItem(DEMO_SESSION_KEY); window.sessionStorage.removeItem(DEMO_SESSION_KEY);
      setAuth({ user: null, profile: null, ready: true });
    }
  }, [hydrate]);

  const login = async ({ identifier, password, role, remember = false }) => {
    if (supabase) {
      setRememberSession(remember);
      const { data, error } = await supabase.auth.signInWithPassword({ email: identifier, password });
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Email or password is incorrect.' : error.message);
      let profile = await getProfile(data.user);
      if (role === 'admin') {
        const { data: membership, error: membershipError } = await supabase.from('admin_members').select('user_id').eq('user_id', data.user.id).maybeSingle();
        if (membershipError || !membership) { await supabase.auth.signOut(); throw new Error('This account is not an authorized department administrator.'); }
        profile = { ...(profile || {}), id: data.user.id, email: data.user.email, role: 'admin', full_name: profile?.full_name || data.user.email };
      }
      if (!profile) { await supabase.auth.signOut(); throw new Error('Your profile is not ready yet. Contact the department office.'); }
      if (profile.role === 'pending_faculty') { await supabase.auth.signOut(); throw new Error('Faculty access is awaiting department verification.'); }
      if (role !== 'admin' && profile.role !== role) { await supabase.auth.signOut(); throw new Error(`This account is registered as ${profile.role}, not ${role}.`); }
      const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const aal = assurance?.currentLevel || 'aal1';
      setAuth({ user: data.user, profile, aal, ready: true });
      return { role: profile.role, requiresMfa: ['admin','faculty'].includes(profile.role) && aal !== 'aal2' };
    }
    const normalized = identifier.trim().toLowerCase();
    const account = DEMO_ACCOUNTS.find((item) => item.role === role && (item.email === normalized || item.registerId?.toLowerCase() === normalized || item.faculty_id?.toLowerCase() === normalized));
    let profile;let localAccountExists=false;
    if (account && account.password === password) profile = Object.fromEntries(Object.entries(account).filter(([key]) => key !== 'password'));
    if (!profile) {
      let accounts=[];
      try { accounts=JSON.parse(window.localStorage.getItem(LOCAL_ACCOUNTS_KEY)||'[]'); } catch { accounts=[]; }
      const localAccount=accounts.find((item)=>(item.email===normalized||item.register_id?.toLowerCase()===normalized)&&item.role===role);
      if (localAccount) {
        localAccountExists=true;
        const supplied=await hashLocalPassword(password,fromHex(localAccount.password_salt));
        if (supplied===localAccount.password_hash) profile=localAccount.profile;
      }
    }
    if (!profile) throw new Error(account||localAccountExists?'Password is incorrect.':'No matching local account was found. Register first, or use the demo credentials shown below. Google sign-in needs Supabase configuration.');
    const user = { id: profile.id || `demo-${profile.role}`, email: profile.email, demo: true };
    if (profile.registerId) { profile.register_id = profile.registerId; delete profile.registerId; }
    const next = { user, profile, ready: true };
    window.localStorage.removeItem(DEMO_SESSION_KEY); window.sessionStorage.removeItem(DEMO_SESSION_KEY);
    (remember ? window.localStorage : window.sessionStorage).setItem(DEMO_SESSION_KEY, JSON.stringify(next));
    setAuth(next);
    return { role: profile.role };
  };

  const loginWithGoogle = async ({ role }) => {
    if (!supabase) throw new Error('Google sign-in requires a configured Supabase project and Google OAuth provider.');
    if (!['student','faculty','admin'].includes(role)) throw new Error('Choose an account type first.');
    window.sessionStorage.setItem('aether-google-role', role);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/login`, scopes: 'openid email profile', queryParams: { prompt: 'select_account' } },
    });
    if (error) { window.sessionStorage.removeItem('aether-google-role'); throw new Error(error.message); }
  };

  const refreshAssurance = async () => {
    if (!supabase) { setAuth((current) => ({ ...current, aal: 'aal2' })); return 'aal2'; }
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) throw new Error(error.message);
    const aal = data?.currentLevel || 'aal1';
    setAuth((current) => ({ ...current, aal }));
    return aal;
  };

  const register = async ({ role, password, profile }) => {
    if (supabase) {
      const { data, error } = await supabase.auth.signUp({ email: profile.email, password, options: { data: { full_name: profile.full_name, requested_role: role, register_id: profile.register_id || null, faculty_id: profile.faculty_id || null, department: profile.department, academic_year: profile.academic_year || null, academic_session: profile.academic_session || null, section: profile.section || null, designation: profile.designation || null } } });
      if (error) throw new Error(error.message);
      if (!data.session) return { needsConfirmation: true, pendingFaculty: role === 'faculty' };
      const verifiedProfile = await getProfile(data.user);
      setAuth({ user: data.user, profile: verifiedProfile, ready: true });
      return { pendingFaculty: role === 'faculty', role: verifiedProfile?.role };
    }
    if (role === 'faculty') return { pendingFaculty: true, demoRegistration: true };
    const normalizedEmail=profile.email.trim().toLowerCase();
    let accounts=[];
    try { accounts=JSON.parse(window.localStorage.getItem(LOCAL_ACCOUNTS_KEY)||'[]'); } catch { accounts=[]; }
    if(accounts.some((item)=>item.email===normalizedEmail||item.register_id?.toLowerCase()===String(profile.register_id||'').toLowerCase())) throw new Error('An account with this email or register number already exists. Sign in instead.');
    const salt=crypto.getRandomValues(new Uint8Array(16));
    const demoProfile = { ...profile, email:normalizedEmail, role, requested_role: role, id: `demo-${role}-${crypto.randomUUID()}` };
    accounts.push({email:normalizedEmail,register_id:demoProfile.register_id,role,password_salt:Array.from(salt,(byte)=>byte.toString(16).padStart(2,'0')).join(''),password_hash:await hashLocalPassword(password,salt),profile:demoProfile});
    window.localStorage.setItem(LOCAL_ACCOUNTS_KEY,JSON.stringify(accounts));
    const next = { user: { id: demoProfile.id, email: profile.email, demo: true }, profile: demoProfile, ready: true };
    window.sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(next));
    setAuth(next);
    return { role, demoRegistration: true };
  };

  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
    window.localStorage.removeItem(DEMO_SESSION_KEY); window.sessionStorage.removeItem(DEMO_SESSION_KEY);
    setAuth({ user: null, profile: null, ready: true });
  };

  const resetPassword = async (email) => {
    if (!supabase) throw new Error('Password reset is unavailable in demo mode. Use one of the demo credentials shown on the login page.');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login?reset=sent` });
    if (error) throw new Error(error.message);
  };

  const updatePassword = async (password) => {
    if (!supabase) throw new Error('Password changes require Supabase authentication.');
    const { data, error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(error.message);
    setRecovery(false);
    await hydrate(data.user);
  };

  const updateProfile = async (updates) => {
    if (!auth.user || !auth.profile) throw new Error('Sign in before editing your profile.');
    const safeUpdates = Object.fromEntries(Object.entries(updates).filter(([key]) => ['full_name','department','academic_year','academic_session','section','designation'].includes(key)));
    if (supabase) {
      const { data, error } = await supabase.from('profiles').update(safeUpdates).eq('id', auth.user.id).select('id,role,requested_role,full_name,email,register_id,faculty_id,department,academic_year,academic_session,section,designation').single();
      if (error) throw new Error(error.message);
      setAuth((current) => ({ ...current, profile: data }));
    } else {
      const next = { ...auth, profile: { ...auth.profile, ...safeUpdates } };
      setAuth(next);
      const store = window.localStorage.getItem(DEMO_SESSION_KEY) ? window.localStorage : window.sessionStorage;
      store.setItem(DEMO_SESSION_KEY, JSON.stringify(next));
    }
  };

  const value = useMemo(() => ({ ...auth, recovery, mode: hasSupabaseConfig ? 'supabase' : 'demo', login, loginWithGoogle, refreshAssurance, register, logout, resetPassword, updatePassword, updateProfile }), [auth,recovery]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used inside AuthProvider'); return value; }
export const demoCredentials = DEMO_ACCOUNTS.map(({ role, email, registerId, faculty_id, password }) => ({ role, email, id: registerId || faculty_id, password }));
