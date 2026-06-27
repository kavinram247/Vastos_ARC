// ─────────────────────────────────────────────────────────────
// Quotation data access — load a saved BOQ in full, persist quotation projections.
// ─────────────────────────────────────────────────────────────
import { supabase, DEMO_FIRM_ID } from '../lib/supabase';
import type { BoqDetail, BoqDetailLine } from './engine/documents';

export async function fetchBoqDetail(boqId: string): Promise<BoqDetail> {
  const [{ data: doc, error: ed }, { data: sections, error: es }, { data: lines, error: el }] = await Promise.all([
    supabase.from('boq_documents').select('id,title,status,region_id').eq('id', boqId).single(),
    supabase.from('boq_sections').select('id,name,order_index').eq('boq_id', boqId).order('order_index'),
    supabase.from('boq_line_items').select('id,section_id,description,uom,quantity,rate,cost_price,selling_price,margin_pct,gst_rate,product_id,sku_id,labour_activity_id,is_optional,order_index').eq('boq_id', boqId).order('order_index'),
  ]);
  for (const e of [ed, es, el]) if (e) throw e;

  const bySection = new Map<string, BoqDetailLine[]>();
  for (const l of (lines || []) as any[]) {
    const arr = bySection.get(l.section_id) || [];
    arr.push({
      id: l.id, description: l.description, uom: l.uom,
      quantity: Number(l.quantity), rate: Number(l.rate), cost_price: Number(l.cost_price),
      selling_price: Number(l.selling_price), margin_pct: l.margin_pct == null ? null : Number(l.margin_pct),
      gst_rate: Number(l.gst_rate), product_id: l.product_id, sku_id: l.sku_id, labour_activity_id: l.labour_activity_id,
      is_optional: !!l.is_optional,
    });
    bySection.set(l.section_id, arr);
  }
  const d = doc as any;
  return {
    id: d.id, title: d.title, status: d.status, region_id: d.region_id,
    sections: (sections || []).map((s: any) => ({ id: s.id, name: s.name, lines: bySection.get(s.id) || [] })),
  };
}

async function nextQuotationNumber(firmId: string): Promise<string> {
  const { count } = await supabase.from('quotations').select('id', { count: 'exact', head: true }).eq('firm_id', firmId);
  const year = new Date().getFullYear();
  return `QT-${year}-${String((count || 0) + 1).padStart(3, '0')}`;
}

export interface SaveQuotationInput {
  boqId: string;
  boqVersion?: number;
  docType: 'customer' | 'internal_costing' | 'procurement' | 'vendor_rfq';
  design_fees?: number;
  supervision_fees?: number;
  other_charges?: number;
  discount_pct?: number;
  subtotal: number;
  gst_amount: number;
  total_amount: number;
  snapshot: any;
}

export interface SavedQuotation { id: string; quotation_number: string; share_token: string }

export async function saveQuotation(input: SaveQuotationInput, firmId = DEMO_FIRM_ID): Promise<SavedQuotation> {
  const number = await nextQuotationNumber(firmId);
  const { data, error } = await supabase.from('quotations').insert({
    firm_id: firmId, boq_id: input.boqId, boq_version: input.boqVersion ?? 1,
    doc_type: input.docType, quotation_number: number, version: 1,
    design_fees: input.design_fees ?? 0, supervision_fees: input.supervision_fees ?? 0,
    other_charges: input.other_charges ?? 0, discount_pct: input.discount_pct ?? 0,
    subtotal: input.subtotal, gst_amount: input.gst_amount, total_amount: input.total_amount,
    status: 'draft', snapshot: input.snapshot,
  } as any).select('id,quotation_number,share_token').single();
  if (error) throw error;
  return data as any as SavedQuotation;
}

export async function listQuotations(firmId = DEMO_FIRM_ID) {
  const { data, error } = await supabase.from('quotations')
    .select('id,quotation_number,doc_type,total_amount,status,created_at,boq_id')
    .eq('firm_id', firmId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
