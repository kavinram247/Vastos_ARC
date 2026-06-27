import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../hooks/useStore';
import { ProjectSubPageHeader } from '../components/ProjectSubPageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input, Select, Textarea } from '../components/ui/Input';
import { formatDate } from '../utils/format';
import type { Page } from '../types';
import type { ProjectDocument } from '../types';
import {
  FileText, Upload, Search, Download, Trash2,
  File, Image, FileSpreadsheet, Paperclip, FolderOpen,
  Lock, Unlock,
} from 'lucide-react';
import { cn } from '../utils/cn';

interface Props {
  projectId: string;
  onNavigate: (page: Page, projectId?: string) => void;
}

const categoryConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  drawing: { label: 'Drawing', icon: <File className="w-4 h-4" />, color: 'text-blue-600 bg-blue-50' },
  contract: { label: 'Contract', icon: <FileText className="w-4 h-4" />, color: 'text-purple-600 bg-purple-50' },
  invoice: { label: 'Invoice', icon: <FileText className="w-4 h-4" />, color: 'text-emerald-600 bg-emerald-50' },
  permit: { label: 'Permit', icon: <FileText className="w-4 h-4" />, color: 'text-amber-600 bg-amber-50' },
  report: { label: 'Report', icon: <FileSpreadsheet className="w-4 h-4" />, color: 'text-indigo-600 bg-indigo-50' },
  photo: { label: 'Photo', icon: <Image className="w-4 h-4" />, color: 'text-pink-600 bg-pink-50' },
  other: { label: 'Other', icon: <Paperclip className="w-4 h-4" />, color: 'text-slate-600 bg-slate-50' },
};

const fileTypeIcons: Record<string, React.ReactNode> = {
  pdf: <File className="w-5 h-5 text-red-500" />,
  image: <Image className="w-5 h-5 text-blue-500" />,
  drawing: <File className="w-5 h-5 text-orange-500" />,
  spreadsheet: <FileSpreadsheet className="w-5 h-5 text-green-500" />,
  other: <Paperclip className="w-5 h-5 text-slate-400" />,
};

