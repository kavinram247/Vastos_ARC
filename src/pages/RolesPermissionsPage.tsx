import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../hooks/useStore';
import { usePermissions } from '../hooks/usePermissions';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input, Textarea, Select } from '../components/ui/Input';
import { Avatar } from '../components/ui/Avatar';
import { AccessDenied } from '../components/AccessDenied';
import { MODULES, ACTIONS, ACTION_LABELS, permissionsForRole } from '../lib/rbac';
import type { Action } from '../lib/rbac';
import type { Role, RoleScope } from '../types';
import { logAdminAction } from '../lib/events';
import { store as rawStore } from '../data/store';
import {
  ShieldCheck, Plus, Copy, Trash2, Power, Users as UsersIcon, Check, Lock, Pencil,
} from 'lucide-react';
import { cn } from '../utils/cn';

const SCOPE_LABELS: Record<RoleScope, string> = {
  all: 'All records',
  assigned: 'Assigned only',
  own: 'Own records',
};
const SCOPE_OPTIONS = [
  { value: 'all', label: 'All records (full firm data)' },
  { value: 'assigned', label: 'Assigned only (e.g. site engineers)' },
  { value: 'own', label: 'Own records (e.g. clients)' },
];

export function RolesPermissionsPage() {
  const { user, firm } = useAuth();
  const store = useStore();
  const { can } = usePermissions();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Role | null>(null);

  if (!user || !firm) return null;
  if (!can('roles', 'view')) return <AccessDenied module="Roles & Access" />;

  const canCreate = can('roles', 'create');
  const canEdit = can('roles', 'edit');
  const canDelete = can('roles', 'delete');

  const roles = store.roles.filter(r => r.firm_id === firm.id);
  const selected = roles.find(r => r.id === selectedId) || roles[0] || null;
  const userCount = (roleId: string) => store.profiles.filter(p => p.firm_id === firm.id && p.role_id === roleId).length;

  const handleCreate = (data: { name: string; description: string; scope: RoleScope }) => {
    const key = `${data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Math.random().toString(36).slice(2, 5)}`;
    const role = store.addRole({
      firm_id: firm.id, key, name: data.name, description: data.description,
      scope: data.scope, is_system: false, is_admin: false, enabled: true, color: 'slate',
    });
    logAdminAction({ firmId: firm.id, actorId: user.id, action: 'created', actionLabel: `Created role "${data.name}"`, module: 'role', entityId: role.id, entityName: data.name });
    setSelectedId(role.id);
    setShowCreate(false);
  };

  const handleClone = (role: Role) => {
    const clone = store.cloneRole(role.id);
    if (clone) {
      logAdminAction({ firmId: firm.id, actorId: user.id, action: 'created', actionLabel: `Cloned role "${role.name}" → "${clone.name}"`, module: 'role', entityId: clone.id, entityName: clone.name });
      setSelectedId(clone.id);
    }
  };

  const handleToggleEnabled = (role: Role) => {
    store.setRoleEnabled(role.id, !role.enabled);
    logAdminAction({ firmId: firm.id, actorId: user.id, action: 'status_changed', actionLabel: `${role.enabled ? 'Disabled' : 'Enabled'} role "${role.name}"`, module: 'role', entityId: role.id, entityName: role.name, previousValue: role.enabled ? 'enabled' : 'disabled', updatedValue: role.enabled ? 'disabled' : 'enabled' });
  };

  const handleDelete = (role: Role) => {
    store.deleteRole(role.id);
    logAdminAction({ firmId: firm.id, actorId: user.id, action: 'deleted', actionLabel: `Deleted role "${role.name}"`, module: 'role', entityId: role.id, entityName: role.name });
    setConfirmDelete(null);
    if (selectedId === role.id) setSelectedId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/10"><ShieldCheck className="h-5 w-5 text-indigo-600" /></span>
            Roles &amp; Access
          </h1>
          <p className="mt-1 text-sm text-slate-500">Define roles, control which modules and actions each can use, and assign your team.</p>
        </div>
        {canCreate && <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> New role</Button>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Roles list */}
        <div className="space-y-2.5">
          {roles.map(role => {
            const active = selected?.id === role.id;
            return (
              <button key={role.id} onClick={() => setSelectedId(role.id)}
                className={cn('w-full rounded-xl border bg-white p-3.5 text-left transition-all',
                  active ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-slate-300',
                  !role.enabled && 'opacity-60')}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-semibold text-slate-900">
                    {role.name}
                    {role.is_system && <Lock className="h-3 w-3 text-slate-400" />}
                  </span>
                  {role.is_admin && <Badge variant="info" size="sm">Admin</Badge>}
                </div>
                <p className="mt-1 line-clamp-1 text-xs text-slate-400">{role.description}</p>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                  <Badge variant="outline" size="sm">{SCOPE_LABELS[role.scope]}</Badge>
                  <span className="inline-flex items-center gap-1"><UsersIcon className="h-3 w-3" />{userCount(role.id)}</span>
                  {!role.enabled && <span className="text-amber-600">Disabled</span>}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected role detail */}
        {selected ? (
          <RoleDetail
            key={selected.id}
            role={selected}
            firmId={firm.id}
            actorId={user.id}
            canEdit={canEdit && (!selected.is_admin)}
            canManageMembers={can('users', 'assign') || can('roles', 'edit')}
            canDelete={canDelete}
            onClone={() => handleClone(selected)}
            onToggleEnabled={() => handleToggleEnabled(selected)}
            onAskDelete={() => setConfirmDelete(selected)}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 py-20 text-center text-sm text-slate-400">Select a role to configure its permissions.</div>
        )}
      </div>

      {showCreate && <CreateRoleModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
      {confirmDelete && (
        <Modal open onClose={() => setConfirmDelete(null)} title="Delete role" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Delete <b>{confirmDelete.name}</b>? Users assigned to it will be left without a role until reassigned. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => handleDelete(confirmDelete)}><Trash2 className="h-4 w-4" /> Delete role</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Selected role: header actions + permission matrix + members ──
function RoleDetail({ role, firmId, actorId, canEdit, canManageMembers, canDelete, onClone, onToggleEnabled, onAskDelete }: {
  role: Role; firmId: string; actorId: string; canEdit: boolean; canManageMembers: boolean; canDelete: boolean;
  onClone: () => void; onToggleEnabled: () => void; onAskDelete: () => void;
}) {
  const store = useStore(); // subscribe; recompute perms each render
  const [showEdit, setShowEdit] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  void store;
  const perms = permissionsForRole(role.id);

  const toggle = async (moduleKey: string, action: Action, allowed: boolean) => {
    if (!canEdit) return;
    setSaveError(null);
    const current = (perms[moduleKey] || []) as Action[];
    const next = allowed ? current.filter(a => a !== action) : [...current, action];
    const err = await store.setRolePermissions(role.id, moduleKey, next, firmId);
    if (err) {
      setSaveError(`Failed to save: ${err}`);
      // Roll back the in-memory change so UI stays consistent with DB
      store.setRolePermissions(role.id, moduleKey, current, firmId);
      return;
    }
    logAdminAction({ firmId, actorId, action: 'updated', actionLabel: `Updated "${role.name}" permissions`, module: 'permission', entityId: role.id, entityName: role.name, details: `${moduleKey}: ${next.join(', ') || 'none'}` });
  };

  const members = store.profiles.filter(p => p.firm_id === firmId && p.role_id === role.id);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">{role.name}</h2>
            {role.is_system && <Badge variant="outline" size="sm"><Lock className="mr-1 h-3 w-3" /> System</Badge>}
            {!role.enabled && <Badge variant="warning" size="sm">Disabled</Badge>}
          </div>
          <p className="mt-0.5 text-sm text-slate-500">{role.description} · <span className="text-slate-400">Scope: {SCOPE_LABELS[role.scope]}</span></p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && <Button variant="secondary" size="sm" onClick={() => setShowEdit(true)}><Pencil className="h-4 w-4" /> Edit</Button>}
          <Button variant="secondary" size="sm" onClick={onClone}><Copy className="h-4 w-4" /> Clone</Button>
          {canEdit && <Button variant="secondary" size="sm" onClick={onToggleEnabled}><Power className="h-4 w-4" /> {role.enabled ? 'Disable' : 'Enable'}</Button>}
          {canDelete && !role.is_system && <Button variant="danger" size="sm" onClick={onAskDelete}><Trash2 className="h-4 w-4" /> Delete</Button>}
        </div>
      </div>

      {saveError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">{saveError}</div>
      )}

      {role.is_admin && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-4 py-2.5 text-xs text-indigo-700">
          The Admin role always has full access to every module and action — its permissions can't be edited.
        </div>
      )}

      {/* Permission matrix */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5 font-semibold">Module</th>
              {ACTIONS.map(a => <th key={a} className="px-2 py-2.5 text-center font-semibold">{ACTION_LABELS[a]}</th>)}
            </tr>
          </thead>
          <tbody>
            {MODULES.map(mod => {
              const granted = (perms[mod.key] || []) as Action[];
              return (
                <tr key={mod.key} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-slate-800">{mod.label}</div>
                    <div className="text-[11px] text-slate-400">{mod.group || 'project'}</div>
                  </td>
                  {ACTIONS.map(action => {
                    const applicable = mod.actions.includes(action);
                    const allowed = granted.includes(action);
                    if (!applicable) return <td key={action} className="px-2 py-2.5 text-center text-slate-200">—</td>;
                    return (
                      <td key={action} className="px-2 py-2.5 text-center">
                        <button
                          aria-label={`${mod.label} ${action}`}
                          disabled={!canEdit}
                          onClick={() => toggle(mod.key, action, allowed)}
                          className={cn('inline-flex h-5 w-5 items-center justify-center rounded border transition-colors',
                            allowed ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-300 bg-white',
                            canEdit ? 'hover:border-indigo-400' : 'cursor-not-allowed opacity-70')}>
                          {allowed && <Check className="h-3 w-3" />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Members / assignment */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700"><UsersIcon className="h-4 w-4" /> Members ({members.length})</h3>
        {members.length === 0 ? (
          <p className="text-sm text-slate-400">No users assigned to this role yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {members.map(m => (
              <span key={m.id} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700">
                <Avatar name={m.full_name} size="sm" /> {m.full_name}
              </span>
            ))}
          </div>
        )}
        {canManageMembers && <AssignMembers role={role} firmId={firmId} actorId={actorId} />}
      </div>

      {showEdit && <EditRoleModal role={role} firmId={firmId} actorId={actorId} onClose={() => setShowEdit(false)} />}
    </div>
  );
}

function AssignMembers({ role, firmId, actorId }: { role: Role; firmId: string; actorId: string }) {
  const store = useStore();
  const [pick, setPick] = useState('');
  const candidates = store.profiles.filter(p => p.firm_id === firmId && p.role_id !== role.id);

  if (candidates.length === 0) return null;
  const assign = () => {
    const target = store.profiles.find(p => p.id === pick);
    if (!target) return;
    const prevRole = store.roles.find(r => r.id === target.role_id);
    store.assignUserRole(target.id, role.id);
    logAdminAction({ firmId, actorId, action: 'assigned', actionLabel: `Assigned ${target.full_name} to role "${role.name}"`, module: 'user', entityId: target.id, entityName: target.full_name, previousValue: prevRole?.name, updatedValue: role.name });
    setPick('');
  };

  return (
    <div className="mt-4 flex items-end gap-2 border-t border-slate-100 pt-4">
      <div className="flex-1">
        <Select label="Assign a user to this role" value={pick} onChange={e => setPick(e.target.value)}
          options={[{ value: '', label: 'Select a user…' }, ...candidates.map(c => ({ value: c.id, label: `${c.full_name} (${c.email})` }))]} />
      </div>
      <Button size="sm" onClick={assign} disabled={!pick}><Check className="h-4 w-4" /> Assign</Button>
    </div>
  );
}

function CreateRoleModal({ onClose, onCreate }: { onClose: () => void; onCreate: (d: { name: string; description: string; scope: RoleScope }) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState<RoleScope>('all');
  return (
    <Modal open onClose={onClose} title="Create role" size="md">
      <form onSubmit={e => { e.preventDefault(); if (name.trim()) onCreate({ name: name.trim(), description: description.trim(), scope }); }} className="space-y-4">
        <Input label="Role name" required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sales Executive" />
        <Textarea label="Description" value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this role for?" rows={2} />
        <Select label="Data scope" value={scope} onChange={e => setScope(e.target.value as RoleScope)} options={SCOPE_OPTIONS} />
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">New roles start with no module access. Grant permissions in the matrix after creating.</p>
        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit"><Plus className="h-4 w-4" /> Create role</Button>
        </div>
      </form>
    </Modal>
  );
}

function EditRoleModal({ role, firmId, actorId, onClose }: { role: Role; firmId: string; actorId: string; onClose: () => void }) {
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description || '');
  const [scope, setScope] = useState<RoleScope>(role.scope);
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    rawStore.updateRole(role.id, { name: name.trim(), description, scope });
    logAdminAction({ firmId, actorId, action: 'updated', actionLabel: `Updated role "${role.name}"`, module: 'role', entityId: role.id, entityName: name.trim() });
    onClose();
  };
  return (
    <Modal open onClose={onClose} title="Edit role" size="md">
      <form onSubmit={save} className="space-y-4">
        <Input label="Role name" required value={name} onChange={e => setName(e.target.value)} disabled={role.is_system} />
        {role.is_system && <p className="-mt-2 text-[11px] text-slate-400">System role names are locked.</p>}
        <Textarea label="Description" value={description} onChange={e => setDescription(e.target.value)} rows={2} />
        <Select label="Data scope" value={scope} onChange={e => setScope(e.target.value as RoleScope)} options={SCOPE_OPTIONS} />
        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit"><Check className="h-4 w-4" /> Save changes</Button>
        </div>
      </form>
    </Modal>
  );
}
