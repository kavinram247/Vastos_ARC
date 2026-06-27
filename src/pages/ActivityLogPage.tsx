import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../hooks/useStore';
import { Card, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Avatar } from '../components/ui/Avatar';
import { formatDate, formatDateTime } from '../utils/format';
import type { ActivityLog, AuditModule, AuditAction } from '../types';
import {
  Activity, Search, Filter, Download, ChevronLeft, ChevronRight,
  ArrowUpDown, Eye, Clock, User, FileText, Milestone, IndianRupee,
  Camera, MessageSquare, Truck, FolderOpen, Users, Cpu,
} from 'lucide-react';
import { cn } from '../utils/cn';

const moduleConfig: Record<AuditModule, { label: string; icon: React.ReactNode; color: string }> = {
  project: { label: 'Project', icon: <FolderOpen className="w-3.5 h-3.5" />, color: 'text-indigo-600 bg-indigo-50' },
  lead: { label: 'Lead', icon: <Users className="w-3.5 h-3.5" />, color: 'text-purple-600 bg-purple-50' },
  milestone: { label: 'Milestone', icon: <Milestone className="w-3.5 h-3.5" />, color: 'text-amber-600 bg-amber-50' },
  payment: { label: 'Payment', icon: <IndianRupee className="w-3.5 h-3.5" />, color: 'text-emerald-600 bg-emerald-50' },
  cost: { label: 'Cost', icon: <IndianRupee className="w-3.5 h-3.5" />, color: 'text-orange-600 bg-orange-50' },
  site_update: { label: 'Site Update', icon: <Camera className="w-3.5 h-3.5" />, color: 'text-teal-600 bg-teal-50' },
  comment: { label: 'Comment', icon: <MessageSquare className="w-3.5 h-3.5" />, color: 'text-sky-600 bg-sky-50' },
  document: { label: 'Document', icon: <FileText className="w-3.5 h-3.5" />, color: 'text-rose-600 bg-rose-50' },
  vendor: { label: 'Vendor', icon: <Truck className="w-3.5 h-3.5" />, color: 'text-yellow-700 bg-yellow-50' },
  user: { label: 'User', icon: <User className="w-3.5 h-3.5" />, color: 'text-slate-600 bg-slate-50' },
  system: { label: 'System', icon: <Cpu className="w-3.5 h-3.5" />, color: 'text-gray-500 bg-gray-50' },
};

