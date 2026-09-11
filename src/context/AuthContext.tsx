import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Profile, Firm, UserRole, Role } from '../types';
import { supabase } from '../lib/supabase';
import { store } from '../data/store';
import * as crm from '../lib/crmApi';
import { fetchBootstrap } from '../lib/vastosApi';

// ── Plan type ──────────────────────────────────────────────────
export interface SubscriptionPlan {
  id: string;
  name: string;
  module_keys: string[];
  /** Effective user cap: custom seats_purchased override, or plan's max_users, or null=unlimited */
  max_users: number | null;
  max_projects: number | null;
  storage_gb: number | null;
  status: 'trial' | 'active' | 'suspended' | 'cancelled';
  trial_ends_at: string | null;
}

interface AuthState {
  user: Profile | null;
  firm: Firm | null;
  plan: SubscriptionPlan | null;
  role: Role | null;
  isAuthenticated: boolean;
  /**
   * Vasto platform staff. Resolved server-side per session from a deny-all
   * allowlist, never asserted by the client and never derived from the firm
   * role — a firm admin is not an operator. Gates the operator console only.
   */
  isVastosOperator: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  forgotPassword: (email: string) => Promise<{ error: string | null }>;
  // Dev-only: switch demo profiles without real auth
  switchUser: (userId: string) => void;
}

const AuthContext = createContext<AuthState | null>(null);

// Phase 5, item 2: one call to vastos-api's /api/firm/bootstrap replaces what
// used to be 3 direct-to-Supabase round trips here (profile, firm, then
// crm_profile+subscription+operator-rpc in parallel) *and* the DataStore's
// separate 24-table hydration (crmApi.hydrateAll, still fired next by
// HydrationGate in App.tsx — but store.hydrateFromPayload() below already
// marks the store loaded, so that call is a no-op). The backend verifies the
// bearer token itself, so identity no longer needs to travel in as an arg.
async function resolveSession(): Promise<{ profile: Profile; firm: Firm; plan: SubscriptionPlan | null; isVastosOperator: boolean } | null> {
  let payload;
  try {
    payload = await fetchBootstrap();
  } catch (err) {
    console.error('bootstrap failed', err);
    return null;
  }
  const { session, data } = payload;

  const profile: Profile = {
    id: session.profile.id,
    firm_id: session.profile.firm_id,
    email: session.profile.email,
    full_name: session.profile.full_name,
    role: session.profile.role,
    phone: session.profile.phone ?? undefined,
    avatar_url: session.profile.avatar_url ?? undefined,
    created_at: session.profile.created_at,
    role_id: session.profile.role_id,
  };

  const firm: Firm = {
    id: session.firm.id,
    name: session.firm.name,
    address: session.firm.address ?? '',
    logo_url: session.firm.logo_url ?? undefined,
    gstin: session.firm.gstin ?? '',
    payment_split_default: session.firm.payment_split_default ?? 0,
    created_at: session.firm.created_at,
  };

  const plan: SubscriptionPlan | null = session.plan
    ? {
        id: session.plan.id,
        name: session.plan.name ?? '',
        module_keys: session.plan.module_keys ?? [],
        max_users: session.plan.max_users,
        max_projects: session.plan.max_projects,
        storage_gb: session.plan.storage_gb,
        status: session.plan.status as SubscriptionPlan['status'],
        trial_ends_at: session.plan.trial_ends_at,
      }
    : null;

  // Same write-through scoping crmApi.hydrateAll used to set for us.
  crm.setActiveFirm(firm.id);
  store.hydrateFromPayload(data);

  return { profile, firm, plan, isVastosOperator: session.isVastosOperator };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [firm, setFirm] = useState<Firm | null>(null);
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [isVastosOperator, setIsVastosOperator] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // The server resolves the caller's role from auth.uid(); the client no longer
  // asserts it. See supabase.ts → the removed setRoleContext (audit C4).
  const enter = useCallback((profile: Profile, firmData: Firm, planData: SubscriptionPlan | null, operator: boolean) => {
    setUser(profile);
    setFirm(firmData);
    setPlan(planData);
    setIsVastosOperator(operator);
  }, []);

  const clear = useCallback(() => {
    setUser(null);
    setFirm(null);
    setPlan(null);
    setIsVastosOperator(false);
  }, []);

  // Listen for Supabase auth state changes
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const resolved = await resolveSession();
        if (resolved) enter(resolved.profile, resolved.firm, resolved.plan, resolved.isVastosOperator);
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const resolved = await resolveSession();
        if (resolved) enter(resolved.profile, resolved.firm, resolved.plan, resolved.isVastosOperator);
      } else if (event === 'SIGNED_OUT') {
        store.reset(); // clear in-memory data so next login re-hydrates from DB
        clear();
      }
    });

    return () => subscription.unsubscribe();
  }, [enter, clear]);

  const signIn = useCallback(async (email: string, password: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    clear();
  }, [clear]);

  const forgotPassword = useCallback(async (email: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}?reset=true`,
    });
    return { error: error?.message ?? null };
  }, []);

  // Dev-only: switch between seeded demo profiles without real auth
  const switchUser = useCallback((userId: string) => {
    const profile = store.profiles.find(p => p.id === userId);
    if (!profile) return;
    const firmData = store.firms.find(f => f.id === profile.firm_id);
    if (!firmData) return;
    // Use the Enterprise plan for demo sessions
    const demoPlan: SubscriptionPlan = {
      id: 'demo', name: 'Enterprise',
      module_keys: ['dashboard','leads','projects','tasks','attendance','client-portal','quotations','boq','catalog','vendors','marketing','telephony','calibration',
        'inventory','material_requests','rfqs','purchasing','goods_receipts','stock','consumption','transfers','materials','stock_adjustments','purchase'],
      max_users: null, max_projects: null, storage_gb: null,
      status: 'active', trial_ends_at: null,
    };
    enter(profile, firmData, demoPlan, false);
  }, [enter]);

  const role = user ? store.roleForUser(user.id) ?? null : null;

  return (
    <AuthContext.Provider value={{
      user, firm, plan, role,
      isAuthenticated: !!user,
      isVastosOperator,
      isLoading,
      signIn, signOut, forgotPassword, switchUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function useRole(): UserRole | null {
  const { user } = useAuth();
  return user?.role ?? null;
}

export function usePlan(): SubscriptionPlan | null {
  const { plan } = useAuth();
  return plan;
}

export function hasAccess(role: UserRole | null, required: UserRole[]): boolean {
  if (!role) return false;
  return required.includes(role);
}