function formatFileSize(kb: number): string {
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function DocumentsPage({ projectId, onNavigate }: Props) {
  const { user, firm } = useAuth();
  const store = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  if (!user || !firm) return null;

  const data = store.forFirm(firm.id);
  const selectedProject = projectId;
  const isClient = user.role === 'client';

  const documents = data.projectDocuments
    .filter(d => d.project_id === selectedProject)
    .filter(d => isClient ? d.visible_to_client : true)
    .filter(d => {
      if (categoryFilter !== 'all' && d.category !== categoryFilter) return false;
      if (searchQuery) return d.name.toLowerCase().includes(searchQuery.toLowerCase());
      return true;
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const getUploader = (id: string) => data.profiles.find(p => p.id === id);

  // Group by category
  const grouped = documents.reduce<Record<string, ProjectDocument[]>>((acc, doc) => {
    const cat = doc.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(doc);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <ProjectSubPageHeader projectId={projectId} title="Documents" subtitle={isClient ? 'Documents shared with you' : 'Upload and manage files'} onNavigate={onNavigate}>
        {!isClient && (
          <Button onClick={() => setShowUploadModal(true)}>
            <Upload className="w-4 h-4" /> Upload
          </Button>
        )}
      </ProjectSubPageHeader>

      {/* Stats */}
      <div className="metric-strip">
        <div className="metric-cell"><div className="metric-label">Total documents</div><div className="metric-value">{documents.length}</div></div>
        <div className="metric-cell"><div className="metric-label">Drawings</div><div className="metric-value text-sky-700">{documents.filter(d => d.category === 'drawing').length}</div></div>
        <div className="metric-cell"><div className="metric-label">Client visible</div><div className="metric-value text-emerald-700">{documents.filter(d => d.visible_to_client).length}</div></div>
        <div className="metric-cell"><div className="metric-label">Total size</div><div className="metric-value text-indigo-700">{formatFileSize(documents.reduce((s, d) => s + d.file_size, 0))}</div></div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Categories</option>
          {Object.entries(categoryConfig).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
      </div>

      {/* Documents grouped by category */}
      <div className="space-y-6">
        {Object.entries(categoryConfig).map(([catKey, catCfg]) => {
          const catDocs = grouped[catKey];
          if (!catDocs || catDocs.length === 0) return null;

          return (
            <div key={catKey}>
              <div className="flex items-center gap-2 mb-3">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', catCfg.color)}>
                  {catCfg.icon}
                </div>
                <h2 className="font-semibold text-slate-900">{catCfg.label}</h2>
                <span className="text-xs text-slate-400">{catDocs.length} file{catDocs.length !== 1 ? 's' : ''}</span>
              </div>

              <div className="grid gap-2">
                {catDocs.map(doc => {
                  const uploader = getUploader(doc.uploaded_by);
                  return (
                    <Card key={doc.id} className="flex items-center gap-4 hover:shadow-sm transition-shadow">
                      <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center shrink-0">
                        {fileTypeIcons[doc.file_type] || fileTypeIcons.other}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-slate-900 truncate">{doc.name}</span>
                          {doc.version && (
                            <Badge variant="outline" size="sm">v{doc.version}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                          <span>{formatFileSize(doc.file_size)}</span>
                          <span>•</span>
                          <span>{uploader?.full_name}</span>
                          <span>•</span>
                          <span>{formatDate(doc.created_at)}</span>
                        </div>
                        {doc.description && (
                          <p className="text-xs text-slate-400 mt-1 truncate">{doc.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isClient ? (
                          // Client view: download/view
                          <Button size="sm" variant="secondary">
                            <Download className="w-3 h-3" /> View
                          </Button>
                        ) : (
                          <>
                            {/* Client visibility toggle */}
                            <button
                              onClick={() => store.toggleDocumentClientVisibility(doc.id)}
                              className={cn(
                                'p-2 rounded-lg transition-colors',
                                doc.visible_to_client
                                  ? 'text-emerald-600 hover:bg-emerald-50'
                                  : 'text-slate-400 hover:bg-slate-100'
                              )}
                              title={doc.visible_to_client ? 'Visible to client — click to hide' : 'Hidden from client — click to show'}
                            >
                              {doc.visible_to_client ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                            </button>
                            <Button size="sm" variant="secondary">
                              <Download className="w-3 h-3" />
                            </Button>
                            <button
                              onClick={() => setShowDeleteConfirm(doc.id)}
                              className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {documents.length === 0 && (
        <div className="text-center py-12">
          <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No documents found.</p>
        </div>
      )}

      {/* Upload Modal */}
      <UploadDocumentModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        firmId={firm.id}
        projectId={selectedProject}
        userId={user.id}
      />

      {/* Delete Confirm */}
      <Modal open={!!showDeleteConfirm} onClose={() => setShowDeleteConfirm(null)} title="Delete Document" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Are you sure you want to delete this document? This cannot be undone.</p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowDeleteConfirm(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => { if (showDeleteConfirm) store.deleteProjectDocument(showDeleteConfirm); setShowDeleteConfirm(null); }}>
              <Trash2 className="w-4 h-4" /> Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function UploadDocumentModal({ open, onClose, firmId, projectId, userId }: {
  open: boolean; onClose: () => void; firmId: string; projectId: string; userId: string;
}) {
  const store = useStore();
  const [form, setForm] = useState({
    name: '',
    file_type: 'pdf' as ProjectDocument['file_type'],
    category: 'drawing' as ProjectDocument['category'],
    description: '',
    visible_to_client: true,
  });
  const [uploading, setUploading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;

    setUploading(true);
    // Simulate upload delay
    setTimeout(() => {
      store.addProjectDocument({
        firm_id: firmId,
        project_id: projectId,
        name: form.name,
        file_type: form.file_type,
        file_url: '#',
        file_size: Math.floor(Math.random() * 5000) + 200,
        category: form.category,
        uploaded_by: userId,
        visible_to_client: form.visible_to_client,
        description: form.description || undefined,
      });
      setUploading(false);
      setForm({ name: '', file_type: 'pdf', category: 'drawing', description: '', visible_to_client: true });
      onClose();
    }, 800);
  };

  return (
    <Modal open={open} onClose={onClose} title="Upload Document" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* File drop area */}
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-indigo-400 transition-colors cursor-pointer">
          <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <p className="text-sm text-slate-600 font-medium">Click to browse or drag & drop files here</p>
          <p className="text-xs text-slate-400 mt-1">PDF, DWG, JPG, PNG, XLSX — Max 25 MB</p>
        </div>

        <Input label="Document Name *" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g., Floor Plan - Ground Floor v4.pdf" />
        
        <div className="grid grid-cols-2 gap-4">
          <Select label="File Type" value={form.file_type} onChange={e => setForm(f => ({ ...f, file_type: e.target.value as ProjectDocument['file_type'] }))} options={[
            { value: 'pdf', label: '📄 PDF' },
            { value: 'image', label: '🖼️ Image' },
            { value: 'drawing', label: '📐 Drawing (DWG/DXF)' },
            { value: 'spreadsheet', label: '📊 Spreadsheet' },
            { value: 'other', label: '📎 Other' },
          ]} />
          <Select label="Category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as ProjectDocument['category'] }))} options={[
            { value: 'drawing', label: '📐 Drawing' },
            { value: 'contract', label: '📜 Contract' },
            { value: 'invoice', label: '🧾 Invoice' },
            { value: 'permit', label: '📋 Permit' },
            { value: 'report', label: '📊 Report' },
            { value: 'photo', label: '📸 Photo' },
            { value: 'other', label: '📎 Other' },
          ]} />
        </div>

        <Textarea label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description of this document..." rows={2} />

        <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer">
          <input
            type="checkbox"
            checked={form.visible_to_client}
            onChange={e => setForm(f => ({ ...f, visible_to_client: e.target.checked }))}
            className="rounded border-slate-300"
          />
          <div>
            <div className="text-sm font-medium text-slate-700 flex items-center gap-1">
              {form.visible_to_client ? <Unlock className="w-3.5 h-3.5 text-emerald-500" /> : <Lock className="w-3.5 h-3.5 text-slate-400" />}
              Visible to client
            </div>
            <div className="text-xs text-slate-500">Client will be able to view and download this document</div>
          </div>
        </label>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose} disabled={uploading}>Cancel</Button>
          <Button type="submit" disabled={uploading}>
            {uploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Uploading...
              </>
            ) : (
              <><Upload className="w-4 h-4" /> Upload</>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
