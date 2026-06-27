import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../hooks/useStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input, Textarea } from '../components/ui/Input';
import { Avatar } from '../components/ui/Avatar';
import { ProjectSubPageHeader } from '../components/ProjectSubPageHeader';
import { formatDate, formatDateTime } from '../utils/format';
import type { Page } from '../types';
import {
  Camera, Image, Calendar, X,
} from 'lucide-react';

interface Props {
  projectId: string;
  onNavigate: (page: Page, projectId?: string) => void;
}

const demoPhotos = [
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800',
  'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=800',
  'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800',
  'https://images.unsplash.com/photo-1590274853856-f22d5ee3d228?w=800',
  'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800',
];

export function SiteUpdatesPage({ projectId, onNavigate }: Props) {
  const { user, firm } = useAuth();
  const store = useStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  if (!user || !firm) return null;

  const data = store.forFirm(firm.id);
  const myProjects = store.getProjectsForUser(user.id, firm.id, user.role);
  const selectedProject = projectId;

  const updates = data.siteUpdates
    .filter(u => u.project_id === selectedProject)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const getProfile = (id: string) => data.profiles.find(p => p.id === id);
  const getProject = (id: string) => myProjects.find(p => p.id === id) || data.projects.find(p => p.id === id);

  return (
    <div className="space-y-6">
      <ProjectSubPageHeader projectId={projectId} title="Site Updates" subtitle="Photo-first progress updates" onNavigate={onNavigate}>
        {(user.role === 'engineer' || user.role === 'owner') && (
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            <Camera className="w-4 h-4" /> Post Update
          </Button>
        )}
      </ProjectSubPageHeader>

      {/* Updates Feed */}
      <div className="space-y-4">
        {updates.map(update => {
          const author = getProfile(update.posted_by);
          const project = getProject(update.project_id);

          return (
            <Card key={update.id}>
              {/* Header */}
              <div className="flex items-center gap-3 mb-3">
                <Avatar name={author?.full_name || 'Unknown'} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-slate-900">{author?.full_name || 'Unknown'}</div>
                  <div className="text-xs text-slate-500">
                    {project?.name} · <Calendar className="w-3 h-3 inline" /> {formatDate(update.date)}
                  </div>
                </div>
                <div className="text-xs text-slate-400">{formatDateTime(update.created_at)}</div>
              </div>

              {/* Note */}
              <p className="text-sm text-slate-700 mb-3">{update.note}</p>

              {/* Photos */}
              {update.photo_urls.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {update.photo_urls.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setLightboxImg(url)}
                      className="relative aspect-[4/3] overflow-hidden rounded-lg group"
                    >
                      <img
                        src={url}
                        alt={`Site photo ${i + 1}`}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    </button>
                  ))}
                </div>
              )}


            </Card>
          );
        })}
      </div>

      {updates.length === 0 && (
        <div className="text-center py-12">
          <Image className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No site updates yet.</p>
        </div>
      )}

      {/* Lightbox */}
      {lightboxImg && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4" onClick={() => setLightboxImg(null)}>
          <button className="absolute top-4 right-4 p-2 text-white hover:bg-white/20 rounded-lg">
            <X className="w-6 h-6" />
          </button>
          <img src={lightboxImg} alt="Full size" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}

      {/* Post Update Modal */}
      <PostUpdateModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        firmId={firm.id}
        projectId={selectedProject}
        userId={user.id}
        projects={myProjects}
      />
    </div>
  );
}

function PostUpdateModal({
  open, onClose, firmId, projectId, userId, projects,
}: {
  open: boolean;
  onClose: () => void;
  firmId: string;
  projectId: string;
  userId: string;
  projects: { id: string; name: string }[];
}) {
  const store = useStore();
  const [form, setForm] = useState({
    project_id: projectId || projects[0]?.id || '',
    note: '',
    date: new Date().toISOString().split('T')[0],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.project_id || !form.note.trim()) return;

    // Use random demo photos
    const photoCount = Math.floor(Math.random() * 3) + 1;
    const shuffled = [...demoPhotos].sort(() => Math.random() - 0.5);
    const photos = shuffled.slice(0, photoCount);

    store.addSiteUpdate({
      firm_id: firmId,
      project_id: form.project_id,
      posted_by: userId,
      date: form.date,
      note: form.note.trim(),
      photo_urls: photos,
    });

    store.addActivityLog({
      firm_id: firmId,
      user_id: userId,
      action: 'uploaded',
      action_label: 'Site Update Posted',
      module: 'site_update',
      entity_type: 'site_update',
      entity_id: form.project_id,
      details: `Posted site update with ${photos.length} photo${photos.length !== 1 ? 's' : ''}`,
    });

    setForm({ project_id: projectId || projects[0]?.id || '', note: '', date: new Date().toISOString().split('T')[0] });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Post Site Update" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <select
          value={form.project_id}
          onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <Input label="Date" type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        <Textarea label="Update Note" required value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Describe today's progress..." rows={4} />
        <div className="bg-slate-50 border border-dashed border-slate-300 rounded-lg p-6 text-center">
          <Camera className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Photos will be auto-attached (demo mode)</p>
          <p className="text-xs text-slate-400 mt-1">In production, tap to capture or upload site photos</p>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit">
            <Camera className="w-4 h-4" /> Post Update
          </Button>
        </div>
      </form>
    </Modal>
  );
}
