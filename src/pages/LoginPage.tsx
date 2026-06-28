import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { store } from '../data/store';
import {
  ArrowRight, Building2, Eye, EyeOff, Loader2, Mail, Lock,
  Shield, Palette, HardHat, User, ChevronDown,
} from 'lucide-react';

const roleIcons: Record<string, React.ElementType> = {
  owner: Shield, architect: Palette, engineer: HardHat, client: User,
};
const roleColors: Record<string, string> = {
  owner: 'text-indigo-700 bg-indigo-50',
  architect: 'text-sky-700 bg-sky-50',
  engineer: 'text-amber-600 bg-amber-50',
  client: 'text-emerald-600 bg-emerald-50',
};

export function LoginPage() {
  const { signIn, forgotPassword, switchUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [mode, setMode] = useState<'login' | 'forgot'>('login');

  const firm = store.firms[0];

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError('');
    setLoading(true);
    const { error: err } = await signIn(email.trim().toLowerCase(), password);
    setLoading(false);
    if (err) setError('Invalid email or password. Please try again.');
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError('Enter your email address first.'); return; }
    setError('');
    setLoading(true);
    const { error: err } = await forgotPassword(email.trim().toLowerCase());
    setLoading(false);
    if (err) setError(err);
    else setResetSent(true);
  };

  const internalTeam = store.profiles.filter(u => u.role !== 'client');
  const clients = store.profiles.filter(u => u.role === 'client');

  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-[minmax(360px,0.8fr)_minmax(620px,1.2fr)]">
      {/* ── Left brand panel ── */}
      <section className="relative flex min-h-[360px] flex-col justify-between overflow-hidden bg-[#15201c] p-8 text-white sm:p-12 lg:min-h-screen lg:p-14">
        <div className="absolute -right-28 -top-28 h-80 w-80 rounded-full border border-white/[0.055]" />
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full border border-white/[0.045]" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-indigo-500 text-xs font-bold tracking-[-0.04em] shadow-[0_8px_18px_rgba(0,0,0,0.22)]">VA</div>
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
            <div className="text-sm font-medium text-white/88">{firm?.name ?? 'VASTOS'}</div>
            <div className="mt-1 max-w-[36ch] text-xs leading-5 text-white/36">{firm?.address ?? ''}</div>
          </div>
        </div>
      </section>

      {/* ── Right form panel ── */}
      <section className="flex items-center justify-center p-5 sm:p-10 lg:p-14">
        <div className="w-full max-w-md">

          {mode === 'login' ? (
            <>
              <div className="mb-8">
                <h2 className="text-[28px] font-semibold tracking-[-0.03em] text-slate-900">Welcome back</h2>
                <p className="mt-2 text-sm text-slate-500">Sign in to your workspace to continue.</p>
              </div>

              {error && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>
              )}

              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">Email address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email" autoComplete="email" required
                      value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="you@yourfirm.com"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-3 focus:ring-indigo-500/15"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">Password</label>
                    <button type="button" onClick={() => { setMode('forgot'); setError(''); }}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPw ? 'text' : 'password'} autoComplete="current-password" required
                      value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-11 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-3 focus:ring-indigo-500/15"
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-60">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Sign in <ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>

              {/* Demo mode */}
              <div className="mt-8">
                <button onClick={() => setShowDemo(!showDemo)}
                  className="flex w-full items-center justify-between rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors">
                  <span className="font-medium">Demo workspace — pick a role</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showDemo ? 'rotate-180' : ''}`} />
                </button>

                {showDemo && (
                  <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                      <span className="text-xs font-semibold text-slate-600">Internal team</span>
                      <span className="text-xs text-slate-400">{internalTeam.length} profiles</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {internalTeam.map(u => {
                        const Icon = roleIcons[u.role] ?? User;
                        return (
                          <button key={u.id} onClick={() => switchUser(u.id)}
                            className="group flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${roleColors[u.role] ?? 'text-slate-600 bg-slate-100'}`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold text-slate-900">{u.full_name}</div>
                              <div className="text-xs text-slate-400 capitalize">{u.role}</div>
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-indigo-500" />
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between border-y border-slate-100 bg-slate-50/70 px-4 py-2.5">
                      <span className="text-xs font-semibold text-slate-600">Clients</span>
                      <span className="text-xs text-slate-400">{clients.length} profiles</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {clients.map(u => (
                        <button key={u.id} onClick={() => switchUser(u.id)}
                          className="group flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-emerald-600 bg-emerald-50">
                            <User className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-slate-900">{u.full_name}</div>
                            <div className="text-xs text-emerald-600">Client</div>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-indigo-500" />
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-slate-100 bg-amber-50 px-4 py-2.5">
                      <p className="text-[11px] text-amber-700 font-medium">Demo mode — uses seeded data, no real credentials</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* ── Forgot password ── */
            <>
              <button onClick={() => { setMode('login'); setError(''); setResetSent(false); }}
                className="mb-6 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
                <ArrowRight className="w-3.5 h-3.5 rotate-180" /> Back to sign in
              </button>

              {resetSent ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                  <div className="mb-3 text-3xl">📬</div>
                  <h3 className="text-base font-bold text-slate-900">Check your inbox</h3>
                  <p className="mt-2 text-sm text-slate-500">We sent a password reset link to <strong>{email}</strong>. It expires in 1 hour.</p>
                  <button onClick={() => { setMode('login'); setResetSent(false); }}
                    className="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-800">Back to sign in</button>
                </div>
              ) : (
                <>
                  <div className="mb-8">
                    <h2 className="text-[26px] font-semibold tracking-[-0.03em] text-slate-900">Reset your password</h2>
                    <p className="mt-2 text-sm text-slate-500">Enter your email and we'll send you a reset link.</p>
                  </div>
                  {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
                  <form onSubmit={handleForgot} className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-700">Email address</label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                          placeholder="you@yourfirm.com"
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm focus:border-indigo-500 focus:outline-none focus:ring-3 focus:ring-indigo-500/15" />
                      </div>
                    </div>
                    <button type="submit" disabled={loading}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60">
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send reset link'}
                    </button>
                  </form>
                </>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
