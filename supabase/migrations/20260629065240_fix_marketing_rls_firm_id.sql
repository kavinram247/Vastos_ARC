
-- Drop permission-header-based policies on all 8 marketing tables
-- Replace with firm_id = current_firm_id() (same reliable pattern as crm_roles, crm_role_permissions, etc.)

-- crm_ad_accounts
DROP POLICY IF EXISTS crm_ad_accounts_perm_sel ON crm_ad_accounts;
DROP POLICY IF EXISTS crm_ad_accounts_perm_mod ON crm_ad_accounts;
CREATE POLICY crm_ad_accounts_sel ON crm_ad_accounts FOR SELECT TO authenticated USING (firm_id = current_firm_id());
CREATE POLICY crm_ad_accounts_mod ON crm_ad_accounts FOR ALL TO authenticated USING (firm_id = current_firm_id()) WITH CHECK (firm_id = current_firm_id());

-- crm_ad_campaigns
DROP POLICY IF EXISTS crm_ad_campaigns_perm_sel ON crm_ad_campaigns;
DROP POLICY IF EXISTS crm_ad_campaigns_perm_mod ON crm_ad_campaigns;
CREATE POLICY crm_ad_campaigns_sel ON crm_ad_campaigns FOR SELECT TO authenticated USING (firm_id = current_firm_id());
CREATE POLICY crm_ad_campaigns_mod ON crm_ad_campaigns FOR ALL TO authenticated USING (firm_id = current_firm_id()) WITH CHECK (firm_id = current_firm_id());

-- crm_ad_sets
DROP POLICY IF EXISTS crm_ad_sets_perm_sel ON crm_ad_sets;
DROP POLICY IF EXISTS crm_ad_sets_perm_mod ON crm_ad_sets;
CREATE POLICY crm_ad_sets_sel ON crm_ad_sets FOR SELECT TO authenticated USING (firm_id = current_firm_id());
CREATE POLICY crm_ad_sets_mod ON crm_ad_sets FOR ALL TO authenticated USING (firm_id = current_firm_id()) WITH CHECK (firm_id = current_firm_id());

-- crm_ads
DROP POLICY IF EXISTS crm_ads_perm_sel ON crm_ads;
DROP POLICY IF EXISTS crm_ads_perm_mod ON crm_ads;
CREATE POLICY crm_ads_sel ON crm_ads FOR SELECT TO authenticated USING (firm_id = current_firm_id());
CREATE POLICY crm_ads_mod ON crm_ads FOR ALL TO authenticated USING (firm_id = current_firm_id()) WITH CHECK (firm_id = current_firm_id());

-- crm_ad_insights
DROP POLICY IF EXISTS crm_ad_insights_perm_sel ON crm_ad_insights;
DROP POLICY IF EXISTS crm_ad_insights_perm_mod ON crm_ad_insights;
CREATE POLICY crm_ad_insights_sel ON crm_ad_insights FOR SELECT TO authenticated USING (firm_id = current_firm_id());
CREATE POLICY crm_ad_insights_mod ON crm_ad_insights FOR ALL TO authenticated USING (firm_id = current_firm_id()) WITH CHECK (firm_id = current_firm_id());

-- crm_ad_leads
DROP POLICY IF EXISTS crm_ad_leads_perm_sel ON crm_ad_leads;
DROP POLICY IF EXISTS crm_ad_leads_perm_mod ON crm_ad_leads;
CREATE POLICY crm_ad_leads_sel ON crm_ad_leads FOR SELECT TO authenticated USING (firm_id = current_firm_id());
CREATE POLICY crm_ad_leads_mod ON crm_ad_leads FOR ALL TO authenticated USING (firm_id = current_firm_id()) WITH CHECK (firm_id = current_firm_id());

-- crm_marketing_attribution
DROP POLICY IF EXISTS crm_marketing_attribution_perm_sel ON crm_marketing_attribution;
DROP POLICY IF EXISTS crm_marketing_attribution_perm_mod ON crm_marketing_attribution;
CREATE POLICY crm_marketing_attribution_sel ON crm_marketing_attribution FOR SELECT TO authenticated USING (firm_id = current_firm_id());
CREATE POLICY crm_marketing_attribution_mod ON crm_marketing_attribution FOR ALL TO authenticated USING (firm_id = current_firm_id()) WITH CHECK (firm_id = current_firm_id());

-- crm_sync_runs
DROP POLICY IF EXISTS crm_sync_runs_perm_sel ON crm_sync_runs;
DROP POLICY IF EXISTS crm_sync_runs_perm_mod ON crm_sync_runs;
CREATE POLICY crm_sync_runs_sel ON crm_sync_runs FOR SELECT TO authenticated USING (firm_id = current_firm_id());
CREATE POLICY crm_sync_runs_mod ON crm_sync_runs FOR ALL TO authenticated USING (firm_id = current_firm_id()) WITH CHECK (firm_id = current_firm_id());
