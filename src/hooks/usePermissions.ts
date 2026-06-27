// Reactive permission hook bound to the current user's role. Subscribes to the
// store (via useStore) so the UI updates immediately when an admin edits a role
// or reassigns permissions. Reads the catalog helpers in lib/rbac.
import { useAuth } from '../context/AuthContext';
import { useStore } from './useStore';
import { can as rbacCan, canAccess as rbacCanAccess, permissionsForRole } from '../lib/rbac';
import type { Action } from '../lib/rbac';

export function usePermissions() {
  const { user } = useAuth();
  useStore(); // re-render on roles/permissions/profile changes
  const roleId = user?.role_id ?? null;
  return {
    roleId,
    can: (module: string, action: Action) => rbacCan(roleId, module, action),
    canAccess: (module: string) => rbacCanAccess(roleId, module),
    permissions: () => permissionsForRole(roleId),
  };
}
