// Meta lead → CRM lead mapping with dedup. Mirrors the lead-intake edge function:
// match an existing contact by email/phone (returning customer), prevent duplicate
// CRM leads, and keep the marketing attribution row in sync. Used by the "Map to
// CRM" action on unmapped ad leads.
import { supabase } from '../lib/supabase';
import { store } from '../data/store';
import type { AdLead } from './types';

const sb = supabase as any;

export interface MapResult {
  status: 'mapped' | 'duplicate';
  crmLeadId: string;
  returning: boolean;
}

/** Map one provider ad-lead into the CRM, deduping against existing contacts/leads. */
export async function mapAdLeadToCrm(adLead: AdLead, firmId: string): Promise<MapResult> {
  const name = adLead.full_name || 'Unknown';
  const email = adLead.email || null;
  const phone = adLead.phone || null;

  // returning-customer match
  const contact = store.findContact(firmId, email, phone);
  const contactId = contact?.id
    ?? store.addContact({ firm_id: firmId, full_name: name, email, phone }).id;
  const returning = !!contact;

  // duplicate guard — an open CRM lead already tied to this contact?
  const existingLead = store.leads.find(l => l.firm_id === firmId && l.contact_id === contactId);

  let crmLeadId: string;
  let status: 'mapped' | 'duplicate';
  if (existingLead) {
    crmLeadId = existingLead.id;
    status = 'duplicate';
    // record the re-enquiry on the existing lead
    store.addLeadInteraction({
      firm_id: firmId, lead_id: existingLead.id, type: 'other',
      subject: 'Re-enquiry from Meta ad', description: `New ad lead from ${adLead.raw_fields?.campaign || 'Meta'}.`,
      logged_by: 'system', channel: 'meta', direction: 'inbound', contact_id: contactId,
    });
  } else {
    const firstStage = store.pipelineStages
      .filter(s => s.firm_id === firmId && s.category === 'active')
      .sort((a, b) => a.order_index - b.order_index)[0];
    const lead = store.addLead({
      firm_id: firmId, client_name: name, client_email: email || undefined, client_phone: phone || '',
      project_type: String(adLead.raw_fields?.campaign || 'Meta enquiry'),
      status: (firstStage?.key as any) || 'new', source: 'social_media', priority: 'medium',
      inquiry_date: (adLead.received_at || new Date().toISOString()).slice(0, 10),
      contact_id: contactId, created_by: 'meta',
    } as any);
    crmLeadId = lead.id;
    status = 'mapped';
  }

  // persist the ad-lead mapping + attribution link
  await sb.from('crm_ad_leads').update({ crm_lead_id: crmLeadId, contact_id: contactId, status }).eq('id', adLead.id);
  await sb.from('crm_marketing_attribution')
    .update({ lead_id: crmLeadId, stage: status === 'duplicate' ? 'qualified' : 'lead', updated_at: new Date().toISOString() })
    .eq('ad_lead_id', adLead.id);

  return { status, crmLeadId, returning };
}
