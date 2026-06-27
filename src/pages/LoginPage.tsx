import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { store } from '../data/store';
import { ArrowRight, Building2, Shield, Palette, HardHat, User } from 'lucide-react';

const roleIcons = {
  owner: Shield,
  architect: Palette,
  engineer: HardHat,
  client: User,
};

const roleColors = {
  owner: 'text-indigo-700 bg-indigo-50',
  architect: 'text-sky-700 bg-sky-50',
  engineer: 'text-amber-600 bg-amber-50',
  client: 'text-emerald-600 bg-emerald-50',
};

const roleDescriptions = {
  owner: 'Full access to all features',
  architect: 'Access to all projects & designs',
  engineer: 'Site updates & assigned projects',
  client: 'View your project progress',
};

export function LoginPage() {
  const { login } = useAuth();
  const [error, setError] = useState('');

  const firm = store.firms[0];
  const users = store.profiles;
  const internalTeam = users.filter(u => u.role !== 'client');
  const clients = users.filter(u => u.role === 'client');

  const handleLogin = (email: string) => {
    const ok = login(email);
    if (!ok) setError('User not found');
  };

  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-[minmax(360px,0.8fr)_minmax(620px,1.2fr)]">
      <section className="relative flex min-h-[360px] flex-col justify-between overflow-hidden bg-[#15201c] p-8 text-white sm:p-12 lg:min-h-screen lg:p-14">
        <div className="absolute -right-28 -top-28 h-80 w-80 rounded-full border border-white/[0.055]" />
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full border border-white/[0.045]" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-indigo-500 text-xs font-bold tracking-[-0.04em] shadow-[0_8px_18px_rgba(0,0,0,0.22)]">
            VA
          </div>
          <div>
            <div className="text-[17px] font-semibold tracking-[-0.025em]">Vastos Arch</div>
            <div className="text-[10px] tracking-[0.08em] text-white/38 uppercase">Practice operations</div>
          </div>
        </div>

        <div className="relative max-w-lg py-14 lg:py-0">
          <p className="mb-4 text-xs font-semibold text-indigo-300">Architecture, clearly operated.</p>
          <h1 className="max-w-[12ch] text-[40px] font-semibold leading-[1.08] tracking-[-0.038em] text-white sm:text-[48px]">
            Run the practice. Keep the work visible.
          </h1>
          <p className="mt-6 max-w-[44ch] text-[15px] leading-7 text-white/52">
            One dependable view for projects, commercial work, site delivery, and client progress.
          </p>
        </div>

        <div className="relative flex items-start gap-3 border-t border-white/8 pt-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.07] text-indigo-300">
            <Building2 className="h-[18px] w-[18px]" />
          </div>
          <div>
            <div className="text-sm font-medium text-white/88">{firm.name}</div>
            <div className="mt-1 max-w-[36ch] text-xs leading-5 text-white/36">{firm.address}</div>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center p-5 sm:p-10 lg:p-14">
        <div className="w-full max-w-2xl">
          <div className="mb-8">
            <p className="text-xs font-semibold text-indigo-700">Demo workspace</p>
            <h2 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-slate-900">Choose a role to continue</h2>
            <p className="mt-2 max-w-[58ch] text-sm leading-6 text-slate-500">
              Each profile opens the same product with its existing role-based access and permissions.
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>
          )}

          <div className="surface-panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <h3 className="text-xs font-semibold text-slate-700">Internal team</h3>
              <span className="text-xs text-slate-400">{internalTeam.length} profiles</span>
            </div>
            <div className="divide-y divide-slate-100">
              {internalTeam.map(u => {
                const Icon = roleIcons[u.role];
                return (
                  <button
                    key={u.id}
                    onClick={() => handleLogin(u.email)}
                    className="group flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50"
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${roleColors[u.role]}`}>
                      <Icon className="h-[18px] w-[18px]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-900">{u.full_name}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{roleDescriptions[u.role]}</div>
                    </div>
                    <span className="hidden rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold capitalize text-slate-600 sm:inline-flex">
                      {u.role}
                    </span>
                    <ArrowRight className="h-4 w-4 text-slate-300 group-hover:translate-x-0.5 group-hover:text-indigo-600" />
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-y border-slate-100 bg-slate-50/70 px-5 py-3">
              <h3 className="text-xs font-semibold text-slate-700">Clients</h3>
              <span className="text-xs text-slate-400">{clients.length} profiles</span>
            </div>
            <div className="divide-y divide-slate-100">
              {clients.map(u => {
                const Icon = roleIcons[u.role];
                return (
                  <button
                    key={u.id}
                    onClick={() => handleLogin(u.email)}
                    className="group flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50"
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${roleColors[u.role]}`}>
                      <Icon className="h-[18px] w-[18px]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-900">{u.full_name}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{roleDescriptions[u.role]}</div>
                    </div>
                    <span className="hidden rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 sm:inline-flex">
                      Client
                    </span>
                    <ArrowRight className="h-4 w-4 text-slate-300 group-hover:translate-x-0.5 group-hover:text-indigo-600" />
                  </button>
                );
              })}
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-slate-400">
            Role-aware demo · Existing permissions and workflows are unchanged
          </p>
        </div>
      </section>
    </main>
  );
}
