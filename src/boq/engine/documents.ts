// ─────────────────────────────────────────────────────────────
// Pure document projections — one BOQ → four views (Section 10 of the design).
// No I/O. Each transform is deterministic and idempotent.
// ─────────────────────────────────────────────────────────────

export interface BoqDetailLine {
  id: string;
  description: string;
  uom: string;
  quantity: number;
  rate: number;            // cost rate
  cost_price: number;
  selling_price: number;
  margin_pct: number | null;
  gst_rate: number;
  product_id: string | null;
  sku_id: string | null;
  labour_activity_id: string | null;
  is_optional?: boolean;
}
export interface BoqDetailSection { id: string; name: string; lines: BoqDetailLine[] }
export interface BoqDetail {
  id: string; title: string; status: string; region_id: string | null;
  sections: BoqDetailSection[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const isLabour = (l: BoqDetailLine) => l.labour_activity_id != null;
export const gstAmount = (l: BoqDetailLine) => r2(l.selling_price * (l.gst_rate / 100));

// ── Customer quotation: grouped by section, selling + GST, internals hidden ──
export interface CustomerCharges { design_fees: number; supervision_fees: number; other_charges: number; discount_pct: number }
export function customerView(boq: BoqDetail, charges: CustomerCharges) {
  const sections = boq.sections.map((s) => {
    const subtotal = r2(s.lines.reduce((a, l) => a + l.selling_price, 0));
    return { name: s.name, lines: s.lines.map((l) => ({ description: l.description, qty: l.quantity, uom: l.uom, amount: l.selling_price })), subtotal };
  });
  const lineSubtotal = r2(sections.reduce((a, s) => a + s.subtotal, 0));
  const fees = r2(charges.design_fees + charges.supervision_fees + charges.other_charges);
  const preDiscount = r2(lineSubtotal + fees);
  const discount = r2(preDiscount * (charges.discount_pct / 100));
  const taxable = r2(preDiscount - discount);
  // GST computed per-line on (discounted) selling; fees taxed at 18%
  const lineGst = r2(boq.sections.flatMap((s) => s.lines).reduce((a, l) => a + gstAmount(l), 0) * (1 - charges.discount_pct / 100));
  const feeGst = r2(fees * 0.18 * (1 - charges.discount_pct / 100));
  const gst = r2(lineGst + feeGst);
  return { sections, lineSubtotal, fees, discount, taxable, gst, grand_total: r2(taxable + gst) };
}

// ── Client quote: committed scope by room + optional add-ons (toggleable) ──
export interface ClientCharges { design_fees: number; supervision_fees: number; other_charges: number; discount_pct: number }
export function clientQuoteView(boq: BoqDetail, selected: Set<string>, charges: ClientCharges) {
  const sections = boq.sections.map((s) => {
    const committed = s.lines.filter((l) => !l.is_optional);
    return {
      name: s.name,
      lines: committed.map((l) => ({ description: l.description, qty: l.quantity, uom: l.uom, amount: l.selling_price })),
      subtotal: r2(committed.reduce((a, l) => a + l.selling_price, 0)),
    };
  }).filter((s) => s.lines.length > 0);

  const optionals = boq.sections.flatMap((s) =>
    s.lines.filter((l) => l.is_optional).map((l) => ({
      id: l.id, section: s.name, description: l.description, qty: l.quantity, uom: l.uom,
      amount: l.selling_price, gst: gstAmount(l), selected: selected.has(l.id),
    })));

  const committedLines = boq.sections.flatMap((s) => s.lines.filter((l) => !l.is_optional));
  const itemsSubtotal = r2(sections.reduce((a, s) => a + s.subtotal, 0));
  const selectedOptionals = optionals.filter((o) => o.selected);
  const optionalsSubtotal = r2(selectedOptionals.reduce((a, o) => a + o.amount, 0));
  const fees = r2(charges.design_fees + charges.supervision_fees + charges.other_charges);
  const preDiscount = r2(itemsSubtotal + optionalsSubtotal + fees);
  const discount = r2(preDiscount * (charges.discount_pct / 100));
  const taxable = r2(preDiscount - discount);

  const baseGst = committedLines.reduce((a, l) => a + gstAmount(l), 0)
    + selectedOptionals.reduce((a, o) => a + o.gst, 0)
    + fees * 0.18;
  const gst = r2(baseGst * (1 - charges.discount_pct / 100));

  return { sections, optionals, itemsSubtotal, optionalsSubtotal, fees, discount, taxable, gst, grand_total: r2(taxable + gst) };
}

// ── Internal costing sheet: cost, sell, margin per line + rollup ──
export function costingView(boq: BoqDetail) {
  const sections = boq.sections.map((s) => ({
    name: s.name,
    lines: s.lines.map((l) => ({
      description: l.description, qty: l.quantity, uom: l.uom,
      cost_rate: l.rate, cost: l.cost_price, sell: l.selling_price, margin_pct: l.margin_pct ?? 0, is_labour: isLabour(l),
    })),
    cost: r2(s.lines.reduce((a, l) => a + l.cost_price, 0)),
    sell: r2(s.lines.reduce((a, l) => a + l.selling_price, 0)),
  }));
  const cost = r2(sections.reduce((a, s) => a + s.cost, 0));
  const sell = r2(sections.reduce((a, s) => a + s.sell, 0));
  return { sections, cost, sell, gross_margin: r2(sell - cost), margin_pct: sell > 0 ? r2(((sell - cost) / sell) * 100) : 0 };
}

// ── Procurement sheet: material lines aggregated across all sections ──
export interface ProcRow { key: string; description: string; uom: string; quantity: number; rate: number; amount: number; sku_id: string | null; product_id: string | null }
export function procurementView(boq: BoqDetail): { rows: ProcRow[]; total: number } {
  const map = new Map<string, ProcRow>();
  for (const s of boq.sections) {
    for (const l of s.lines) {
      if (isLabour(l)) continue; // procurement = materials/hardware only
      const key = l.sku_id || l.product_id || `${l.description}|${l.uom}`;
      const existing = map.get(key);
      if (existing) {
        existing.quantity = r2(existing.quantity + l.quantity);
        existing.amount = r2(existing.amount + l.cost_price);
      } else {
        map.set(key, { key, description: stripBrand(l.description), uom: l.uom, quantity: l.quantity, rate: l.rate, amount: l.cost_price, sku_id: l.sku_id, product_id: l.product_id });
      }
    }
  }
  const rows = [...map.values()].sort((a, b) => b.amount - a.amount);
  return { rows, total: r2(rows.reduce((a, r) => a + r.amount, 0)) };
}

// ── Vendor RFQ: procurement list WITHOUT prices ──
export function rfqView(boq: BoqDetail) {
  return procurementView(boq).rows.map((r) => ({ description: r.description, uom: r.uom, quantity: Math.ceil(r.quantity), sku_id: r.sku_id }));
}

function stripBrand(desc: string): string {
  const i = desc.indexOf(' — ');
  return i >= 0 ? desc.slice(0, i) : desc;
}
