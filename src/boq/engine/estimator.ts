// ─────────────────────────────────────────────────────────────
// Deterministic Quantity + Pricing engine.
// Pure functions: (template, rules, params, pricing context) → BOQ lines.
// No I/O, no AI. Every line carries a derivation trace for auditability.
// ─────────────────────────────────────────────────────────────
import { evalNumber, evalCondition, type Scope, type Scalar } from './dsl';

export type Grade = 'economy' | 'standard' | 'premium' | 'luxury';
const GRADE_ORDER: Grade[] = ['economy', 'standard', 'premium', 'luxury'];

export interface DerivedVar { name: string; formula: string }

export interface TemplateDef {
  id: string;
  code: string;
  name: string;
  category: string;
  param_schema: Record<string, any>;
  derived_vars: DerivedVar[];
}

export interface RuleDef {
  id: string;
  seq: number;
  output_kind: 'material' | 'labour' | 'hardware' | 'service';
  product_id: string | null;
  labour_activity_id: string | null;
  label: string;
  condition: string | null;
  qty_formula: string;
  uom: string;
}

export interface ProductInfo {
  id: string;
  name: string;
  base_uom: string;
  waste_factor: number;
  packaging_loss: number;
  install_loss: number;
  gst_rate: number;
}

export interface MaterialRate { sku_id: string; brand: string | null; grade: Grade; rate: number }
export interface RegionIndices { material_index: number; labour_index: number; logistics_index: number; availability_risk: number }
export interface MarginPolicy { target_margin_pct: number; margin_floor_pct: number; overhead_pct: number }

export interface PricingContext {
  region: RegionIndices;
  margin: MarginPolicy;
  /** product_id → available SKU rates (any grade), cost per base_uom (national). */
  materialRates: Map<string, MaterialRate[]>;
  /** labour_activity_id → national cost rate per uom. */
  labourRates: Map<string, number>;
  /** product_id → product meta (losses, gst, uom). */
  products: Map<string, ProductInfo>;
  /** labour_activity_id → display name. */
  labourNames: Map<string, string>;
}

export interface EstimatedLine {
  rule_id: string;
  output_kind: RuleDef['output_kind'];
  product_id: string | null;
  sku_id: string | null;
  labour_activity_id: string | null;
  description: string;
  uom: string;
  base_quantity: number;
  quantity: number;       // after losses
  rate: number;           // cost rate after region index
  cost_price: number;
  selling_price: number;
  margin_pct: number;
  gst_rate: number;
  gst_amount: number;
  derivation: Record<string, Scalar | null>;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10000) / 10000;

/** Pick the SKU rate that best matches the requested grade (exact, else nearest lower, else nearest). */
export function pickRate(rates: MaterialRate[], grade: Grade): MaterialRate | null {
  if (!rates || rates.length === 0) return null;
  const exact = rates.find((r) => r.grade === grade);
  if (exact) return exact;
  const wantIdx = GRADE_ORDER.indexOf(grade);
  // nearest by grade distance, preferring lower grade on ties
  return [...rates].sort((a, b) => {
    const da = Math.abs(GRADE_ORDER.indexOf(a.grade) - wantIdx);
    const db = Math.abs(GRADE_ORDER.indexOf(b.grade) - wantIdx);
    if (da !== db) return da - db;
    return GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade);
  })[0];
}

/** Build the evaluation scope: params + grade + derived vars (evaluated in order). */
export function buildScope(template: TemplateDef, params: Record<string, Scalar>, grade: Grade): Scope {
  const scope: Scope = { ...params, grade };
  // fill schema defaults for any missing param
  for (const [k, def] of Object.entries(template.param_schema || {})) {
    if (!(k in scope) && def && typeof def === 'object' && 'default' in def) {
      scope[k] = (def as any).default as Scalar;
    }
  }
  for (const dv of template.derived_vars || []) {
    scope[dv.name] = round4(evalNumber(dv.formula, scope));
  }
  return scope;
}

