import { useState, useCallback, useEffect, Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useStore } from './hooks/useStore';
const AcceptInvitePage = lazy(() => import('./pages/AcceptInvitePage').then(m => ({ default: m.AcceptInvitePage })));
// Lazy: three people at Vasto will ever open this, and it has no business
// riding in every tenant user's bundle.
const VastosAdminPage = lazy(() => import('./pages/VastosAdminPage').then(m => ({ default: m.VastosAdminPage })));
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
import { PurchaseManagementPage } from './purchase/PurchaseManagementPage';
import { AttendancePage } from './pages/AttendancePage';
import { CalibrationPage } from './boq/pages/CalibrationPage';
import { ClientQuotePage } from './boq/pages/ClientQuotePage';
import { RolesPermissionsPage } from './pages/RolesPermissionsPage';
import { MarketingDashboardPage } from './marketing/MarketingDashboardPage';
import { MarketingConnectPage } from './marketing/MarketingConnectPage';
import { InventoryOverviewPage } from './inventory/pages/InventoryOverviewPage';
import { MaterialRequestsPage } from './inventory/pages/MaterialRequestsPage';
import { RfqsPage } from './inventory/pages/RfqsPage';
import { PurchaseOrdersPage } from './inventory/pages/PurchaseOrdersPage';
import { GoodsReceiptsPage } from './inventory/pages/GoodsReceiptsPage';
import { StockPage } from './inventory/pages/StockPage';
import { ConsumptionPage } from './inventory/pages/ConsumptionPage';
import { TransfersPage } from './inventory/pages/TransfersPage';
import { MaterialsPage } from './inventory/pages/MaterialsPage';
import { AccessDenied } from './components/AccessDenied';
import { usePermissions } from './hooks/usePermissions';
import { MODULE_BY_KEY, pageToModule } from './lib/rbac';

import type { Page } from './types';

function AppInner() {
  const { isAuthenticated, isVastosOperator } = useAuth();
  const { canAccess } = usePermissions();
  // The ?vastos-admin deep link is read HERE and not in the App() query-param
  // block, which runs outside AuthProvider — there it would render the console
  // with no session and no gate at all.
  const [currentPage, setCurrentPage] = useState<Page>(() =>
    new URLSearchParams(window.location.search).has('vastos-admin') ? 'vastos-admin' : 'dashboard'
  );
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
  //
  // vastos-admin is an OVERRIDE, not an extra clause, because the ordinary path
  // fails OPEN for it: canAccess() is `can() && planAllows()`, can() returns true
  // immediately for any is_admin role without ever consulting the module, and
  // planAllows() returns true when plan is null. So every firm admin whose firm
  // has no firm_subscriptions row would otherwise pass the guard for a page that
  // administers every tenant. isVastosOperator is the only thing consulted here.
  const guardModule = pageToModule(effectivePage);
  const blocked = effectivePage === 'vastos-admin'
    ? !isVastosOperator
    : (effectivePage !== 'login' && !canAccess(guardModule));

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
      case 'purchase':
        return <PurchaseManagementPage />;
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
      case 'inventory':
        return <InventoryOverviewPage onNavigate={navigate} />;
      case 'material-requests':
        return <MaterialRequestsPage onNavigate={navigate} />;
      case 'rfqs':
        return <RfqsPage onNavigate={navigate} />;
      case 'purchase-orders':
        return <PurchaseOrdersPage onNavigate={navigate} />;
      case 'goods-receipts':
        return <GoodsReceiptsPage />;
      case 'stock':
        return <StockPage />;
      case 'consumption':
        return <ConsumptionPage />;
      case 'transfers':
        return <TransfersPage />;
      case 'materials':
        return <MaterialsPage />;
      case 'vastos-admin':
        return (
          <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>}>
            <VastosAdminPage />
          </Suspense>
        );
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
      {blocked
        ? <AccessDenied module={
            effectivePage === 'vastos-admin'
              ? 'Platform Admin'
              : (MODULE_BY_KEY[guardModule]?.label ?? guardModule)
          } />
        : renderPage()}
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

  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
