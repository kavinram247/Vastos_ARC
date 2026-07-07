// ─────────────────────────────────────────────────────────────
// The customizable Leads dashboard. Owns the active layout, edit mode, theme,
// and the layout manager; renders the widget grid. Layouts persist per-user to
// crm_dashboard_layouts (via the store) so the board reappears exactly as left.
// Everything the user changes is DATA on the layout's config — no code changes.
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../hooks/useStore';
import { usePermissions } from '../../hooks/usePermissions';
import { Button } from '../../components/ui/Button';
import { cn } from '../../utils/cn';
import {
  LayoutDashboard, Plus, Copy, Trash2, Pencil, Star, Palette, Wrench, Check,
  RotateCcw, ChevronDown, Users, User as UserIcon, Send,
} from 'lucide-react';
import type { DashboardLayout, DashboardWidget, DashboardTheme, WidgetType, KpiMetric } from './types';
import { defaultConfig, DEFAULT_THEME, newWidgetId } from './types';
import { WIDGET_REGISTRY, addableWidgets, type WidgetRenderCtx } from './widgets';
import { DashboardGrid } from './DashboardGrid';
import { WidgetSettingsModal } from './WidgetSettingsModal';
import { ThemePanel } from './ThemePanel';

const MODULE = 'leads';

export function LeadsDashboard() {
  const { user, firm, role } = useAuth();
  const store = useStore();
  const { can } = usePermissions();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [scope, setScope] = useState<'all' | 'mine'>(can('leads', 'assign') ? 'all' : 'mine');
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [showTheme, setShowTheme] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showLayouts, setShowLayouts] = useState(false);
  const createdRef = useRef(false);

  const firmId = firm?.id || '';
  const isAdmin = !!role?.is_admin;

  // Inline filter (not useMemo): store mutations replace array *elements* in
  // place without changing the array reference, so a ref-keyed memo would go
  // stale. useStore() re-renders on every notify(), so recomputing is correct.
  const layouts = store.dashboardLayouts.filter(l => l.module === MODULE && (l.user_id === user?.id || l.scope === 'org'));
  const personal = layouts.filter(l => l.user_id === user?.id);

  // Ensure the user has at least one personal layout, and pick a sensible active one.
  useEffect(() => {
    if (!user || !firm) return;
    const mine = store.dashboardLayouts.filter(l => l.module === MODULE && l.user_id === user.id);
    if (mine.length === 0 && !createdRef.current) {
      createdRef.current = true;
      const created = store.addDashboardLayout({
        firm_id: firm.id, user_id: user.id, module: MODULE, name: 'My Dashboard',
        is_default: true, scope: 'personal', config: defaultConfig(), created_by: user.id,
      });
      setActiveId(created.id);
      return;
    }
    if (!activeId || !store.dashboardLayouts.find(l => l.id === activeId)) {
      const def = mine.find(l => l.is_default) || mine[0] || layouts[0];
      if (def) setActiveId(def.id);
    }
  }, [user?.id, firm?.id, store.dashboardLayouts.length]);

  const active = layouts.find(l => l.id === activeId) || null;
  if (!user || !firm) return null;
  if (!active) return <div className="py-16 text-center text-sm text-slate-400">Preparing your dashboard…</div>;

  const canEditActive = active.user_id === user.id;
  const config = active.config;
  const theme: DashboardTheme = { ...DEFAULT_THEME, ...config.theme };
  const ctx: WidgetRenderCtx = { firmId, userId: user.id, scope };

  // ── mutations (auto-persist to the active layout) ──
  const commit = (next: DashboardLayout['config']) => store.updateDashboardLayout(active.id, { config: next });
  const setWidgets = (fn: (w: DashboardWidget[]) => DashboardWidget[]) => commit({ ...config, widgets: fn(config.widgets) });
  const setTheme = (patch: Partial<DashboardTheme>) => commit({ ...config, theme: { ...theme, ...patch } });

  const reorder = (draggedId: string, targetId: string) => setWidgets(ws => {
    const from = ws.findIndex(w => w.id === draggedId);
    const to = ws.findIndex(w => w.id === targetId);
    if (from < 0 || to < 0) return ws;
    const next = [...ws];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  });
  const resizeW = (id: string, dir: -1 | 1) => setWidgets(ws => ws.map(w => w.id === id ? { ...w, w: Math.min(4, Math.max(1, w.w + dir)) as DashboardWidget['w'] } : w));
  const resizeH = (id: string) => setWidgets(ws => ws.map(w => w.id === id ? { ...w, h: w.h === 'sm' ? 'md' : w.h === 'md' ? 'lg' : 'sm' } : w));
  const toggleHide = (id: string) => setWidgets(ws => ws.map(w => w.id === id ? { ...w, hidden: !w.hidden } : w));
  const remove = (id: string) => setWidgets(ws => ws.filter(w => w.id !== id));
  const saveWidget = (updated: DashboardWidget) => setWidgets(ws => ws.map(w => w.id === updated.id ? updated : w));
  const addWidget = (type: WidgetType, metric?: KpiMetric) => {
    const def = WIDGET_REGISTRY[type];
    setWidgets(ws => [...ws, { id: newWidgetId(type), type, metric, w: def.defaultSize.w, h: def.defaultSize.h, chartType: def.defaultChart }]);
    setShowAdd(false);
  };

  // ── layout manager ──
  const switchTo = (id: string) => { setActiveId(id); setShowLayouts(false); setEditing(false); };
  const addLayout = () => {
    const name = prompt('Name this dashboard', 'New Dashboard');
    if (!name?.trim()) return;
    const created = store.addDashboardLayout({ firm_id: firmId, user_id: user.id, module: MODULE, name: name.trim(), is_default: false, scope: 'personal', config: defaultConfig(), created_by: user.id });
    switchTo(created.id);
  };
  const duplicate = () => {
    const created = store.addDashboardLayout({ firm_id: firmId, user_id: user.id, module: MODULE, name: `${active.name} (Copy)`, is_default: false, scope: 'personal', config: JSON.parse(JSON.stringify(config)), created_by: user.id });
    switchTo(created.id);
  };
  const rename = () => { const name = prompt('Rename dashboard', active.name); if (name?.trim() && canEditActive) store.updateDashboardLayout(active.id, { name: name.trim() }); };
  const del = () => {
    if (personal.length <= 1) { alert('Keep at least one personal dashboard.'); return; }
    if (!confirm(`Delete "${active.name}"?`)) return;
    store.deleteDashboardLayout(active.id);
    setActiveId(null);
  };
  const restoreDefaults = () => { if (confirm('Reset this dashboard to the default widgets and theme?')) commit(defaultConfig()); };
  const setDefault = () => store.setDefaultDashboardLayout(active.id, user.id, MODULE);
  const publishOrg = () => {
    store.addDashboardLayout({ firm_id: firmId, user_id: user.id, module: MODULE, name: `${active.name} (Org template)`, is_default: false, scope: 'org', config: JSON.parse(JSON.stringify(config)), created_by: user.id });
    alert('Published as an organization-wide template — everyone can now start from this layout.');
  };

  const settingsWidget = settingsId ? config.widgets.find(w => w.id === settingsId) : null;

  return (
    <div className={cn('space-y-4', theme.mode === 'dark' && 'dash-dark rounded-2xl p-4')}
      style={{
        ['--dash-primary' as any]: theme.primary,
        ['--dash-secondary' as any]: theme.secondary,
        ['--dash-widget' as any]: theme.widgetBg,
        ['--dash-border' as any]: theme.border,
        ['--dash-radius' as any]: theme.rounded ? '14px' : '4px',
        fontFamily: theme.fontFamily && theme.fontFamily !== 'inherit' ? theme.fontFamily : undefined,
      }}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Layout selector */}
        <div className="relative">
          <button onClick={() => setShowLayouts(s => !s)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:border-slate-300">
            <LayoutDashboard className="h-4 w-4 text-indigo-600" />
            {active.name}{active.is_default && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>
          {showLayouts && (
            <div className="floating-panel absolute z-30 mt-1 w-64 p-1.5">
              {layouts.map(l => (
                <button key={l.id} onClick={() => switchTo(l.id)} className={cn('flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-slate-50', l.id === active.id ? 'text-indigo-700' : 'text-slate-700')}>
                  {l.id === active.id ? <Check className="h-3.5 w-3.5" /> : <span className="w-3.5" />}
                  <span className="flex-1 truncate">{l.name}</span>
                  {l.scope === 'org' && <span className="rounded bg-slate-100 px-1.5 text-[10px] text-slate-500">Org</span>}
                  {l.is_default && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
                </button>
              ))}
              <div className="my-1 border-t border-slate-100" />
              <button onClick={addLayout} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-50"><Plus className="h-3.5 w-3.5" /> New dashboard</button>
              <button onClick={duplicate} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-50"><Copy className="h-3.5 w-3.5" /> Duplicate current</button>
            </div>
          )}
        </div>

        {/* Scope */}
        <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
          <ScopeBtn active={scope === 'all'} onClick={() => setScope('all')} icon={<Users className="h-3.5 w-3.5" />} label="All" />
          <ScopeBtn active={scope === 'mine'} onClick={() => setScope('mine')} icon={<UserIcon className="h-3.5 w-3.5" />} label="Mine" />
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {canEditActive && !active.is_default && <button onClick={setDefault} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300"><Star className="h-3.5 w-3.5" /> Set default</button>}
          <button onClick={() => setShowTheme(true)} disabled={!canEditActive} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300 disabled:opacity-40"><Palette className="h-3.5 w-3.5" /> Theme</button>
          {canEditActive ? (
            <Button size="sm" variant={editing ? 'primary' : 'secondary'} onClick={() => setEditing(e => !e)}><Wrench className="h-3.5 w-3.5" /> {editing ? 'Done' : 'Customize'}</Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={duplicate}><Copy className="h-3.5 w-3.5" /> Duplicate to edit</Button>
          )}
        </div>
      </div>

      {/* Edit-mode action row */}
      {editing && canEditActive && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/50 px-3 py-2">
          <div className="relative">
            <Button size="sm" onClick={() => setShowAdd(s => !s)}><Plus className="h-3.5 w-3.5" /> Add widget</Button>
            {showAdd && (
              <div className="floating-panel absolute z-30 mt-1 max-h-72 w-64 overflow-auto p-1.5">
                {addableWidgets().map(a => (
                  <button key={`${a.type}:${a.metric || ''}`} onClick={() => addWidget(a.type, a.metric)} className="block w-full truncate rounded-md px-2.5 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50">{a.label}</button>
                ))}
              </div>
            )}
          </div>
          <button onClick={rename} className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"><Pencil className="h-3.5 w-3.5" /> Rename</button>
          <button onClick={restoreDefaults} className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"><RotateCcw className="h-3.5 w-3.5" /> Restore defaults</button>
          {isAdmin && <button onClick={publishOrg} className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"><Send className="h-3.5 w-3.5" /> Publish as org template</button>}
          <button onClick={del} className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
          <span className="ml-auto text-[11px] text-slate-400">Drag to reorder · resize / configure per widget · changes save automatically</span>
        </div>
      )}

      {/* Grid (font scale via zoom) */}
      <div style={{ zoom: theme.fontScale || 1 } as any}>
        <DashboardGrid
          widgets={config.widgets}
          editing={editing && canEditActive}
          ctx={ctx}
          gap={theme.spacing || 12}
          onReorder={reorder}
          onResizeW={resizeW}
          onResizeH={resizeH}
          onSettings={setSettingsId}
          onToggleHide={toggleHide}
          onRemove={remove}
        />
      </div>

      {settingsWidget && <WidgetSettingsModal widget={settingsWidget} onSave={saveWidget} onClose={() => setSettingsId(null)} />}
      {showTheme && <ThemePanel theme={theme} onChange={setTheme} onClose={() => setShowTheme(false)} />}
    </div>
  );
}

function ScopeBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={cn('inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium', active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}>{icon} {label}</button>
  );
}
