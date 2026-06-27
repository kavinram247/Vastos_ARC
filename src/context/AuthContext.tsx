import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Profile, Firm, UserRole } from '../types';
import { store } from '../data/store';

interface AuthState {
  user: Profile | null;
  firm: Firm | null;
  isAuthenticated: boolean;
  login: (email: string) => boolean;
  logout: () => void;
  switchUser: (userId: string) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [firm, setFirm] = useState<Firm | null>(null);

  const login = useCallback((email: string) => {
    const profile = store.profiles.find(p => p.email === email);
    if (!profile) return false;
    const firmData = store.firms.find(f => f.id === profile.firm_id);
    if (!firmData) return false;
    setUser(profile);
    setFirm(firmData);
    return true;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setFirm(null);
  }, []);

  const switchUser = useCallback((userId: string) => {
    const profile = store.profiles.find(p => p.id === userId);
    if (!profile) return;
    const firmData = store.firms.find(f => f.id === profile.firm_id);
    if (!firmData) return;
    setUser(profile);
    setFirm(firmData);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      firm,
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
