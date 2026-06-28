import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Eye, EyeOff, Loader2, CheckCircle, XCircle, ArrowRight } from 'lucide-react';

interface InviteRow {
  id: string;
  firm_id: string;
  email: string;
  full_name: string | null;
  expires_at: string;
  accepted_at: string | null;
}

interface Props { token: string }

export function AcceptInvitePage({ token }: Props) {
  const [invite, setInvite] = useState<InviteRow | null>(null);
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'expired' | 'used' | 'done'>('loading');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('user_invites').select('id,firm_id,email,full_name,expires_at,accepted_at')
      .eq('token', token).maybeSingle()
      .then(({ data, error: e }) => {
        if (e || !data) { setStatus('invalid'); return; }
        const row = data as InviteRow;
        if (row.accepted_at) { setStatus('used'); return; }
        if (new Date(row.expires_at) < new Date()) { setStatus('expired'); return; }
        setInvite(row);
        setStatus('valid');
      });
  }, [token]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite) return;
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setError('');
    setSaving(true);

    // Use edge function with admin API — creates confirmed user without sending any email
    const res = await fetch(`${(import.meta as any).env?.VITE_SUPABASE_URL ?? 'https://weckowkvqpamnlcqwvfh.supabase.co'}/functions/v1/accept-invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    } as RequestInit);
    const result = await res.json();

    if (!res.ok || result.error) {
      if (result.error === 'already_used') {
        setError('This invite has already been used. Try signing in instead.');
      } else if (result.error === 'expired') {
        setError('This invite link has expired. Ask your admin for a new one.');
      } else if (result.error?.includes('already been registered')) {
        setError('This email is already registered. Try signing in instead.');
      } else {
        setError(result.error ?? 'Something went wrong. Please try again.');
      }
      setSaving(false);
      return;
    }

    setSaving(false);
    setStatus('done');
  };

  const containerClass = "flex min-h-screen items-center justify-center bg-slate-50 p-4";

  if (status === 'loading') return (
    <div className={containerClass}>
      <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
    </div>
  );

  if (status === 'invalid') return (
    <div className={containerClass}>
      <div className="w-full max-w-sm text-center">
        <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900">Invalid invite link</h2>
        <p className="mt-2 text-sm text-slate-500">This link doesn't exist or has been removed.</p>
      </div>
    </div>
  );

  if (status === 'expired') return (
    <div className={containerClass}>
      <div className="w-full max-w-sm text-center">
        <XCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900">Invite expired</h2>
        <p className="mt-2 text-sm text-slate-500">This invite link has expired. Ask your admin to send a new one.</p>
      </div>
    </div>
  );

  if (status === 'used') return (
    <div className={containerClass}>
      <div className="w-full max-w-sm text-center">
        <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900">Already accepted</h2>
        <p className="mt-2 text-sm text-slate-500">This invite has already been used.</p>
        <a href="/" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800">
          Go to sign in <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );

  if (status === 'done') return (
    <div className={containerClass}>
      <div className="w-full max-w-sm text-center">
        <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900">Account created!</h2>
        <p className="mt-2 text-sm text-slate-500">Your account is ready. Sign in with your new password.</p>
        <a href="/" className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-6 text-sm font-semibold text-white hover:bg-indigo-700">
          Sign in <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </div>
  );

  // status === 'valid'
  return (
    <div className={containerClass}>
      <div className="w-full max-w-md">
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-[12px] bg-indigo-600 text-sm font-bold text-white shadow">VA</div>
        <h2 className="mt-4 text-[26px] font-semibold tracking-[-0.03em] text-slate-900">You've been invited</h2>
        <p className="mt-2 text-sm text-slate-500">
          Set a password for <strong>{invite!.email}</strong> to activate your account.
        </p>

        {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <form onSubmit={handleAccept} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">Password <span className="text-slate-400 font-normal">(min 8 characters)</span></label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} required minLength={8}
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 pr-11 text-sm focus:border-indigo-500 focus:outline-none focus:ring-3 focus:ring-indigo-500/15" />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">Confirm password</label>
            <input type={showPw ? 'text' : 'password'} required
              value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="••••••••"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm focus:border-indigo-500 focus:outline-none focus:ring-3 focus:ring-indigo-500/15" />
          </div>

          <button type="submit" disabled={saving}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Create account <ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>
      </div>
    </div>
  );
}
