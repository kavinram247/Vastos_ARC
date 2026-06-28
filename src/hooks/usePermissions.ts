import { useAuth, usePlan } from '../context/AuthContext';
import { useStore } from './useStore';
import { can as rbacCan, canAccess as rbacCanAccess, permissionsForRole } from '../lib/rbac';
import type { Action } from '../lib/rbac';

export function usePermissions() {
  const { user } = useAuth();
  const plan = usePlan();
  useStore(); // re-render on roles/permissions/profile changes
  const roleId = user?.role_id ?? null;

  // Plan entitlement check — suspended accounts block everything
  const planAllows = (module: string): boolean => {
    if (!plan) return true; // no plan data yet (loading) — allow through
    if (plan.status === 'suspended') return false;
    return plan.module_keys.includes(module);
  };

  return {
    roleId,
    can: (module: string, action: Action) => rbacCan(roleId, module, action),
    // canAccess checks BOTH role permission AND plan entitlement
    canAccess: (module: string) => rbacCanAccess(roleId, module) && planAllows(module),
    // planAllows exposed for components that need the plan check independently
    planAllows,
    permissions: () => permissionsForRole(roleId),
  };
}
