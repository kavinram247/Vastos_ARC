import { useAuth } from '../context/AuthContext';
import { useStore } from '../hooks/useStore';
import { Card, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import {
  Shield, Palette, HardHat, User, Mail, Phone,
} from 'lucide-react';

const roleIcons = {
  owner: Shield,
  architect: Palette,
  engineer: HardHat,
  client: User,
};

const roleBadges: Record<string, 'info' | 'success' | 'warning' | 'default'> = {
  owner: 'info',
  architect: 'success',
  engineer: 'warning',
  client: 'default',
};

export function TeamPage() {
  const { user, firm } = useAuth();
  const store = useStore();

  if (!user || !firm) return null;

  const data = store.forFirm(firm.id);
  const internal = data.profiles.filter(p => p.role !== 'client');
  const clients = data.profiles.filter(p => p.role === 'client');

  const getAssignments = (userId: string) =>
    data.assignments.filter(a => a.user_id === userId).map(a => {
      const project = data.projects.find(p => p.id === a.project_id);
      return project?.name || '';
    }).filter(Boolean);

  const getClientProjects = (clientId: string) =>
    data.projects.filter(p => p.client_id === clientId).map(p => p.name);

  const renderMember = (profile: typeof data.profiles[0]) => {
    const Icon = roleIcons[profile.role];
    const projectNames = profile.role === 'client'
      ? getClientProjects(profile.id)
      : getAssignments(profile.id);

    return (
      <Card key={profile.id} className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Avatar name={profile.full_name} size="lg" />
          <div>
            <div className="font-semibold text-slate-900">{profile.full_name}</div>
            <Badge variant={roleBadges[profile.role]} size="sm" className="mt-1">
              <Icon className="w-3 h-3 mr-1" />
              {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
            </Badge>
          </div>
        </div>
        <div className="flex-1 space-y-1 text-sm">
          <div className="flex items-center gap-2 text-slate-600">
            <Mail className="w-3.5 h-3.5 text-slate-400" />
            {profile.email}
          </div>
          {profile.phone && (
            <div className="flex items-center gap-2 text-slate-600">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              {profile.phone}
            </div>
          )}
          {projectNames.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {projectNames.map(name => (
                <span key={name} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Team</h1>
        <p className="text-slate-500 text-sm mt-1">{firm.name} — {data.profiles.length} members</p>
      </div>

      <div>
        <CardTitle className="mb-3">Internal Team ({internal.length})</CardTitle>
        <div className="space-y-3">
          {internal.map(renderMember)}
        </div>
      </div>

      <div>
        <CardTitle className="mb-3">Clients ({clients.length})</CardTitle>
        <div className="space-y-3">
          {clients.map(renderMember)}
        </div>
      </div>
    </div>
  );
}
