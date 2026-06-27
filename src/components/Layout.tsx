import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../hooks/useStore';
import { Avatar } from './ui/Avatar';
import type { Page } from '../types';
import {
  LayoutDashboard, FolderKanban,
  Bell, Activity,
  LogOut, Menu, X, ChevronDown, Users, Home, TrendingUp, Calculator, Database, Receipt, Truck, Target, ListChecks, CalendarCheck,
} from 'lucide-react';
import { cn } from '../utils/cn';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: Page;
  onNavigate: (page: Page, projectId?: string) => void;
  selectedProjectId?: string;
}

export function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const { user, firm, logout } = useAuth();
  const store = useStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  if (!user || !firm) return null;

  const unreadNotifs = store.notifications.filter(n => n.user_id === user.id && !n.read).length;

  const isClient = user.role === 'client';

  type NavItem = { id: Page; label: string; icon: React.ReactNode; badge?: number };
  type NavGroup = { label: string; items: NavItem[] };
  
  // Project-scoped pages — highlight "Projects" in sidebar when on these
  const projectScopedPages: Page[] = ['milestones', 'site-updates', 'payments', 'costs', 'documents', 'comments', 'project-detail'];

  const navGroups: NavGroup[] = isClient
    ? [
        {
          label: 'Workspace',
          items: [
            { id: 'client-portal', label: 'Overview', icon: <Home /> },
            { id: 'projects', label: 'My Projects', icon: <FolderKanban /> },
          ],
        },
        {
          label: 'Updates',
          items: [
            { id: 'notifications', label: 'Notifications', icon: <Bell />, badge: unreadNotifs },
          ],
        },
      ]
    : [
        {
          label: 'Workspace',
          items: [
            { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard /> },
            { id: 'leads', label: 'Leads', icon: <TrendingUp /> },
            { id: 'projects', label: 'Projects', icon: <FolderKanban /> },
            { id: 'tasks', label: 'Tasks', icon: <ListChecks /> },
            { id: 'attendance', label: 'Attendance', icon: <CalendarCheck /> },
          ],
        },
        {
          label: 'Commercial',
          items: [
            { id: 'boq', label: 'BOQ Estimator', icon: <Calculator /> },
            { id: 'quotations', label: 'Quotations', icon: <Receipt /> },
            ...(user.role === 'owner' ? [
              { id: 'vendors' as Page, label: 'Vendors', icon: <Truck /> },
              { id: 'catalog' as Page, label: 'Catalog & Rates', icon: <Database /> },
              { id: 'calibration' as Page, label: 'Accuracy', icon: <Target /> },
            ] : []),
          ],
        },
        {
          label: 'Firm',
          items: [
            ...(user.role === 'owner' ? [
              { id: 'user-management' as Page, label: 'Users', icon: <Users /> },
            ] : []),
            { id: 'notifications', label: 'Notifications', icon: <Bell />, badge: unreadNotifs },
            { id: 'activity-log', label: 'Activity Log', icon: <Activity /> },
          ],
        },
      ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile header */}
      <header className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between border-b border-white/8 bg-[#15201c] px-4 text-white lg:hidden">
        <button aria-label="Open navigation" onClick={() => setSidebarOpen(true)} className="-ml-2 rounded-lg p-2 text-white/70 hover:bg-white/8 hover:text-white">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-500 text-[10px] font-bold tracking-[-0.04em] text-white">
            VA
          </div>
          <span className="text-sm font-semibold tracking-[-0.02em]">Vastos Arch</span>
        </div>
        <button aria-label="Open notifications" onClick={() => onNavigate('notifications')} className="relative -mr-2 rounded-lg p-2 text-white/70 hover:bg-white/8 hover:text-white">
          <Bell className="w-5 h-5" />
          {unreadNotifs > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-md bg-red-500 px-1 text-[9px] font-bold text-white">
              {unreadNotifs}
            </span>
          )}
        </button>
      </header>

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-[1px] lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed bottom-0 left-0 top-0 z-50 flex w-[248px] flex-col bg-[#15201c] text-white shadow-[8px_0_28px_rgba(10,22,17,0.08)] transition-transform duration-200',
        'lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Firm branding */}
        <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-white/8 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-indigo-500 text-[12px] font-bold tracking-[-0.04em] text-white shadow-[0_4px_10px_rgba(0,0,0,0.18)]">
              VA
            </div>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold tracking-[-0.025em] text-white">Vastos Arch</div>
              <div className="truncate text-[10px] text-white/42">{firm.name}</div>
            </div>
          </div>
          <button aria-label="Close navigation" onClick={() => setSidebarOpen(false)} className="rounded-lg p-1.5 text-white/45 hover:bg-white/8 hover:text-white lg:hidden">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-5">
            {navGroups.map(group => (
              <div key={group.label}>
                <div className="mb-1.5 px-3 text-[10px] font-semibold tracking-[0.08em] text-white/30 uppercase">
                  {group.label}
                </div>
                <div className="space-y-0.5">
                  {group.items.map(item => {
                    const active = currentPage === item.id || (item.id === 'projects' && projectScopedPages.includes(currentPage));
                    return (
                      <button
                        key={item.id}
                        aria-current={active ? 'page' : undefined}
                        onClick={() => { onNavigate(item.id); setSidebarOpen(false); }}
                        className={cn(
                          'flex h-9 w-full items-center gap-3 rounded-lg px-3 text-[13px] font-medium [&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:shrink-0',
                          active
                            ? 'bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.035)]'
                            : 'text-white/54 hover:bg-white/[0.055] hover:text-white/88'
                        )}
                      >
                        <span className={active ? 'text-indigo-300' : 'text-white/42'}>{item.icon}</span>
                        <span className="flex-1 text-left">{item.label}</span>
                        {item.badge ? (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-red-500/90 px-1.5 text-[9px] font-bold text-white">
                            {item.badge}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        {/* User section */}
        <div className="border-t border-white/8 p-3">
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex w-full items-center gap-3 rounded-[10px] p-2 hover:bg-white/[0.055]"
            >
              <Avatar name={user.full_name} size="sm" />
              <div className="flex-1 text-left min-w-0">
                <div className="truncate text-[13px] font-medium text-white/88">{user.full_name}</div>
                <div className="text-[11px] capitalize text-white/36">{user.role}</div>
              </div>
              <ChevronDown className={cn('h-4 w-4 text-white/32 transition-transform', userMenuOpen && 'rotate-180')} />
            </button>
            {userMenuOpen && (
              <div className="floating-panel absolute bottom-full left-0 right-0 mb-2 py-1">
                <button
                  onClick={() => { logout(); setUserMenuOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="min-h-screen pt-14 lg:ml-[248px] lg:pt-0">
        <div className="page-shell p-4 sm:p-6 lg:p-8 xl:p-10">
          {children}
        </div>
      </main>
    </div>
  );
}
