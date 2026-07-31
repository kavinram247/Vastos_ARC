import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Profile, Firm, UserRole, Role } from '../types';
import { supabase } from '../lib/supabase';
import { store } from '../data/store';

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

async function resolveSession(authUid: string): Promise<{ profile: Profile; firm: Firm; plan: SubscriptionPlan | null; isVastosOperator: boolean } | null> {
  // 1. Find the profile linked to this auth UID
  const { data: profileRow, error: pe } = await supabase
    .from('profiles')
    .select('id,firm_id,email,full_name,role,phone,avatar_url,created_at')
    .eq('auth_uid', authUid)
    .single();
  if (pe || !profileRow) return null;

  // 2. Fetch the firm
  const { data: firmRow, error: fe } = await supabase
    .from('firms')
    .select('id,name,address,logo_url,created_at,deleted_at')
    .eq('id', (profileRow as any).firm_id)
    .single();
  if (fe || !firmRow) return null;
  if ((firmRow as any).deleted_at) return null; // firm has been deleted by VASTOS admin

  // 3/4/5 are independent of each other, so they run together rather than as
  // three serial round-trips on the login path.
  //
  //   3. the crm_profile for role_id (RBAC) — matched by email+firm_id, not id
  //      (profiles.id and crm_profiles.id are separate auto-generated UUIDs)
  //   4. the subscription plan (seats_purchased overrides the plan's max_users)
  //   5. platform-operator status. Resolved server-side from auth.uid() against
  //      a deny-all allowlist; the client cannot assert it. Wrapped so that a
  //      throw — network, RPC missing on an older database — yields false and
  //      the console stays hidden. Fail closed.
  const [{ data: crmRow }, { data: subRow }, isVastosOperator] = await Promise.all([
    supabase
      .from('crm_profiles')
      .select('role_id')
      .eq('email', (profileRow as any).email)
      .eq('firm_id', (profileRow as any).firm_id)
      .maybeSingle(),
    (supabase as any)
      .from('firm_subscriptions')
      .select('status,trial_ends_at,plan_id,seats_purchased,subscription_plans(id,name,module_keys,max_users,max_projects,storage_gb)')
      .eq('firm_id', (profileRow as any).firm_id)
      .maybeSingle(),
    (supabase as any)
      .rpc('is_vastos_operator')
      .then(({ data, error }: { data: unknown; error: unknown }) => (error ? false : data === true))
      .catch(() => false),
  ]);

  const planData = subRow ? (subRow as any).subscription_plans : null;
  const plan: SubscriptionPlan | null = planData
    ? {
        id: planData.id,
        name: planData.name,
        module_keys: planData.module_keys ?? [],
        max_users: (subRow as any).seats_purchased ?? planData.max_users,
        max_projects: planData.max_projects,
        storage_gb: planData.storage_gb,
        status: (subRow as any).status,
        trial_ends_at: (subRow as any).trial_ends_at,
      }
    : null;

  const profile: Profile = {
    id: (profileRow as any).id,
    firm_id: (profileRow as any).firm_id,
    email: (profileRow as any).email,
    full_name: (profileRow as any).full_name,
    role: (profileRow as any).role,
    phone: (profileRow as any).phone ?? null,
    avatar_url: (profileRow as any).avatar_url ?? null,
    created_at: (profileRow as any).created_at,
    role_id: (crmRow as any)?.role_id ?? null,
  };

  const firm: Firm = {
    id: (firmRow as any).id,
    name: (firmRow as any).name,
    address: (firmRow as any).address ?? '',
    logo_url: (firmRow as any).logo_url ?? null,
    gstin: (firmRow as any).gstin ?? '',
    payment_split_default: (firmRow as any).payment_split_default ?? 0,
    created_at: (firmRow as any).created_at,
  };

  return { profile, firm, plan, isVastosOperator };
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
        const resolved = await resolveSession(session.user.id);
        if (resolved) enter(resolved.profile, resolved.firm, resolved.plan, resolved.isVastosOperator);
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const resolved = await resolveSession(session.user.id);
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
