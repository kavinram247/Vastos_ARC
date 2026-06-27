import { ShieldX } from 'lucide-react';

/** Shown when the current role lacks view access to the requested module. */
export function AccessDenied({ module }: { module?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
        <ShieldX className="h-6 w-6 text-red-500" />
      </div>
      <p className="mt-4 text-lg font-semibold text-slate-700">You don't have access to this area</p>
      <p className="mt-1 max-w-sm text-sm text-slate-400">
        {module ? `Your role isn't permitted to view the ${module} module.` : 'Your role does not permit viewing this page.'}{' '}
        Contact an administrator if you believe this is a mistake.
      </p>
    </div>
  );
}
