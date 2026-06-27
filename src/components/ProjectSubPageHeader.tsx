import { useStore } from '../hooks/useStore';
import { useAuth } from '../context/AuthContext';
import { Badge } from './ui/Badge';
import { getStatusColor, statusLabel } from '../utils/format';
import type { Page } from '../types';
import { ArrowLeft, ChevronRight } from 'lucide-react';

interface Props {
  projectId: string;
  title: string;
  subtitle?: string;
  onNavigate: (page: Page, projectId?: string) => void;
  children?: React.ReactNode;
}

export function ProjectSubPageHeader({ projectId, title, subtitle, onNavigate, children }: Props) {
  const { firm } = useAuth();
  const store = useStore();

  const data = store.forFirm(firm?.id || '');
  const project = data.projects.find(p => p.id === projectId);

  return (
    <div className="space-y-4 border-b border-slate-200 pb-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs">
        <button
          onClick={() => onNavigate('projects')}
          className="text-slate-500 hover:text-indigo-700"
        >
          Projects
        </button>
        <ChevronRight className="w-3 h-3 text-slate-300" />
        <button
          onClick={() => onNavigate('project-detail', projectId)}
          className="max-w-[220px] truncate text-slate-500 hover:text-indigo-700"
        >
          {project?.name || 'Project'}
        </button>
        <ChevronRight className="w-3 h-3 text-slate-300" />
        <span className="font-semibold text-slate-700">{title}</span>
      </div>

      {/* Title row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <button
            aria-label={`Back to ${project?.name || 'project'}`}
            onClick={() => onNavigate('project-detail', projectId)}
            className="-ml-2 mt-0.5 rounded-lg p-2 text-slate-500 hover:bg-white hover:text-slate-900 hover:shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-[28px] font-semibold leading-tight text-slate-900">{title}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span>{project?.name}</span>
              {project && (
                <Badge variant={getStatusColor(project.status)} size="sm">
                  {statusLabel(project.status)}
                </Badge>
              )}
              {subtitle && <><span className="text-slate-300">·</span><span>{subtitle}</span></>}
            </div>
          </div>
        </div>
        {children && <div className="flex items-center gap-3">{children}</div>}
      </div>
    </div>
  );
}