const actionConfig: Record<AuditAction, { label: string; color: string }> = {
  created: { label: 'Created', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  updated: { label: 'Updated', color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  deleted: { label: 'Deleted', color: 'text-red-700 bg-red-50 border-red-200' },
  status_changed: { label: 'Status Changed', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  assigned: { label: 'Assigned', color: 'text-purple-700 bg-purple-50 border-purple-200' },
  commented: { label: 'Commented', color: 'text-sky-700 bg-sky-50 border-sky-200' },
  approved: { label: 'Approved', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  uploaded: { label: 'Uploaded', color: 'text-teal-700 bg-teal-50 border-teal-200' },
  payment_received: { label: 'Payment', color: 'text-green-700 bg-green-50 border-green-200' },
  exported: { label: 'Exported', color: 'text-slate-700 bg-slate-50 border-slate-200' },
  login: { label: 'Login', color: 'text-gray-600 bg-gray-50 border-gray-200' },
  other: { label: 'Other', color: 'text-slate-600 bg-slate-50 border-slate-200' },
};

const PAGE_SIZE_OPTIONS = [15, 30, 50, 100];

type SortField = 'created_at' | 'action' | 'module' | 'user';
type SortDir = 'asc' | 'desc';

export function ActivityLogPage() {
  const { user, firm } = useAuth();
  const store = useStore();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Sort
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Detail
  const [selectedLog, setSelectedLog] = useState<string | null>(null);

  if (!user || !firm) return null;

  const data = store.forFirm(firm.id);
  const allLogs = data.activityLog;
  const profiles = data.profiles;

  const getProfile = (id: string) => profiles.find(p => p.id === id);

  // Filter + search
  const filtered = useMemo(() => {
    let result = [...allLogs];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l =>
        l.action_label.toLowerCase().includes(q) ||
        l.details?.toLowerCase().includes(q) ||
        l.entity_name?.toLowerCase().includes(q) ||
        l.previous_value?.toLowerCase().includes(q) ||
        l.updated_value?.toLowerCase().includes(q) ||
        l.remarks?.toLowerCase().includes(q) ||
        getProfile(l.user_id)?.full_name.toLowerCase().includes(q)
      );
    }
    if (moduleFilter !== 'all') result = result.filter(l => l.module === moduleFilter);
    if (actionFilter !== 'all') result = result.filter(l => l.action === actionFilter);
    if (userFilter !== 'all') result = result.filter(l => l.user_id === userFilter);
    if (dateFrom) result = result.filter(l => l.created_at >= dateFrom);
    if (dateTo) result = result.filter(l => l.created_at <= dateTo + 'T23:59:59Z');

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'created_at': cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break;
        case 'action': cmp = a.action_label.localeCompare(b.action_label); break;
        case 'module': cmp = a.module.localeCompare(b.module); break;
        case 'user': cmp = (getProfile(a.user_id)?.full_name || '').localeCompare(getProfile(b.user_id)?.full_name || ''); break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [allLogs, searchQuery, moduleFilter, actionFilter, userFilter, dateFrom, dateTo, sortField, sortDir]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  // Stats
  const stats = {
    total: allLogs.length,
    today: allLogs.filter(l => l.created_at.startsWith(new Date().toISOString().split('T')[0])).length,
    modules: new Set(allLogs.map(l => l.module)).size,
    users: new Set(allLogs.map(l => l.user_id)).size,
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
    setPage(1);
  };

  const clearFilters = () => {
    setSearchQuery(''); setModuleFilter('all'); setActionFilter('all');
    setUserFilter('all'); setDateFrom(''); setDateTo('');
    setPage(1);
  };

  const hasActiveFilters = moduleFilter !== 'all' || actionFilter !== 'all' || userFilter !== 'all' || dateFrom || dateTo || searchQuery;

  // ─── EXPORT TO CSV ───
  const exportCSV = () => {
    const headers = ['Date & Time', 'User', 'Action', 'Module', 'Entity', 'Details', 'Previous Value', 'Updated Value', 'Remarks'];
    const rows = filtered.map(log => {
      const actor = getProfile(log.user_id);
      return [
        formatDateTime(log.created_at),
        actor?.full_name || 'System',
        log.action_label,
        moduleConfig[log.module]?.label || log.module,
        log.entity_name || '',
        log.details || '',
        log.previous_value || '',
        log.updated_value || '',
        log.remarks || '',
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-trail-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    store.addActivityLog({
      firm_id: firm.id, user_id: user.id,
      action: 'exported', action_label: 'Audit Trail Exported', module: 'system',
      entity_type: 'system', entity_id: 'export',
      details: `Exported ${filtered.length} audit records to CSV`,
    });
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <ArrowUpDown className={cn('w-3 h-3 ml-1 inline', sortField === field ? 'text-indigo-600' : 'text-slate-300')} />
  );

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-[28px] font-semibold leading-tight text-slate-900">
            <Activity className="h-5 w-5 text-indigo-600" />
            Activity Log & Audit Trail
          </h1>
          <p className="text-slate-500 text-sm mt-1">Complete visibility and traceability across all modules</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="w-4 h-4" /> Filters {hasActiveFilters && <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />}
          </Button>
          <Button size="sm" variant="secondary" onClick={exportCSV}>
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="metric-strip">
        <div className="metric-cell"><div className="metric-label">Total entries</div><div className="metric-value">{stats.total}</div></div>
        <div className="metric-cell"><div className="metric-label">Today</div><div className="metric-value text-indigo-700">{stats.today}</div></div>
        <div className="metric-cell"><div className="metric-label">Modules</div><div className="metric-value">{stats.modules}</div></div>
        <div className="metric-cell"><div className="metric-label">Active users</div><div className="metric-value text-emerald-700">{stats.users}</div></div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text" placeholder="Search by action, details, entity name, user..."
          value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <Card className="bg-slate-50/50">
          <div className="flex items-center justify-between mb-3">
            <CardTitle className="text-sm">Advanced Filters</CardTitle>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Clear All</button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">User</label>
              <select value={userFilter} onChange={e => { setUserFilter(e.target.value); setPage(1); }}
                className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                <option value="all">All Users</option>
                {profiles.filter(p => p.role !== 'client').map(p => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Module</label>
              <select value={moduleFilter} onChange={e => { setModuleFilter(e.target.value); setPage(1); }}
                className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                <option value="all">All Modules</option>
                {Object.entries(moduleConfig).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Action Type</label>
              <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1); }}
                className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                <option value="all">All Actions</option>
                {Object.entries(actionConfig).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date From</label>
              <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date To</label>
              <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
                className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
          </div>
        </Card>
      )}

      {/* Results bar */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{filtered.length} record{filtered.length !== 1 ? 's' : ''}{hasActiveFilters ? ' (filtered)' : ''}</span>
        <div className="flex items-center gap-2">
          <span>Show:</span>
          <select value={pageSize} onChange={e => { setPageSize(+e.target.value); setPage(1); }}
            className="border border-slate-300 rounded px-1.5 py-0.5 text-xs">
            {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left">
                <th className="px-4 py-3 font-medium text-slate-500 cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('created_at')}>
                  <Clock className="w-3 h-3 inline mr-1" />Date & Time <SortIcon field="created_at" />
                </th>
                <th className="px-4 py-3 font-medium text-slate-500 cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('user')}>
                  User <SortIcon field="user" />
                </th>
                <th className="px-4 py-3 font-medium text-slate-500 cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('action')}>
                  Action <SortIcon field="action" />
                </th>
                <th className="px-4 py-3 font-medium text-slate-500 cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('module')}>
                  Module <SortIcon field="module" />
                </th>
                <th className="px-4 py-3 font-medium text-slate-500 whitespace-nowrap">Entity</th>
                <th className="px-4 py-3 font-medium text-slate-500 whitespace-nowrap">Changes</th>
                <th className="px-4 py-3 font-medium text-slate-500 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {paged.map(log => {
                const actor = getProfile(log.user_id);
                const mc = moduleConfig[log.module];
                const ac = actionConfig[log.action];
                return (
                  <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-xs text-slate-700">{formatDate(log.created_at)}</div>
                      <div className="text-[10px] text-slate-400">{new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={actor?.full_name || 'System'} size="sm" />
                        <div>
                          <div className="text-xs font-medium text-slate-900">{actor?.full_name || 'System'}</div>
                          <div className="text-[10px] text-slate-400 capitalize">{actor?.role || 'system'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={cn('border text-[10px]', ac.color)}>
                        {log.action_label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium', mc.color)}>
                        {mc.icon} {mc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-slate-900 font-medium truncate max-w-[180px]">{log.entity_name || '—'}</div>
                      {log.details && <div className="text-[10px] text-slate-400 truncate max-w-[180px]">{log.details}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {(log.previous_value || log.updated_value) ? (
                        <div className="flex items-center gap-1 text-[10px]">
                          {log.previous_value && <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded line-through">{log.previous_value}</span>}
                          {log.previous_value && log.updated_value && <span className="text-slate-300">→</span>}
                          {log.updated_value && <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded font-medium">{log.updated_value}</span>}
                        </div>
                      ) : <span className="text-[10px] text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setSelectedLog(log.id)} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {paged.length === 0 && (
          <div className="text-center py-12">
            <Activity className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">{hasActiveFilters ? 'No records match your filters.' : 'No activity logged yet.'}</p>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 7) { pageNum = i + 1; }
              else if (page <= 4) { pageNum = i + 1; }
              else if (page >= totalPages - 3) { pageNum = totalPages - 6 + i; }
              else { pageNum = page - 3 + i; }
              return (
                <button key={pageNum} onClick={() => setPage(pageNum)}
                  className={cn('w-8 h-8 rounded-lg text-xs font-medium transition-colors',
                    page === pageNum ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100 text-slate-600')}>
                  {pageNum}
                </button>
              );
            })}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <LogDetailModal
        open={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        log={selectedLog ? filtered.find(l => l.id === selectedLog) || null : null}
        getProfile={getProfile}
      />
    </div>
  );
}

// ─── LOG DETAIL MODAL ───
function LogDetailModal({ open, onClose, log, getProfile }: {
  open: boolean; onClose: () => void;
  log: ActivityLog | null;
  getProfile: (id: string) => { full_name: string; role: string; email: string } | undefined;
}) {
  if (!log) return null;
  const actor = getProfile(log.user_id);
  const mc = moduleConfig[log.module];
  const ac = actionConfig[log.action];

  return (
    <Modal open={open} onClose={onClose} title="Audit Log Detail" size="md">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
          <Avatar name={actor?.full_name || 'System'} size="lg" />
          <div>
            <div className="font-semibold text-slate-900">{actor?.full_name || 'System'}</div>
            <div className="text-xs text-slate-500 capitalize">{actor?.role || 'system'} · {actor?.email || ''}</div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {formatDateTime(log.created_at)}
            </div>
          </div>
        </div>

        {/* Action + Module */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Action</label>
            <Badge className={cn('border', ac.color)}>{log.action_label}</Badge>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Module</label>
            <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', mc.color)}>
              {mc.icon} {mc.label}
            </span>
          </div>
        </div>

        {/* Entity */}
        {log.entity_name && (
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Entity</label>
            <p className="text-sm text-slate-900 font-medium">{log.entity_name}</p>
          </div>
        )}

        {/* Details */}
        {log.details && (
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Details</label>
            <p className="text-sm text-slate-700">{log.details}</p>
          </div>
        )}

        {/* Changes */}
        {(log.previous_value || log.updated_value) && (
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Value Change</label>
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              {log.previous_value && (
                <div className="flex-1">
                  <div className="text-[10px] text-slate-400 mb-0.5">Previous</div>
                  <div className="text-sm text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200 line-through">{log.previous_value}</div>
                </div>
              )}
              {log.previous_value && log.updated_value && (
                <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />
              )}
              {log.updated_value && (
                <div className="flex-1">
                  <div className="text-[10px] text-slate-400 mb-0.5">Updated</div>
                  <div className="text-sm text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 font-semibold">{log.updated_value}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Remarks */}
        {log.remarks && (
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Remarks</label>
            <p className="text-sm text-slate-600 italic bg-amber-50 p-2 rounded-lg border border-amber-100">{log.remarks}</p>
          </div>
        )}

        {/* Meta */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200 text-xs text-slate-500">
          <div>
            <span className="text-slate-400">Entry ID:</span>{' '}
            <span className="font-mono text-[10px]">{log.id.slice(0, 8)}...</span>
          </div>
          <div>
            <span className="text-slate-400">Entity ID:</span>{' '}
            <span className="font-mono text-[10px]">{log.entity_id}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
