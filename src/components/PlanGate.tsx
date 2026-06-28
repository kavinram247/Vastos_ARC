import { usePlan } from '../context/AuthContext';
import { Lock, ArrowRight } from 'lucide-react';

interface Props {
  moduleKey: string;
  children: React.ReactNode;
  label?: string;
}

export function PlanGate({ moduleKey, children, label }: Props) {
  const plan = usePlan();

  // No plan data yet (loading) or plan grants access — render children
  if (!plan || plan.module_keys.includes(moduleKey)) return <>{children}</>;

  // Plan is suspended
  if (plan.status === 'suspended') {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 mb-4">
          <Lock className="w-6 h-6 text-red-500" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Account suspended</h2>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          Your subscription has been suspended. Please contact VASTOS to reactivate your account.
        </p>
        <a href="mailto:hello@vastos.in" className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800">
          Contact support <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>
    );
  }

  // Feature not in plan — upgrade prompt
  const planHierarchy = ['Starter', 'Professional', 'Growth', 'Enterprise'];
  const currentIdx = planHierarchy.indexOf(plan.name);
  const nextPlan = planHierarchy[currentIdx + 1] ?? 'Growth';

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-6">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 mb-4">
        <Lock className="w-6 h-6 text-indigo-400" />
      </div>
      <div className="mb-2">
        <span className="inline-block rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
          {plan.name} plan
        </span>
      </div>
      <h2 className="text-lg font-bold text-slate-900">{label ?? moduleKey} requires an upgrade</h2>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        This feature is available on the <strong>{nextPlan}</strong> plan and above.
        Contact VASTOS to upgrade your subscription.
      </p>
      <div className="mt-5 flex items-center gap-3">
        <a href="mailto:hello@vastos.in?subject=Upgrade request"
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700">
          Upgrade plan <ArrowRight className="w-3.5 h-3.5" />
        </a>
        <a href="mailto:hello@vastos.in"
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
          Contact us
        </a>
      </div>
      {plan.status === 'trial' && plan.trial_ends_at && (
        <p className="mt-4 text-xs text-amber-600 font-medium">
          Trial ends {new Date(plan.trial_ends_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      )}
    </div>
  );
}