/** Generate priced BOQ lines for one module instance. */
export function estimateModule(
  template: TemplateDef,
  rules: RuleDef[],
  params: Record<string, Scalar>,
  grade: Grade,
  ctx: PricingContext,
): EstimatedLine[] {
  const scope = buildScope(template, params, grade);
  const lines: EstimatedLine[] = [];

  for (const rule of [...rules].sort((a, b) => a.seq - b.seq)) {
    if (!evalCondition(rule.condition, scope)) continue;
    const baseQty = round4(evalNumber(rule.qty_formula, scope));
    if (baseQty <= 0) continue;

    if (rule.output_kind === 'labour') {
      const baseRate = ctx.labourRates.get(rule.labour_activity_id || '');
      if (baseRate == null) continue;
      const costRate = round4(baseRate * ctx.region.labour_index);
      lines.push(priceLine({
        rule, baseQty, effectiveQty: baseQty, costRate,
        gstRate: 18, ctx,
        product_id: null, sku_id: null, labour_activity_id: rule.labour_activity_id,
        description: rule.label,
        losses: { waste: 0, packaging: 0, install: 0 },
        regionFactor: ctx.region.labour_index,
        scope,
      }));
      continue;
    }

    // material / hardware
    const prod = ctx.products.get(rule.product_id || '');
    if (!prod) continue;
    const rate = pickRate(ctx.materialRates.get(rule.product_id || '') || [], grade);
    if (!rate) continue;
    // three-factor loss model (Section 3) — quantity-side, materials only
    const lossMult = (1 + prod.waste_factor) * (1 + prod.packaging_loss) * (1 + prod.install_loss);
    const effectiveQty = round4(baseQty * lossMult);
    // availability_risk is a PRICE surcharge (Section 8), not a quantity inflator
    const regionFactor = round4(ctx.region.material_index * (1 + ctx.region.availability_risk));
    const costRate = round4(rate.rate * regionFactor);
    lines.push(priceLine({
      rule, baseQty, effectiveQty, costRate,
      gstRate: prod.gst_rate, ctx,
      product_id: prod.id, sku_id: rate.sku_id, labour_activity_id: null,
      description: `${rule.label}${rate.brand ? ` — ${rate.brand}` : ''}`,
      losses: { waste: prod.waste_factor, packaging: prod.packaging_loss, install: prod.install_loss },
      regionFactor,
      scope,
    }));
  }
  return lines;
}

function priceLine(args: {
  rule: RuleDef; baseQty: number; effectiveQty: number; costRate: number; gstRate: number;
  ctx: PricingContext; product_id: string | null; sku_id: string | null; labour_activity_id: string | null;
  description: string; losses: { waste: number; packaging: number; install: number }; regionFactor: number; scope: Scope;
}): EstimatedLine {
  const { rule, baseQty, effectiveQty, costRate, gstRate, ctx, losses, regionFactor } = args;
  const lineCostRaw = effectiveQty * costRate;
  const overhead = ctx.margin.overhead_pct / 100;
  const costPrice = round2(lineCostRaw * (1 + overhead));

  // Selling price: margin ON selling price, enforced against floor.
  const targetM = ctx.margin.target_margin_pct / 100;
  const floorM = ctx.margin.margin_floor_pct / 100;
  const m = Math.max(targetM, floorM);
  const sellingPrice = round2(costPrice / (1 - m));
  const marginPct = sellingPrice > 0 ? round2(((sellingPrice - costPrice) / sellingPrice) * 100) : 0;
  const gstAmount = round2(sellingPrice * (gstRate / 100));

  return {
    rule_id: rule.id,
    output_kind: rule.output_kind,
    product_id: args.product_id,
    sku_id: args.sku_id,
    labour_activity_id: args.labour_activity_id,
    description: args.description,
    uom: rule.uom,
    base_quantity: baseQty,
    quantity: effectiveQty,
    rate: costRate,
    cost_price: costPrice,
    selling_price: sellingPrice,
    margin_pct: marginPct,
    gst_rate: gstRate,
    gst_amount: gstAmount,
    derivation: {
      formula: rule.qty_formula,
      base_qty: baseQty,
      waste: losses.waste,
      packaging: losses.packaging,
      install: losses.install,
      region_factor: regionFactor,
      cost_rate: costRate,
      overhead_pct: ctx.margin.overhead_pct,
      margin_pct: marginPct,
    },
  };
}

/** Re-price a line after a manual edit (qty / cost-rate). Treats quantity as final
 *  (the estimator already applied losses); applies overhead + margin floor + GST. */
export function priceLineValues(
  quantity: number, rate: number, gstRate: number, margin: MarginPolicy,
): { cost_price: number; selling_price: number; margin_pct: number; gst_amount: number } {
  const overhead = margin.overhead_pct / 100;
  const cost_price = round2(quantity * rate * (1 + overhead));
  const m = Math.max(margin.target_margin_pct, margin.margin_floor_pct) / 100;
  const selling_price = round2(cost_price / (1 - m));
  const margin_pct = selling_price > 0 ? round2(((selling_price - cost_price) / selling_price) * 100) : 0;
  const gst_amount = round2(selling_price * (gstRate / 100));
  return { cost_price, selling_price, margin_pct, gst_amount };
}

export interface BoqTotals {
  cost_price: number; selling_price: number; gst: number; grand_total: number; margin_pct: number;
}
export function rollup(lines: EstimatedLine[]): BoqTotals {
  const cost = round2(lines.reduce((s, l) => s + l.cost_price, 0));
  const sell = round2(lines.reduce((s, l) => s + l.selling_price, 0));
  const gst = round2(lines.reduce((s, l) => s + l.gst_amount, 0));
  return {
    cost_price: cost,
    selling_price: sell,
    gst,
    grand_total: round2(sell + gst),
    margin_pct: sell > 0 ? round2(((sell - cost) / sell) * 100) : 0,
  };
}
