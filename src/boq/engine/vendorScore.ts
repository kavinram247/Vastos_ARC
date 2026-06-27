// ─────────────────────────────────────────────────────────────
// Vendor scoring + procurement recommendation (Section 7).
// Pure functions over performance history. Recent orders weighted higher.
// ─────────────────────────────────────────────────────────────

export interface PerfRow {
  promised_days: number | null;
  actual_days: number | null;
  qty_ordered: number | null;
  qty_defective: number | null;
  price_at_order: number | null;
  market_price: number | null;
  recorded_at: string;
}

export interface VendorScore { cost: number; delivery: number; quality: number; reliability: number; overall: number; samples: number }

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);
const r1 = (n: number) => Math.round(n * 10) / 10;

// time-decay weight: ~140-day half-life
function decay(recordedAt: string, now = Date.now()): number {
  const ageDays = Math.max(0, (now - new Date(recordedAt).getTime()) / 86400000);
  return Math.exp(-0.005 * ageDays);
}

export function computeVendorScore(rows: PerfRow[]): VendorScore | null {
  if (!rows || rows.length === 0) return null;
  let wSum = 0, deliverySum = 0, costSum = 0, onTime = 0;
  let ordered = 0, defective = 0;
  for (const r of rows) {
    const w = decay(r.recorded_at);
    wSum += w;
    // delivery: promised/actual capped at 1 (early = on-time = 1.0)
    if (r.promised_days && r.actual_days) deliverySum += w * clamp(r.promised_days / r.actual_days, 0, 1);
    // cost: price vs market mapped 0.8→100 … 1.0→50 … 1.2→0
    if (r.price_at_order && r.market_price) {
      const ratio = r.price_at_order / r.market_price;
      costSum += w * clamp(1 - (ratio - 0.8) / 0.4, 0, 1);
    }
    if (r.actual_days != null && r.promised_days != null && r.actual_days <= r.promised_days) onTime += w;
    ordered += Number(r.qty_ordered || 0);
    defective += Number(r.qty_defective || 0);
  }
  const delivery = 100 * (deliverySum / wSum);
  const cost = 100 * (costSum / wSum);
  const quality = 100 * (1 - (ordered > 0 ? defective / ordered : 0));
  const reliability = 100 * (onTime / wSum);
  const overall = 0.30 * cost + 0.25 * delivery + 0.30 * quality + 0.15 * reliability;
  return { cost: r1(cost), delivery: r1(delivery), quality: r1(quality), reliability: r1(reliability), overall: r1(overall), samples: rows.length };
}

// ── Procurement recommendation ──
export type Priority = 'balanced' | 'speed' | 'margin' | 'quality';

export interface VendorCandidate {
  vendor_id: string;
  company_name: string;
  price: number;
  lead_time_days: number;
  moq: number | null;
  score: VendorScore | null;
}
export interface RankedVendor extends VendorCandidate { weighted: number; feasible: boolean; reason: string }

const WEIGHTS: Record<Priority, { cost: number; delivery: number; quality: number; reliability: number }> = {
  balanced: { cost: 0.30, delivery: 0.25, quality: 0.30, reliability: 0.15 },
  speed: { cost: 0.20, delivery: 0.50, quality: 0.20, reliability: 0.10 },
  margin: { cost: 0.55, delivery: 0.15, quality: 0.20, reliability: 0.10 },
  quality: { cost: 0.15, delivery: 0.20, quality: 0.50, reliability: 0.15 },
};

export function rankVendors(
  candidates: VendorCandidate[], priority: Priority, qtyNeeded: number, daysUntilRequired: number | null,
): RankedVendor[] {
  const w = WEIGHTS[priority];
  return candidates.map((c) => {
    const s = c.score || { cost: 50, delivery: 50, quality: 50, reliability: 50, overall: 50, samples: 0 };
    const weighted = w.cost * s.cost + w.delivery * s.delivery + w.quality * s.quality + w.reliability * s.reliability;
    const leadOk = daysUntilRequired == null || c.lead_time_days <= daysUntilRequired;
    const moqOk = c.moq == null || qtyNeeded >= c.moq;
    const reasons: string[] = [];
    if (!leadOk) reasons.push(`lead ${c.lead_time_days}d > ${daysUntilRequired}d needed`);
    if (!moqOk) reasons.push(`below MOQ ${c.moq}`);
    return { ...c, weighted: r1(weighted), feasible: leadOk && moqOk, reason: reasons.join('; ') };
  }).sort((a, b) => {
    if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
    return b.weighted - a.weighted;
  });
}
