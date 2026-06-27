import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Profile, Firm, UserRole, Role } from '../types';
import { store } from '../data/store';
import { setRoleContext } from '../lib/supabase';

interface AuthState {
  user: Profile | null;
  firm: Firm | null;
  /** Resolved RBAC role for the current user (from role_id). */
  role: Role | null;
  isAuthenticated: boolean;
  login: (email: string) => boolean;
  logout: () => void;
  switchUser: (userId: string) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [firm, setFirm] = useState<Firm | null>(null);

  // Resolve role + stamp the backend RLS context header on sign-in.
  const enter = (profile: Profile, firmData: Firm) => {
    setUser(profile);
    setFirm(firmData);
    setRoleContext(store.roleForUser(profile.id)?.id ?? profile.role_id ?? null);
  };

  const login = useCallback((email: string) => {
    const profile = store.profiles.find(p => p.email === email);
    if (!profile) return false;
    const firmData = store.firms.find(f => f.id === profile.firm_id);
    if (!firmData) return false;
    enter(profile, firmData);
    return true;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setFirm(null);
    setRoleContext(null);
  }, []);

  const switchUser = useCallback((userId: string) => {
    const profile = store.profiles.find(p => p.id === userId);
    if (!profile) return;
    const firmData = store.firms.find(f => f.id === profile.firm_id);
    if (!firmData) return;
    enter(profile, firmData);
  }, []);

  const role = user ? store.roleForUser(user.id) ?? null : null;

  return (
    <AuthContext.Provider value={{
      user,
      firm,
      role,
      isAuthenticated: !!user,
      login,
      logout,
      switchUser,
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

export function hasAccess(role: UserRole | null, required: UserRole[]): boolean {
  if (!role) return false;
  return required.includes(role);
}
