-- ════════════════════════════════════════════════════════════════════════
-- INVENTORY & PROCUREMENT — Migration A: ledger foundation, helpers, balances
-- Ledger-first design. stock_movements is the immutable source of truth.
-- All writes go through SECURITY DEFINER inv_* RPCs (later migrations) that
-- resolve firm/user/role from auth.uid() and never trust client-provided ids.
-- ════════════════════════════════════════════════════════════════════════

-- ── New enums ──────────────────────────────────────────────────────────────
do $$ begin
  create type movement_type as enum (
    'opening_balance','purchase_receipt','site_consumption','reservation',
    'reservation_release','transfer_out','transfer_in','supplier_return',
    'write_off','positive_adjustment','negative_adjustment','reversal');
exception when duplicate_object then null; end $$;

do $$ begin
  create type movement_class as enum ('physical','reserved');
exception when duplicate_object then null; end $$;

do $$ begin
  create type mr_status as enum (
    'draft','submitted','approved','in_procurement','partially_ordered',
    'ordered','fulfilled','rejected','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type rfq_status as enum (
    'draft','sent','quotes_received','evaluated','awarded','closed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type grn_status as enum ('draft','posted','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type transfer_status as enum ('draft','dispatched','received','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type adjustment_status as enum (
    'draft','pending_approval','approved','posted','rejected','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type count_status as enum ('draft','counting','posted','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type consumption_status as enum ('draft','posted','cancelled');
exception when duplicate_object then null; end $$;

-- Extend the existing PO lifecycle enum (values USED only in later migrations,
-- satisfying Postgres' "added enum value not usable in same tx" rule).
alter type po_status add value if not exists 'pending_approval';
alter type po_status add value if not exists 'approved';
alter type po_status add value if not exists 'needs_changes';

-- ── Concurrency-safe per-firm document numbering ───────────────────────────
create table if not exists inventory_number_seq (
  firm_id  uuid  not null,
  doc_type text  not null,
  next_val bigint not null default 1,
  primary key (firm_id, doc_type)
);
alter table inventory_number_seq enable row level security;

create or replace function inv_next_number(p_firm uuid, p_doc text, p_prefix text)
returns text language plpgsql security definer set search_path = 'public' as $$
declare v bigint;
begin
  insert into inventory_number_seq (firm_id, doc_type, next_val)
    values (p_firm, p_doc, 1)
  on conflict (firm_id, doc_type)
    do update set next_val = inventory_number_seq.next_val + 1
  returning next_val into v;
  return p_prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(v::text, 4, '0');
end $$;

-- ── Actor resolution (real firm/user/role from the auth session) ───────────
-- Returns the CRM identity of the logged-in user. profile_id = crm_profiles.id
-- (the id space used by crm_notifications.user_id / project team). Never trusts
-- any client-supplied firm/role.
create or replace function inv_current_actor()
returns table(firm_id uuid, profile_id text, role_id text, is_admin boolean, full_name text)
language sql stable security definer set search_path = 'public' as $$
  with p as (
    select pr.firm_id, pr.email, pr.full_name, pr.role
    from profiles pr where pr.auth_uid = auth.uid() limit 1
  )
  select p.firm_id,
         cp.id::text,
         cp.role_id::text,
         coalesce(r.is_admin, p.role = 'owner'),
         p.full_name
  from p
  left join crm_profiles cp on cp.email = p.email and cp.firm_id = p.firm_id
  left join crm_roles r on r.id = cp.role_id;
$$;

-- Raises if the current user may not perform (module, action). Firm owners and
-- admin roles always pass; everyone else must have an explicit grant.
create or replace function inv_require(p_module text, p_action text)
returns void language plpgsql stable security definer set search_path = 'public' as $$
declare a record;
begin
  select * into a from inv_current_actor();
  if a.firm_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if a.is_admin then return; end if;
  if a.role_id is not null and exists (
    select 1 from crm_role_permissions rp
    where rp.role_id = a.role_id and rp.module = p_module and p_action = any(rp.actions)
  ) then return; end if;
  raise exception 'permission denied: % on %', p_action, p_module using errcode = '42501';
end $$;

-- ── UOM integrity: convert an entered qty into the SKU's canonical base uom ─
-- Convention: catalog_products.uom_conversion = number of base_uom units per 1
-- secondary_uom unit. Any other uom is rejected — no silent aggregation of
-- incompatible units (Cft / Nos / Bag / Kg …).
create or replace function inv_to_base(p_sku uuid, p_qty numeric, p_uom uom)
returns numeric language plpgsql stable security definer set search_path = 'public' as $$
declare base uom; sec uom; conv numeric;
begin
  select cp.base_uom, cp.secondary_uom, coalesce(cp.uom_conversion, 0)
    into base, sec, conv
  from product_skus s join catalog_products cp on cp.id = s.product_id
  where s.id = p_sku;
  if base is null then raise exception 'unknown sku %', p_sku using errcode = '23503'; end if;
  if p_uom = base then return p_qty; end if;
  if sec is not null and p_uom = sec then
    if conv is null or conv = 0 then
      raise exception 'sku % has no uom conversion defined for % -> %', p_sku, sec, base using errcode = '22023';
    end if;
    return p_qty * conv;
  end if;
  raise exception 'uom % is not compatible with sku canonical uom % (allowed: %, %)',
    p_uom, base, base, coalesce(sec::text, '—') using errcode = '22023';
end $$;

-- ── The immutable stock movement ledger ────────────────────────────────────
create table if not exists stock_movements (
  id             uuid primary key default gen_random_uuid(),
  firm_id        uuid not null references firms(id) on delete cascade,
  project_id     text not null references crm_projects(id) on delete cascade,
  location       text,
  sku_id         uuid not null references product_skus(id),
  movement_type  movement_type not null,
  movement_class movement_class not null,
  qty            numeric not null check (qty > 0),      -- original entered magnitude
  uom            uom not null,                          -- original entered uom
  qty_base       numeric not null,                      -- signed delta in canonical base uom
  unit_cost      numeric,                               -- for valuation (optional)
  ref_type       text,                                  -- grn|consumption|transfer|adjustment|count|reservation|opening|reversal
  ref_id         uuid,
  ref_line_id    uuid,
  counterparty_project text references crm_projects(id),-- for transfers
  batch_ref      text,
  reverses_id    uuid references stock_movements(id),   -- populated for reversal rows
  idempotency_key text,
  note           text,
  posted_by      text,                                  -- crm_profiles.id
  posted_by_name text,
  created_at     timestamptz not null default now(),
  unique (firm_id, idempotency_key)
);
create index if not exists stock_movements_bal_idx on stock_movements (firm_id, project_id, sku_id);
create index if not exists stock_movements_ref_idx on stock_movements (ref_type, ref_id);
create index if not exists stock_movements_sku_idx on stock_movements (sku_id, created_at);

-- Immutability: posted movements can never be updated or deleted. Corrections
-- are new reversal / adjustment rows.
create or replace function inv_block_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'stock_movements is an immutable ledger — post a reversal or adjustment instead'
    using errcode = '2F000';
end $$;
drop trigger if exists stock_movements_immutable on stock_movements;
create trigger stock_movements_immutable before update or delete on stock_movements
  for each row execute function inv_block_mutation();

-- ── Per-SKU / per-project stock policy (reorder + safety) ──────────────────
create table if not exists inventory_item_settings (
  id               uuid primary key default gen_random_uuid(),
  firm_id          uuid not null references firms(id) on delete cascade,
  sku_id           uuid not null references product_skus(id),
  project_id       text references crm_projects(id) on delete cascade, -- null = firm-wide default
  reorder_level    numeric not null default 0,
  safety_stock     numeric not null default 0,
  max_level        numeric,
  lead_time_days   integer,
  preferred_vendor_id uuid references vendors(id),
  notes            text,
  updated_at       timestamptz not null default now(),
  unique (firm_id, sku_id, project_id)
);
alter table inventory_item_settings enable row level security;

-- ── Actionable alerts (deep-linkable, exception-first) ─────────────────────
create table if not exists inventory_alerts (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid not null references firms(id) on delete cascade,
  alert_type   text not null,      -- shortage|reorder|approval_pending|rfq_pending|po_pending|late_delivery|partial_receipt|rejected_receipt|consumption_over_tolerance|count_variance|transfer_pending|stale_stock
  severity     text not null default 'warning', -- info|warning|critical
  title        text not null,
  message      text,
  project_id   text references crm_projects(id) on delete cascade,
  sku_id       uuid references product_skus(id),
  ref_type     text,
  ref_id       uuid,
  link         text,               -- app deep-link (page or page|projectId)
  dedupe_key   text,               -- prevents duplicate open alerts
  status       text not null default 'open', -- open|ack|resolved
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  unique (firm_id, dedupe_key)
);
alter table inventory_alerts enable row level security;
create index if not exists inventory_alerts_open_idx on inventory_alerts (firm_id, status);

-- ── Durable outbox: workflow events → notifications/tasks (async, replayable)
create table if not exists inventory_outbox (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid not null references firms(id) on delete cascade,
  event_type   text not null,
  payload      jsonb not null default '{}'::jsonb,
  status       text not null default 'pending', -- pending|processed|failed
  attempts     integer not null default 0,
  created_at   timestamptz not null default now(),
  processed_at timestamptz,
  error        text
);
alter table inventory_outbox enable row level security;
create index if not exists inventory_outbox_pending_idx on inventory_outbox (firm_id, status);

alter table stock_movements enable row level security;

-- ── Derived balances (never edited directly) ───────────────────────────────
-- on_hand / reserved / available are pure functions of the ledger.
create or replace view stock_balances as
select
  firm_id, project_id, sku_id,
  sum(qty_base) filter (where movement_class = 'physical') as on_hand,
  sum(qty_base) filter (where movement_class = 'reserved') as reserved,
  coalesce(sum(qty_base) filter (where movement_class = 'physical'), 0)
    - coalesce(sum(qty_base) filter (where movement_class = 'reserved'), 0) as available,
  max(created_at) as last_movement_at
from stock_movements
group by firm_id, project_id, sku_id;

-- ── RLS: reads are firm-scoped; writes happen only via SECURITY DEFINER RPCs
--    (no write policies → direct client mutations are blocked). ──────────────
do $$
declare t text;
begin
  foreach t in array array[
    'stock_movements','inventory_item_settings','inventory_alerts','inventory_outbox'
  ] loop
    execute format(
      'drop policy if exists %I on %I; create policy %I on %I for select using (firm_id = current_firm_id() or current_firm_id() is null);',
      t||'_sel', t, t||'_sel', t);
  end loop;
end $$;

grant select on stock_movements, inventory_item_settings, inventory_alerts, inventory_outbox, stock_balances to anon, authenticated;
grant execute on function inv_next_number(uuid, text, text) to anon, authenticated;
grant execute on function inv_current_actor() to anon, authenticated;
grant execute on function inv_require(text, text) to anon, authenticated;
grant execute on function inv_to_base(uuid, numeric, uom) to anon, authenticated;