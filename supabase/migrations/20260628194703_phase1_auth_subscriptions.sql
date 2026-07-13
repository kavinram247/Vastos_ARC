
-- ── Subscription plans catalog ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  price_monthly numeric(10,2) NOT NULL DEFAULT 0,
  price_annual  numeric(10,2) NOT NULL DEFAULT 0,
  module_keys   jsonb NOT NULL DEFAULT '[]'::jsonb,
  max_users     int,
  max_projects  int,
  storage_gb    int,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Firm subscriptions ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.firm_subscriptions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id                 uuid NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  plan_id                 uuid NOT NULL REFERENCES public.subscription_plans(id),
  status                  text NOT NULL DEFAULT 'trial',
  trial_ends_at           timestamptz,
  current_period_ends_at  timestamptz,
  seats_purchased         int NOT NULL DEFAULT 3,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT firm_subscriptions_status_check CHECK (status IN ('trial','active','suspended','cancelled'))
);
CREATE UNIQUE INDEX IF NOT EXISTS firm_subscriptions_firm_id_idx ON public.firm_subscriptions(firm_id);

-- ── User invites ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_invites (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id      uuid NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  email        text NOT NULL,
  full_name    text,
  role_id      text,
  invited_by   uuid,
  token        text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at   timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── Seed the four plan tiers ──────────────────────────────────
INSERT INTO public.subscription_plans (name, price_monthly, price_annual, module_keys, max_users, max_projects, storage_gb) VALUES
  ('Starter',      999,   9990,
   '["dashboard","leads","projects","tasks","attendance","client-portal"]',
   3, 5, 1),
  ('Professional', 2999,  29990,
   '["dashboard","leads","projects","tasks","attendance","client-portal","quotations","boq","catalog","vendors"]',
   10, 25, 10),
  ('Growth',       5999,  59990,
   '["dashboard","leads","projects","tasks","attendance","client-portal","quotations","boq","catalog","vendors","marketing","telephony","calibration"]',
   25, NULL, 50),
  ('Enterprise',   12999, 129990,
   '["dashboard","leads","projects","tasks","attendance","client-portal","quotations","boq","catalog","vendors","marketing","telephony","calibration"]',
   NULL, NULL, NULL)
ON CONFLICT DO NOTHING;

-- ── Give the demo firm an active Enterprise subscription ──────
INSERT INTO public.firm_subscriptions (firm_id, plan_id, status, trial_ends_at)
SELECT '11111111-1111-4111-8111-111111111111', id, 'active', NULL
FROM public.subscription_plans WHERE name = 'Enterprise'
ON CONFLICT (firm_id) DO NOTHING;

-- ── Enable RLS on new tables (anon dev policies) ──────────────
ALTER TABLE public.subscription_plans   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.firm_subscriptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_invites         ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_dev_subscription_plans"  ON public.subscription_plans  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_dev_firm_subscriptions"  ON public.firm_subscriptions  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_dev_user_invites"        ON public.user_invites        FOR ALL TO anon USING (true) WITH CHECK (true);
