import { useState, useCallback, useEffect, Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useStore } from './hooks/useStore';
const AcceptInvitePage = lazy(() => import('./pages/AcceptInvitePage').then(m => ({ default: m.AcceptInvitePage })));
const VastosAdminPage  = lazy(() => import('./pages/VastosAdminPage').then(m => ({ default: m.VastosAdminPage })));
import { Loader2 } from 'lucide-react';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { MilestonesPage } from './pages/MilestonesPage';
import { SiteUpdatesPage } from './pages/SiteUpdatesPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { CostsPage } from './pages/CostsPage';
import { CommentsPage } from './pages/CommentsPage';
import { ClientPortalPage } from './pages/ClientPortalPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ActivityLogPage } from './pages/ActivityLogPage';
import { TeamPage } from './pages/TeamPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { LeadsPage } from './leads/LeadsPage';
import { LeadsAdminPage } from './leads/LeadsAdminPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { BoqEstimatorPage } from './boq/pages/BoqEstimatorPage';
import { CatalogAdminPage } from './boq/pages/CatalogAdminPage';
import { QuotationsPage } from './boq/pages/QuotationsPage';
import { VendorsPage } from './boq/pages/VendorsPage';
import { TasksPage } from './tasks/TasksPage';
import { AttendancePage } from './pages/AttendancePage';
import { CalibrationPage } from './boq/pages/CalibrationPage';
import { ClientQuotePage } from './boq/pages/ClientQuotePage';
import { RolesPermissionsPage } from './pages/RolesPermissionsPage';
import { MarketingDashboardPage } from './marketing/MarketingDashboardPage';
import { MarketingConnectPage } from './marketing/MarketingConnectPage';
import { AccessDenied } from './components/AccessDenied';
import { usePermissions } from './hooks/usePermissions';
import { MODULE_BY_KEY, pageToModule } from './lib/rbac';

import type { Page } from './types';

function AppInner() {
  const { isAuthenticated } = useAuth();
  const { canAccess } = usePermissions();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();

  const navigate = useCallback((page: Page, projectId?: string) => {
    setCurrentPage(page);
    if (projectId !== undefined) {
      setSelectedProjectId(projectId);
    }
  }, []);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Users without dashboard access land on the first area they can see
  // (client portal for clients, otherwise their first permitted nav page).
  const wantsDashboard = currentPage === 'dashboard';
  const effectivePage: Page =
    wantsDashboard && !canAccess('dashboard')
      ? (canAccess('client-portal') ? 'client-portal' : currentPage)
      : currentPage;

  // Router guard — block direct/in-app navigation to modules the role can't view.
  const guardModule = pageToModule(effectivePage);
  const blocked = effectivePage !== 'login' && !canAccess(guardModule);

  const renderPage = () => {
    switch (effectivePage) {
      case 'dashboard':
        return <DashboardPage onNavigate={navigate} />;
      case 'projects':
        return <ProjectsPage onNavigate={navigate} />;
      case 'project-detail':
        return selectedProjectId
          ? <ProjectDetailPage projectId={selectedProjectId} onNavigate={navigate} />
          : <ProjectsPage onNavigate={navigate} />;
      case 'milestones':
        return selectedProjectId
          ? <MilestonesPage projectId={selectedProjectId} onNavigate={navigate} />
          : <ProjectsPage onNavigate={navigate} />;
      case 'site-updates':
        return selectedProjectId
          ? <SiteUpdatesPage projectId={selectedProjectId} onNavigate={navigate} />
          : <ProjectsPage onNavigate={navigate} />;
      case 'payments':
        return selectedProjectId
          ? <PaymentsPage projectId={selectedProjectId} onNavigate={navigate} />
          : <ProjectsPage onNavigate={navigate} />;
      case 'costs':
        return selectedProjectId
          ? <CostsPage projectId={selectedProjectId} onNavigate={navigate} />
          : <ProjectsPage onNavigate={navigate} />;
      case 'comments':
        return selectedProjectId
          ? <CommentsPage projectId={selectedProjectId} onNavigate={navigate} />
          : <ProjectsPage onNavigate={navigate} />;
      case 'documents':
        return selectedProjectId
          ? <DocumentsPage projectId={selectedProjectId} onNavigate={navigate} />
          : <ProjectsPage onNavigate={navigate} />;
      case 'client-portal':
        return <ClientPortalPage onNavigate={navigate} />;
      case 'notifications':
        return <NotificationsPage onNavigate={navigate} />;
      case 'activity-log':
        return <ActivityLogPage />;
      case 'team':
        return <TeamPage />;
      case 'user-management':
        return <UserManagementPage />;
      case 'roles':
        return <RolesPermissionsPage />;
      case 'marketing':
        return <MarketingDashboardPage onNavigate={navigate} />;
      case 'marketing-connect':
        return <MarketingConnectPage onNavigate={navigate} />;
      case 'leads':
        return <LeadsPage onNavigate={navigate} />;
      case 'leads-admin':
        return <LeadsAdminPage onNavigate={navigate} />;
      case 'tasks':
        return <TasksPage onNavigate={navigate} />;
      case 'attendance':
        return <AttendancePage />;
      case 'boq':
        return <BoqEstimatorPage />;
      case 'catalog':
        return <CatalogAdminPage />;
      case 'quotations':
        return <QuotationsPage />;
      case 'vendors':
        return <VendorsPage />;
      case 'calibration':
        return <CalibrationPage />;
      default:
        return <DashboardPage onNavigate={navigate} />;
    }
  };

  return (
    <Layout
      currentPage={effectivePage}
      onNavigate={navigate}
      selectedProjectId={selectedProjectId}
    >
      {blocked ? <AccessDenied module={MODULE_BY_KEY[guardModule]?.label ?? guardModule} /> : renderPage()}
    </Layout>
  );
}

// Hydrates the store for the authenticated firm, then renders the app.
function HydrationGate({ firmId }: { firmId: string }) {
  const store = useStore();
  useEffect(() => { store.hydrate(firmId).catch((e) => console.error('hydrate failed', e)); }, [firmId]);
  if (!store.loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading workspace…
      </div>
    );
  }
  return <AppInner />;
}

// Auth-aware shell: waits for Supabase session check, then routes.
function AppShell() {
  const { isAuthenticated, isLoading, firm } = useAuth();
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Checking session…
      </div>
    );
  }
  if (!isAuthenticated) return <LoginPage />;
  return <HydrationGate firmId={firm!.id} />;
}

export default function App() {
  const params = new URLSearchParams(window.location.search);

  // Public routes — no auth required
  if (params.get('quote'))
    return <ClientQuotePage token={params.get('quote')!} />;
  if (params.get('invite'))
    return <Suspense fallback={null}><AcceptInvitePage token={params.get('invite')!} /></Suspense>;
  if (params.get('vastos-admin') === 'true')
    return <Suspense fallback={null}><VastosAdminPage /></Suspense>;

  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
