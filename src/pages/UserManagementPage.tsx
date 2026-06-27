import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../hooks/useStore';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input, Select } from '../components/ui/Input';
import { Avatar } from '../components/ui/Avatar';
import type { UserRole } from '../types';
import {
  Users, Edit2, Trash2, Mail, Phone, Shield, Palette,
  HardHat, User, Search, FolderKanban, Check,
  UserPlus, MoreVertical,
} from 'lucide-react';
import { cn } from '../utils/cn';

const roleIcons: Record<UserRole, React.ElementType> = {
  owner: Shield,
  architect: Palette,
  engineer: HardHat,
  client: User,
};



const roleBadgeVariants: Record<UserRole, 'info' | 'success' | 'warning' | 'default'> = {
  owner: 'info',
  architect: 'success',
  engineer: 'warning',
  client: 'default',
};

export function UserManagementPage() {
  const { user, firm } = useAuth();
  const store = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  if (!user || !firm) return null;
  if (user.role !== 'owner') {
    return (
      <div className="text-center py-12">
        <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500">Only firm owners can access user management.</p>
      </div>
    );
  }

  const data = store.forFirm(firm.id);
  const allUsers = data.profiles;

  const filteredUsers = allUsers.filter(p => {
    if (roleFilter !== 'all' && p.role !== roleFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return p.full_name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
    }
    return true;
  });

  const internalTeam = filteredUsers.filter(p => p.role !== 'client');
  const clients = filteredUsers.filter(p => p.role === 'client');

  const getAssignments = (userId: string) => {
    return data.assignments
      .filter(a => a.user_id === userId)
      .map(a => data.projects.find(p => p.id === a.project_id))
      .filter(Boolean);
  };

  const getClientProjects = (clientId: string) => {
    return data.projects.filter(p => p.client_id === clientId);
  };

  const handleDeleteUser = () => {
    // In a real app, this would call an API
    // For demo, we'll just show a message
    alert('User removed from firm (demo mode - data not actually deleted)');
    setShowDeleteConfirm(null);
  };

  const renderUserCard = (profile: typeof allUsers[0]) => {
    const Icon = roleIcons[profile.role];
    const isCurrentUser = profile.id === user.id;
    const assignments = profile.role === 'client' 
      ? getClientProjects(profile.id) 
      : getAssignments(profile.id);

    return (
      <Card key={profile.id} className="relative">
        <div className="flex items-start gap-4">
          <Avatar name={profile.full_name} size="lg" />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-slate-900">{profile.full_name}</h3>
              {isCurrentUser && (
                <Badge variant="outline" size="sm">You</Badge>
              )}
              <Badge variant={roleBadgeVariants[profile.role]} size="sm">
                <Icon className="w-3 h-3 mr-1" />
                {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
              </Badge>
            </div>

            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                {profile.email}
              </div>
              {profile.phone && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {profile.phone}
                </div>
              )}

            </div>

            {/* Project Assignments */}
            {assignments.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                  <FolderKanban className="w-3 h-3" />
                  {profile.role === 'client' ? 'Projects' : 'Assigned to'}:
                </div>
                <div className="flex flex-wrap gap-1">
                  {assignments.map(proj => proj && (
                    <span key={proj.id} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                      {proj.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions Menu */}
          {!isCurrentUser && (
            <div className="relative">
              <button
                onClick={() => setActiveMenu(activeMenu === profile.id ? null : profile.id)}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              
              {activeMenu === profile.id && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setActiveMenu(null)} />
                  <div className="floating-panel absolute right-0 top-full z-20 mt-1 w-48 py-1">
                    <button
                      onClick={() => { setEditingUser(profile.id); setActiveMenu(null); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <Edit2 className="w-4 h-4" /> Edit Details
                    </button>
                    {profile.role === 'engineer' && (
                      <button
                        onClick={() => { setShowAssignModal(profile.id); setActiveMenu(null); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <FolderKanban className="w-4 h-4" /> Manage Assignments
                      </button>
                    )}
                    <button
                      onClick={() => { setShowDeleteConfirm(profile.id); setActiveMenu(null); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" /> Remove User
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-[28px] font-semibold leading-tight text-slate-900">
            <Users className="h-5 w-5 text-indigo-600" />
            User Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Manage team members and clients for {firm.name}
          </p>
        </div>
        <Button onClick={() => setShowInviteModal(true)}>
          <UserPlus className="w-4 h-4" /> Invite User
        </Button>
      </div>

      {/* Stats */}
      <div className="metric-strip">
        <div className="metric-cell"><div className="metric-label">Total users</div><div className="metric-value">{allUsers.length}</div></div>
        <div className="metric-cell"><div className="metric-label">Architects</div><div className="metric-value text-indigo-700">{allUsers.filter(u => u.role === 'owner' || u.role === 'architect').length}</div></div>
        <div className="metric-cell"><div className="metric-label">Engineers</div><div className="metric-value text-amber-700">{allUsers.filter(u => u.role === 'engineer').length}</div></div>
        <div className="metric-cell"><div className="metric-label">Clients</div><div className="metric-value text-emerald-700">{allUsers.filter(u => u.role === 'client').length}</div></div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Roles</option>
          <option value="owner">Owners</option>
          <option value="architect">Architects</option>
          <option value="engineer">Engineers</option>
          <option value="client">Clients</option>
        </select>
      </div>

      {/* Internal Team */}
      {internalTeam.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Internal Team ({internalTeam.length})
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {internalTeam.map(renderUserCard)}
          </div>
        </div>
      )}

      {/* Clients */}
      {clients.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <User className="w-4 h-4" />
            Clients ({clients.length})
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {clients.map(renderUserCard)}
          </div>
        </div>
      )}

      {filteredUsers.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No users found matching your criteria.</p>
        </div>
      )}

      {/* Invite User Modal */}
      <InviteUserModal
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        firmId={firm.id}
      />

      {/* Edit User Modal */}
      <EditUserModal
        open={!!editingUser}
        onClose={() => setEditingUser(null)}
        userId={editingUser || ''}
      />

      {/* Assign Projects Modal */}
      <AssignProjectsModal
        open={!!showAssignModal}
        onClose={() => setShowAssignModal(null)}
        userId={showAssignModal || ''}
        firmId={firm.id}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        title="Remove User"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to remove this user from your firm? They will lose access to all projects and data.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowDeleteConfirm(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => handleDeleteUser()}>
              <Trash2 className="w-4 h-4" /> Remove User
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Invite User Modal
function InviteUserModal({ open, onClose, firmId }: { open: boolean; onClose: () => void; firmId: string }) {
  const store = useStore();
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    role: 'engineer' as UserRole,
    send_invite: true,
  });
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name || !form.email) return;

    // Add the new profile (write-through to Supabase)
    store.addProfile({
      firm_id: firmId,
      email: form.email,
      full_name: form.full_name,
      role: form.role,
      phone: form.phone || undefined,
    });
    setSent(true);

    setTimeout(() => {
      setSent(false);
      setForm({ full_name: '', email: '', phone: '', role: 'engineer', send_invite: true });
      onClose();
    }, 1500);
  };

  return (
    <Modal open={open} onClose={onClose} title="Invite New User" size="md">
      {sent ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Invitation Sent!</h3>
          <p className="text-sm text-slate-500 mt-1">
            {form.full_name} will receive an email to join your firm.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name"
            required
            value={form.full_name}
            onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
            placeholder="John Doe"
          />
          <Input
            label="Email"
            type="email"
            required
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="john@example.com"
          />
          <Input
            label="Phone Number"
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            placeholder="+91 98200 12345"
          />
          <Select
            label="Role"
            value={form.role}
            onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}
            options={[
              { value: 'architect', label: '🎨 Architect / Designer' },
              { value: 'engineer', label: '👷 Site Engineer' },
              { value: 'client', label: '👤 Client' },
            ]}
          />

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.send_invite}
              onChange={e => setForm(f => ({ ...f, send_invite: e.target.checked }))}
              className="rounded border-slate-300"
            />
            Send email invitation
          </label>

          <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600">
            <p className="font-medium mb-1">Role Permissions:</p>
            <ul className="space-y-1">
              <li><b>Architect:</b> Full access to all firm projects</li>
              <li><b>Engineer:</b> Access only to assigned projects</li>
              <li><b>Client:</b> View only their own project(s)</li>
            </ul>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit">
              <UserPlus className="w-4 h-4" /> Send Invite
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

// Edit User Modal
function EditUserModal({ open, onClose, userId }: { open: boolean; onClose: () => void; userId: string }) {
  const store = useStore();
  const profile = store.profiles.find(p => p.id === userId);
  
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',

  });

  // Update form when profile changes
  useState(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone || '',

      });
    }
  });

  if (!profile) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    store.updateProfile(userId, {
      full_name: form.full_name,
      email: form.email,
      phone: form.phone || undefined,
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit User" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg mb-4">
          <Avatar name={profile.full_name} size="lg" />
          <div>
            <div className="font-semibold text-slate-900">{profile.full_name}</div>
            <Badge variant={roleBadgeVariants[profile.role]} size="sm">
              {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
            </Badge>
          </div>
        </div>

        <Input
          label="Full Name"
          required
          value={form.full_name}
          onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
        />
        <Input
          label="Email"
          type="email"
          required
          value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
        />
        <Input
          label="Phone Number"
          value={form.phone}
          onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
        />


        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit">
            <Check className="w-4 h-4" /> Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// Assign Projects Modal
function AssignProjectsModal({ open, onClose, userId, firmId }: { 
  open: boolean; 
  onClose: () => void; 
  userId: string;
  firmId: string;
}) {
  const store = useStore();
  const data = store.forFirm(firmId);
  const profile = data.profiles.find(p => p.id === userId);
  const allProjects = data.projects;
  
  const currentAssignments = data.assignments
    .filter(a => a.user_id === userId)
    .map(a => a.project_id);

  const [selected, setSelected] = useState<string[]>(currentAssignments);

  if (!profile) return null;

  const toggleProject = (projectId: string) => {
    setSelected(prev => 
      prev.includes(projectId) 
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  const handleSave = () => {
    // Replace assignments (write-through to Supabase)
    store.removeUserAssignments(firmId, userId);
    selected.forEach(projectId => {
      store.addAssignment({ firm_id: firmId, project_id: projectId, user_id: userId, role: 'engineer' });
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Manage Project Assignments" size="md">
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
          <Avatar name={profile.full_name} size="md" />
          <div>
            <div className="font-semibold text-slate-900">{profile.full_name}</div>
            <div className="text-xs text-slate-500">Site Engineer</div>
          </div>
        </div>

        <p className="text-sm text-slate-600">
          Select projects to assign to this engineer. They will only be able to access assigned projects.
        </p>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {allProjects.map(project => {
            const isSelected = selected.includes(project.id);
            return (
              <button
                key={project.id}
                onClick={() => toggleProject(project.id)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left',
                  isSelected 
                    ? 'border-indigo-500 bg-indigo-50' 
                    : 'border-slate-200 hover:border-slate-300'
                )}
              >
                <div className={cn(
                  'w-5 h-5 rounded border-2 flex items-center justify-center',
                  isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'
                )}>
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm text-slate-900">{project.name}</div>
                  <div className="text-xs text-slate-500">{project.status.replace('_', ' ')}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex justify-between items-center pt-2">
          <span className="text-sm text-slate-500">
            {selected.length} project{selected.length !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave}>
              <Check className="w-4 h-4" /> Save Assignments
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
