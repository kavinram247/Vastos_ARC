import { useState, useEffect } from 'react';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Input';
import { formatINR, formatDate } from '../../utils/format';
import { fetchRegions, listBoqs, type RegionRow } from '../api';
import {
  fetchVarianceSummary, runCalibration, fetchCalibrationHistory, reconcileBoqFromActuals,
  type VarianceSummary, type CalibrationResult,
} from '../calibrationApi';
import { Target, TrendingUp, AlertTriangle, RefreshCw, Loader2, Check, History, Wand2 } from 'lucide-react';

export function CalibrationPage() {
  const [summary, setSummary] = useState<VarianceSummary | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [regions, setRegions] = useState<RegionRow[]>([]);
  const [boqs, setBoqs] = useState<any[]>([]);
  const [regionId, setRegionId] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [results, setResults] = useState<CalibrationResult[] | null>(null);

  const load = async () => {
    const [s, h] = await Promise.all([fetchVarianceSummary(), fetchCalibrationHistory()]);
    setSummary(s); setHistory(h);
  };
  useEffect(() => {
    Promise.all([fetchRegions(), listBoqs()]).then(([rg, bq]) => {
      setRegions(rg); setBoqs(bq);
      setRegionId((rg.find((r) => r.name === 'Mumbai') || rg[0])?.id || '');
    });
    load().catch(console.error);
  }, []);

  const onRun = async () => {
    setRunning(true); setResults(null);
    try { const r = await runCalibration(regionId); setResults(r); await load(); }
    catch (e) { alert('Calibration failed: ' + (e as any).message); } finally { setRunning(false); }
  };
  const onReconcile = async () => {
    if (!boqs[0]) return;
    setReconciling(true);
    try { await reconcileBoqFromActuals((boqs[0] as any).id, regionId); await load(); }
    catch (e) { alert('Reconcile failed: ' + (e as any).message); } finally { setReconciling(false); }
  };

  if (!summary) return <div className="flex items-center justify-center py-24 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading variance data…</div>;

  const driftCount = summary.products.filter((p) => p.calib?.drift).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Target className="w-6 h-6 text-indigo-600" /> Estimation Accuracy & Calibration</h1>
          <p className="text-sm text-slate-500">Actual site costs vs estimates → auto-tunes waste factors & rates. The accuracy moat.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select aria-label="Region" value={regionId} onChange={(e) => setRegionId(e.target.value)} options={regions.map((r) => ({ value: r.id, label: `📍 ${r.name}` }))} />
          <Button variant="secondary" size="sm" onClick={onReconcile} disabled={reconciling || !boqs.length}>
            {reconciling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Simulate actuals
          </Button>
          <Button size="sm" onClick={onRun} disabled={running}>
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Run Calibration
          </Button>
        </div>
      </div>

      {/* summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Estimate accuracy" value={`${(summary.accuracy * 100).toFixed(1)}%`} accent={summary.accuracy >= 0.9} icon={<Target className="w-4 h-4" />} />
        <Stat label="Completed projects" value={String(summary.projects)} icon={<TrendingUp className="w-4 h-4" />} />
        <Stat label="Variance samples" value={String(summary.total_samples)} icon={<History className="w-4 h-4" />} />
        <Stat label="Products drifting" value={String(driftCount)} warn={driftCount > 0} icon={<AlertTriangle className="w-4 h-4" />} />
      </div>

      {results && (
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardTitle className="text-emerald-700 flex items-center gap-2"><Check className="w-4 h-4" /> Calibration applied — {results.length} product{results.length === 1 ? '' : 's'} updated</CardTitle>
          <div className="mt-2 space-y-1 text-sm">
            {results.length === 0 && <p className="text-slate-500">No products needed adjustment (all within tolerance).</p>}
            {results.map((r, i) => (
              <div key={i} className="text-slate-700">
                <span className="font-medium">{r.product}</span>: waste {(r.waste_old * 100).toFixed(1)}% → <span className="text-emerald-700 font-semibold">{(r.waste_new * 100).toFixed(1)}%</span>
                {r.rate_new != null && r.rate_old != null && r.rate_new !== r.rate_old && <> · rate {formatINR(r.rate_old)} → <span className="text-emerald-700 font-semibold">{formatINR(r.rate_new)}</span></>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* variance table */}
      <Card padding="none">
        <div className="p-4 border-b border-slate-200"><CardTitle>Estimated vs actual by material</CardTitle></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
              <th className="text-left px-4 py-2.5 font-medium">Material</th>
              <th className="text-right px-2 py-2.5 font-medium">Samples</th>
              <th className="text-right px-2 py-2.5 font-medium">Qty drift</th>
              <th className="text-right px-2 py-2.5 font-medium">Rate drift</th>
              <th className="text-right px-2 py-2.5 font-medium">Cost variance</th>
              <th className="text-right px-2 py-2.5 font-medium">Waste now</th>
              <th className="text-right px-4 py-2.5 font-medium">Suggested</th>
            </tr></thead>
            <tbody>
              {summary.products.map((p) => {
                const c = p.calib!;
                return (
                  <tr key={p.product_id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-slate-900">{p.name} {c.drift && <Badge variant="warning" size="sm"><AlertTriangle className="w-3 h-3 mr-0.5" />drift</Badge>}</td>
                    <td className="px-2 py-2 text-right text-slate-500 tabular-nums">{p.sample_size}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{pct(c.q_ratio - 1)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{pct(c.r_ratio - 1)}</td>
                    <td className={`px-2 py-2 text-right tabular-nums font-medium ${c.mean_variance_pct > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{pct(c.mean_variance_pct)}</td>
                    <td className="px-2 py-2 text-right text-slate-500 tabular-nums">{(c.waste_old * 100).toFixed(1)}%</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {Math.abs(c.waste_new - c.waste_old) > 0.0005
                        ? <span className="font-semibold text-indigo-600">{(c.waste_new * 100).toFixed(1)}%</span>
                        : <span className="text-slate-400">{(c.waste_new * 100).toFixed(1)}%</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-3 text-xs text-slate-400">Drift &gt; 15% flags a material for review. Calibration moves 30% toward target each run (damped) and writes versioned, audited changes.</p>
      </Card>

      {/* history */}
      {history.length > 0 && (
        <Card padding="none">
          <div className="p-4 border-b border-slate-200"><CardTitle className="flex items-center gap-2"><History className="w-4 h-4" /> Calibration history</CardTitle></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                <th className="text-left px-4 py-2 font-medium">When</th><th className="text-left px-2 py-2 font-medium">Material</th>
                <th className="text-left px-2 py-2 font-medium">Metric</th><th className="text-right px-2 py-2 font-medium">Old → New</th><th className="text-right px-4 py-2 font-medium">Samples</th>
              </tr></thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="px-4 py-1.5 text-slate-500 text-xs">{formatDate(h.run_at)}</td>
                    <td className="px-2 py-1.5 text-slate-800">{h.product}</td>
                    <td className="px-2 py-1.5"><Badge variant="default" size="sm">{h.metric === 'waste_factor' ? 'waste' : 'rate'}</Badge></td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">{fmtMetric(h.metric, h.old_value)} → <span className="font-medium">{fmtMetric(h.metric, h.new_value)}</span></td>
                    <td className="px-4 py-1.5 text-right text-slate-400 tabular-nums">{h.sample_size}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, icon, accent, warn }: { label: string; value: string; icon: React.ReactNode; accent?: boolean; warn?: boolean }) {
  return (
    <Card className="space-y-1">
      <div className="flex items-center gap-1.5 text-slate-400">{icon}<span className="text-xs uppercase tracking-wide font-medium">{label}</span></div>
      <div className={`text-2xl font-bold ${warn ? 'text-amber-600' : accent ? 'text-emerald-600' : 'text-slate-900'}`}>{value}</div>
    </Card>
  );
}
function pct(n: number) { const s = (n * 100).toFixed(1); return `${n > 0 ? '+' : ''}${s}%`; }
function fmtMetric(metric: string, v: number) { return metric === 'waste_factor' ? `${(v * 100).toFixed(1)}%` : formatINR(v); }
