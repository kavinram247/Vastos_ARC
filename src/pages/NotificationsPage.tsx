import { useAuth } from '../context/AuthContext';
import { useStore } from '../hooks/useStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { timeAgo } from '../utils/format';
import { parseLink } from '../lib/events';
import type { Page } from '../types';
import {
  Bell, Check, Info, AlertTriangle, CheckCircle2, XCircle,
} from 'lucide-react';
import { cn } from '../utils/cn';

interface Props {
  onNavigate?: (page: Page, projectId?: string) => void;
}

export function NotificationsPage({ onNavigate }: Props) {
  const { user, firm } = useAuth();
  const store = useStore();

  if (!user || !firm) return null;

  const openNotif = (notif: { id: string; link?: string | null }) => {
    store.markNotificationRead(notif.id);
    const dest = parseLink(notif.link);
    if (dest && onNavigate) onNavigate(dest.page, dest.projectId);
  };

  const notifications = store.notifications
    .filter(n => n.user_id === user.id && n.firm_id === firm.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const unreadCount = notifications.filter(n => !n.read).length;

  const typeIcons = {
    info: <Info className="w-4 h-4 text-blue-500" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-500" />,
    success: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    error: <XCircle className="w-4 h-4 text-red-500" />,
  };

  const typeSurfaces = {
    info: 'bg-blue-50',
    warning: 'bg-amber-50',
    success: 'bg-emerald-50',
    error: 'bg-red-50',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight text-slate-900">Notifications</h1>
          <p className="text-slate-500 text-sm mt-1">{unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={() => store.markAllNotificationsRead(user.id)}>
            <Check className="w-4 h-4" /> Mark all read
          </Button>
        )}
      </div>

      <div className="surface-panel divide-y divide-slate-100 overflow-hidden">
        {notifications.map(notif => (
          <Card
            key={notif.id}
            className={cn(
              'cursor-pointer !rounded-none !shadow-none transition-colors hover:bg-slate-50',
              !notif.read && 'bg-indigo-50/55'
            )}
            onClick={() => openNotif(notif)}
          >
            <div className="flex items-start gap-3">
              <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', typeSurfaces[notif.type])}>
                {typeIcons[notif.type]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'text-sm',
                    notif.read ? 'font-medium text-slate-700' : 'font-semibold text-slate-900'
                  )}>
                    {notif.title}
                  </span>
                  {!notif.read && (
                    <span className="w-2 h-2 bg-indigo-500 rounded-full shrink-0" />
                  )}
                </div>
                <p className="text-sm text-slate-600 mt-0.5">{notif.message}</p>
                <span className="text-xs text-slate-400 mt-1 block">{timeAgo(notif.created_at)}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {notifications.length === 0 && (
        <div className="text-center py-12">
          <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No notifications.</p>
        </div>
      )}
    </div>
  );
}
