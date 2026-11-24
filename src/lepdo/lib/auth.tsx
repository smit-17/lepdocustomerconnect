import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { Profile } from './types';
import { accountAccess } from './seller-access';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  isOperator: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null);
      return;
    }
    const [{ data }, { data: role }, { data: request }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', s.user.id).maybeSingle(),
      supabase.from('seller_requests').select('status').eq('user_id', s.user.id).maybeSingle(),
    ]);
    // Fail closed if the protected authoritative role cannot be read.
    setProfile(data && role ? { ...data, role: role.role, seller_status: request?.status ?? null } as Profile : null);
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await loadProfile(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'SIGNED_OUT') {
        // defer to avoid deadlocks inside the auth callback
        setTimeout(() => loadProfile(s), 0);
      }
      if (event === 'SIGNED_OUT') qc.clear();
      if (event === 'PASSWORD_RECOVERY' && window.location.pathname !== '/set-password') {
        window.location.assign('/set-password');
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile, qc]);

  const value: AuthState = {
    session,
    profile,
    loading,
    isStaff: !!profile && accountAccess(profile.role, profile.is_active, profile.seller_status).isStaff,
    isAdmin: !!profile && accountAccess(profile.role, profile.is_active, profile.seller_status).isAdmin,
    isOperator: !!profile && accountAccess(profile.role, profile.is_active, profile.seller_status).isOperator,
    refreshProfile: () => loadProfile(session),
    signOut: async () => {
      await supabase.auth.signOut();
      qc.clear();
    },
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
