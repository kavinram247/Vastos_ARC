-- ═══════════════════════════════════════════════════════════════════════════
-- SECURITY PHASE 3 — H2b · the shared catalogue becomes read-only, and each
--                          firm gets copy-on-write over it
--
-- Phase 2 (20260728060000) recorded this as a PARTIAL mitigation and said so:
-- it required catalog:edit, which stops a low-privilege insider, and does not
-- stop a firm owner — and every account that signs up is the owner of its own
-- firm. Measured again before writing this, as firm B's owner against the
-- shared catalogue every firm prices from:
--
--   PATCH /rest/v1/catalog_products?id=eq.<global>  {"gst_rate":0,
--                                    "waste_factor":0.99}          → 204, applied
--   PATCH /rest/v1/module_templates?id=eq.<global>                 → 204, applied
--   PATCH /rest/v1/module_rules?id=eq.<global>                     → 204, applied
--   DELETE /rest/v1/module_rules?id=eq.<global>                    → 204, gone
--   PATCH labour_activities / product_skus / catalog_categories    → 204, applied
--
-- Every firm's BOQ is priced from those rows. A competitor with a trial account
-- could zero a rival's GST or set their waste factor to 0.99 and silently
-- corrupt every estimate that firm produces. Financial integrity, not just data
-- integrity.
--
-- ── The rule ───────────────────────────────────────────────────────────────
-- A global row (firm_id IS NULL) is READ-ONLY to every tenant, always. Tenants
-- write only rows their own firm owns. Tables with no firm_id column at all —
-- module_rules, product_skus, product_alternates, catalog_embeddings — are
-- global by construction, so they derive tenancy from their parent or are
-- read-only outright.
--
-- Phase 2 declined to do this because it would have broken three working admin
-- surfaces with no migration path: on this database EVERY catalogue row is
-- global (catalog_products 38/38, labour_activities 16/16, module_templates
-- 14/14), and CatalogAdminPage's waste-factor editor, the module template
-- editor and the rule editor all write exactly those rows. The owner has since
-- confirmed there are no customers or users yet and asked for the proper fix,
-- which removes the migration problem and leaves the design question:
--
--   · catalog_products  → an OVERRIDE table. A firm's tuning of a global
--     product is a sparse patch keyed by (firm_id, product_id), resolved at
--     read time by catalog_products_effective. The global row's id is
--     preserved, so every foreign key into catalog_products — boq_line_items,
--     module_rules, boq_actual_variance — keeps working untouched. Overriding
--     one field of one product does not copy 38 rows.
--
--   · module_templates  → a FORK. A template is not a set of scalars; it is a
--     template plus its ordered rules, edited as a unit. So the first write
--     clones the template and all of its rules into the firm, and every later
--     edit lands on the clone. module_templates_effective then shows a firm
--     its own fork in place of the global it was forked from, matched on
--     `code`.
--
-- Anything global that no UI edits — labour_activities, product_skus,
-- catalog_categories, product_alternates, catalog_embeddings, regions — simply
-- becomes read-only. Nothing breaks, because nothing wrote them: rates go to
-- rate_cards and margins to margin_policies, both already firm-scoped.
--
-- Audit refs: H2b (closing it), and the global-catalogue question left open
-- against 20260622184203_09_boq_rls_and_functions.sql:27.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1 · Global rows become read-only ───────────────────────────────────────
-- SELECT keeps the shared visibility the catalogue exists for. Writes require
-- catalog:edit AND a row this firm owns. `firm_id is null` is gone from the
-- write predicate — that clause was the whole finding.
do $$
declare
  t        text;
  has_firm boolean;
  wpred    text;
  rpred    text;
begin
  foreach t in array array[
    'catalog_categories', 'catalog_products', 'catalog_embeddings',
    'labour_activities',  'module_rules',     'module_templates',
    'product_alternates', 'product_skus',     'regions'
  ]
  loop
    if to_regclass('public.' || t) is null then
      raise warning 'H2b: % not present, skipping', t;
      continue;
    end if;

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'firm_id'
    ) into has_firm;

    if has_firm then
      rpred := '(firm_id = public.current_firm_id() or firm_id is null)';
      wpred := 'firm_id = public.current_firm_id()'
               || ' and public.crm_has_permission(''catalog'', ''edit'')';
    elsif t = 'module_rules' then
      -- No firm_id of its own; a rule's tenancy is its template's. Readable
      -- when the template is, writable only when the template is the caller's.
      rpred := 'exists (select 1 from public.module_templates mt'
               || ' where mt.id = module_rules.template_id'
               || '   and (mt.firm_id = public.current_firm_id() or mt.firm_id is null))';
      wpred := 'exists (select 1 from public.module_templates mt'
               || ' where mt.id = module_rules.template_id'
               || '   and mt.firm_id = public.current_firm_id())'
               || ' and public.crm_has_permission(''catalog'', ''edit'')';
    else
      -- product_skus, product_alternates, catalog_embeddings: global by
      -- construction and edited by nothing. Readable by all, written by none.
      rpred := 'true';
      wpred := 'false';
    end if;

    -- Drop every name this migration or its predecessors may have created, so
    -- re-running it is a no-op rather than a duplicate-policy error.
    execute format('drop policy if exists %I on public.%I', t || '_mod', t);
    execute format('drop policy if exists %I on public.%I', t || '_sel', t);
    execute format('drop policy if exists %I on public.%I', t || '_ins', t);
    execute format('drop policy if exists %I on public.%I', t || '_upd', t);
    execute format('drop policy if exists %I on public.%I', t || '_del', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using (%s)',
      t || '_sel', t, rpred);

    -- Split rather than FOR ALL, so the read predicate is not also the write
    -- predicate. FOR ALL with one expression is how `using (true)` became a
    -- write grant in the first place.
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (%s)',
      t || '_ins', t, wpred);
    execute format(
      'create policy %I on public.%I for update to authenticated using (%s) with check (%s)',
      t || '_upd', t, wpred, wpred);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (%s)',
      t || '_del', t, wpred);
  end loop;
end $$;


-- ── 2 · Per-firm overrides for catalog_products ────────────────────────────
-- Sparse: NULL means "not overridden", so a firm that tunes one waste factor
-- stores one row with one non-null column, and continues to track the global
-- catalogue for everything else.
create table if not exists public.catalog_product_overrides (
  id             uuid primary key default gen_random_uuid(),
  firm_id        uuid not null references public.firms(id) on delete cascade,
  product_id     uuid not null references public.catalog_products(id) on delete cascade,
  name           text,
  category_id    uuid references public.catalog_categories(id),
  waste_factor   numeric(5,4),
  packaging_loss numeric(5,4),
  install_loss   numeric(5,4),
  gst_rate       numeric(5,2),
  hsn_code       text,
  attributes     jsonb,
  is_active      boolean,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (firm_id, product_id)
);

alter table public.catalog_product_overrides enable row level security;

-- C1b's new posture: a table grants a client role nothing until a migration
-- says otherwise. Reads are direct (the resolver view is not security barrier
-- enough on its own to be the only path); writes go through the RPC below.
revoke all on public.catalog_product_overrides from anon, authenticated, public;
grant select on public.catalog_product_overrides to authenticated;

drop policy if exists catalog_product_overrides_sel on public.catalog_product_overrides;
create policy catalog_product_overrides_sel
  on public.catalog_product_overrides for select to authenticated
  using (firm_id = public.current_firm_id());

create index if not exists catalog_product_overrides_firm_idx
  on public.catalog_product_overrides (firm_id, product_id);


-- ── 3 · The resolver view ──────────────────────────────────────────────────
-- Keeps the GLOBAL row's id, so nothing that references catalog_products has
-- to change. security_invoker so the underlying policies still apply to the
-- caller rather than to the view's owner.
create or replace view public.catalog_products_effective
with (security_invoker = true) as
  select
    p.id,
    p.firm_id,
    coalesce(o.category_id,    p.category_id)    as category_id,
    coalesce(o.name,           p.name)           as name,
    p.base_uom,
    p.secondary_uom,
    p.uom_conversion,
    coalesce(o.waste_factor,   p.waste_factor)   as waste_factor,
    coalesce(o.packaging_loss, p.packaging_loss) as packaging_loss,
    coalesce(o.install_loss,   p.install_loss)   as install_loss,
    coalesce(o.attributes,     p.attributes)     as attributes,
    coalesce(o.hsn_code,       p.hsn_code)       as hsn_code,
    coalesce(o.gst_rate,       p.gst_rate)       as gst_rate,
    coalesce(o.is_active,      p.is_active)      as is_active,
    p.created_at,
    greatest(p.updated_at, coalesce(o.updated_at, p.updated_at)) as updated_at,
    (o.id is not null) as is_overridden
  from public.catalog_products p
  left join public.catalog_product_overrides o
    on o.product_id = p.id
   and o.firm_id    = public.current_firm_id();

revoke all on public.catalog_products_effective from anon, authenticated, public;
grant select on public.catalog_products_effective to authenticated;


-- ── 4 · The write path for products ────────────────────────────────────────
-- One entry point for every product edit. A firm's OWN product is updated in
-- place; a GLOBAL product produces an override. The caller does not have to
-- know which, which is why the three client call sites collapse to this.
create or replace function public.catalog_product_override_set(
  p_product_id uuid,
  p_patch      jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_firm  uuid;
  v_owner uuid;
  v_known text[] := array['name','category_id','waste_factor','packaging_loss',
                          'install_loss','gst_rate','hsn_code','attributes','is_active'];
  v_key   text;
begin
  v_firm := public.current_firm_id();
  if v_firm is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not public.crm_has_permission('catalog', 'edit') then
    raise exception 'you do not have permission to edit the catalogue'
      using errcode = '42501';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'a patch object is required' using errcode = '22023';
  end if;

  -- Reject unknown keys rather than ignoring them: silently dropping a field
  -- the caller believed it saved is how "the edit did not stick" bugs start.
  for v_key in select jsonb_object_keys(p_patch) loop
    if not (v_key = any(v_known)) then
      raise exception 'unknown catalogue field: %', v_key using errcode = '22023';
    end if;
  end loop;

  select firm_id into v_owner
  from public.catalog_products where id = p_product_id;
  if not found then
    raise exception 'unknown product' using errcode = '42704';
  end if;

  -- Another firm's private product is not merely unwritable, it is invisible.
  if v_owner is not null and v_owner <> v_firm then
    raise exception 'unknown product' using errcode = '42704';
  end if;

  if v_owner = v_firm then
    -- The firm's own row. Update in place; no override row is involved.
    update public.catalog_products p set
      name           = coalesce((p_patch->>'name'), p.name),
      category_id    = coalesce((p_patch->>'category_id')::uuid, p.category_id),
      waste_factor   = coalesce((p_patch->>'waste_factor')::numeric, p.waste_factor),
      packaging_loss = coalesce((p_patch->>'packaging_loss')::numeric, p.packaging_loss),
      install_loss   = coalesce((p_patch->>'install_loss')::numeric, p.install_loss),
      gst_rate       = coalesce((p_patch->>'gst_rate')::numeric, p.gst_rate),
      hsn_code       = coalesce((p_patch->>'hsn_code'), p.hsn_code),
      attributes     = coalesce((p_patch->'attributes'), p.attributes),
      is_active      = coalesce((p_patch->>'is_active')::boolean, p.is_active),
      updated_at     = now()
    where p.id = p_product_id;

    return jsonb_build_object('product_id', p_product_id, 'mode', 'in_place');
  end if;

  -- A global product: copy-on-write. Existing override values survive keys the
  -- patch does not mention.
  insert into public.catalog_product_overrides as o (
    firm_id, product_id, name, category_id, waste_factor, packaging_loss,
    install_loss, gst_rate, hsn_code, attributes, is_active
  ) values (
    v_firm, p_product_id,
    p_patch->>'name',
    (p_patch->>'category_id')::uuid,
    (p_patch->>'waste_factor')::numeric,
    (p_patch->>'packaging_loss')::numeric,
    (p_patch->>'install_loss')::numeric,
    (p_patch->>'gst_rate')::numeric,
    p_patch->>'hsn_code',
    p_patch->'attributes',
    (p_patch->>'is_active')::boolean
  )
  on conflict (firm_id, product_id) do update set
    name           = coalesce(excluded.name,           o.name),
    category_id    = coalesce(excluded.category_id,    o.category_id),
    waste_factor   = coalesce(excluded.waste_factor,   o.waste_factor),
    packaging_loss = coalesce(excluded.packaging_loss, o.packaging_loss),
    install_loss   = coalesce(excluded.install_loss,   o.install_loss),
    gst_rate       = coalesce(excluded.gst_rate,       o.gst_rate),
    hsn_code       = coalesce(excluded.hsn_code,       o.hsn_code),
    attributes     = coalesce(excluded.attributes,     o.attributes),
    is_active      = coalesce(excluded.is_active,      o.is_active),
    updated_at     = now();

  return jsonb_build_object('product_id', p_product_id, 'mode', 'override');
end $$;


-- Dropping an override returns the firm to the shared catalogue value.
create or replace function public.catalog_product_override_clear(p_product_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_firm uuid;
begin
  v_firm := public.current_firm_id();
  if v_firm is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not public.crm_has_permission('catalog', 'edit') then
    raise exception 'you do not have permission to edit the catalogue'
      using errcode = '42501';
  end if;

  delete from public.catalog_product_overrides
   where firm_id = v_firm and product_id = p_product_id;
end $$;


-- ── 5 · Fork-on-write for module templates ─────────────────────────────────
-- A template is a template plus its ordered rules, edited as a unit, so the
-- first write clones both. Idempotent: forking a template the firm already
-- owns returns it unchanged, which lets the client call this unconditionally
-- before any template or rule edit.
create or replace function public.module_template_fork(p_template_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_firm uuid;
  v_tpl  record;
  v_new  uuid;
begin
  v_firm := public.current_firm_id();
  if v_firm is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not public.crm_has_permission('catalog', 'edit') then
    raise exception 'you do not have permission to edit the catalogue'
      using errcode = '42501';
  end if;

  select * into v_tpl from public.module_templates where id = p_template_id;
  if not found then
    raise exception 'unknown template' using errcode = '42704';
  end if;

  -- Already ours: nothing to do.
  if v_tpl.firm_id = v_firm then
    return v_tpl.id;
  end if;
  -- Another firm's private template is invisible, not merely unforkable.
  if v_tpl.firm_id is not null then
    raise exception 'unknown template' using errcode = '42704';
  end if;

  -- Forked once already? Reuse it, or a second edit would make a second fork.
  select id into v_new
  from public.module_templates
  where firm_id = v_firm and code = v_tpl.code;
  if found then
    return v_new;
  end if;

  insert into public.module_templates
    (firm_id, code, name, category, description, param_schema, derived_vars,
     version, is_active)
  values
    (v_firm, v_tpl.code, v_tpl.name, v_tpl.category, v_tpl.description,
     v_tpl.param_schema, v_tpl.derived_vars, v_tpl.version, v_tpl.is_active)
  returning id into v_new;

  insert into public.module_rules
    (template_id, seq, output_kind, product_id, labour_activity_id, label,
     condition, qty_formula, uom, notes)
  select v_new, r.seq, r.output_kind, r.product_id, r.labour_activity_id,
         r.label, r.condition, r.qty_formula, r.uom, r.notes
  from public.module_rules r
  where r.template_id = p_template_id;

  return v_new;
end $$;


-- ── 5b · Editing through the fork, transparently ───────────────────────────
-- The admin UI holds a template id and a rule id and edits them directly. If
-- forking were the caller's job, every edit path would need to remember to do
-- it first — and forgetting would produce an UPDATE that matches zero rows and
-- reports success, which is exactly the failure mode W1a was about.
--
-- So these fork first and return the id the caller should now use. All three
-- are idempotent: on a template the firm already owns they are a plain update.
create or replace function public.module_template_set_meta(
  p_template_id uuid,
  p_patch       jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tpl   uuid;
  v_known text[] := array['name','description','category','param_schema',
                          'derived_vars','is_active'];
  v_key   text;
begin
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'a patch object is required' using errcode = '22023';
  end if;
  for v_key in select jsonb_object_keys(p_patch) loop
    if not (v_key = any(v_known)) then
      raise exception 'unknown template field: %', v_key using errcode = '22023';
    end if;
  end loop;

  -- Authorization and firm binding both live in the fork.
  v_tpl := public.module_template_fork(p_template_id);

  update public.module_templates t set
    name         = coalesce(p_patch->>'name', t.name),
    description  = coalesce(p_patch->>'description', t.description),
    category     = coalesce(p_patch->>'category', t.category),
    param_schema = coalesce(p_patch->'param_schema', t.param_schema),
    derived_vars = coalesce(p_patch->'derived_vars', t.derived_vars),
    is_active    = coalesce((p_patch->>'is_active')::boolean, t.is_active),
    updated_at   = now()
  where t.id = v_tpl;

  return v_tpl;
end $$;


-- Insert (p_rule_id null) or update a rule, forking the parent template first.
-- After a fork the caller's rule id refers to the GLOBAL rule, so the
-- counterpart in the fork is located by `seq`, which the fork preserves.
create or replace function public.module_rule_save(
  p_rule_id     uuid,
  p_template_id uuid,
  p_data        jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tpl     uuid;
  v_rule    uuid;
  v_seq     integer;
  v_src_tpl uuid;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'a rule object is required' using errcode = '22023';
  end if;

  if p_rule_id is not null then
    select template_id, seq into v_src_tpl, v_seq
    from public.module_rules where id = p_rule_id;
    if not found then
      raise exception 'unknown rule' using errcode = '42704';
    end if;
    v_tpl := public.module_template_fork(coalesce(p_template_id, v_src_tpl));
    -- Same template ⇒ the id is still good; otherwise find the copy by seq.
    if v_src_tpl = v_tpl then
      v_rule := p_rule_id;
    else
      select id into v_rule
      from public.module_rules where template_id = v_tpl and seq = v_seq;
    end if;
  else
    if p_template_id is null then
      raise exception 'a template is required to add a rule' using errcode = '22023';
    end if;
    v_tpl := public.module_template_fork(p_template_id);
  end if;

  if v_rule is null then
    insert into public.module_rules
      (template_id, seq, output_kind, product_id, labour_activity_id, label,
       condition, qty_formula, uom, notes)
    values (
      v_tpl,
      coalesce((p_data->>'seq')::integer,
               (select coalesce(max(seq), 0) + 1 from public.module_rules
                 where template_id = v_tpl)),
      (p_data->>'output_kind')::public.module_output_kind,
      (p_data->>'product_id')::uuid,
      (p_data->>'labour_activity_id')::uuid,
      coalesce(p_data->>'label', ''),
      p_data->>'condition',
      coalesce(p_data->>'qty_formula', '0'),
      (p_data->>'uom')::public.uom,
      p_data->>'notes'
    )
    returning id into v_rule;
  else
    update public.module_rules r set
      seq                = coalesce((p_data->>'seq')::integer, r.seq),
      output_kind        = coalesce((p_data->>'output_kind')::public.module_output_kind, r.output_kind),
      product_id         = case when p_data ? 'product_id'
                                then (p_data->>'product_id')::uuid else r.product_id end,
      labour_activity_id = case when p_data ? 'labour_activity_id'
                                then (p_data->>'labour_activity_id')::uuid else r.labour_activity_id end,
      label              = coalesce(p_data->>'label', r.label),
      condition          = case when p_data ? 'condition'
                                then p_data->>'condition' else r.condition end,
      qty_formula        = coalesce(p_data->>'qty_formula', r.qty_formula),
      uom                = coalesce((p_data->>'uom')::public.uom, r.uom),
      notes              = case when p_data ? 'notes' then p_data->>'notes' else r.notes end
    where r.id = v_rule;
  end if;

  return jsonb_build_object('template_id', v_tpl, 'rule_id', v_rule);
end $$;


create or replace function public.module_rule_delete(p_rule_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tpl     uuid;
  v_src_tpl uuid;
  v_seq     integer;
  v_target  uuid;
begin
  select template_id, seq into v_src_tpl, v_seq
  from public.module_rules where id = p_rule_id;
  if not found then
    raise exception 'unknown rule' using errcode = '42704';
  end if;

  v_tpl := public.module_template_fork(v_src_tpl);

  if v_src_tpl = v_tpl then
    v_target := p_rule_id;
  else
    select id into v_target
    from public.module_rules where template_id = v_tpl and seq = v_seq;
  end if;

  delete from public.module_rules where id = v_target;

  return jsonb_build_object('template_id', v_tpl);
end $$;


-- ── 6 · The resolver view for templates ────────────────────────────────────
-- A firm sees its own fork INSTEAD of the global it was forked from, matched
-- on `code`, plus every global it has not forked, plus its own originals.
create or replace view public.module_templates_effective
with (security_invoker = true) as
  select t.*, (t.firm_id is not null) as is_fork
  from public.module_templates t
  where t.firm_id = public.current_firm_id()
     or (
       t.firm_id is null
       and not exists (
         select 1 from public.module_templates f
         where f.firm_id = public.current_firm_id()
           and f.code    = t.code
       )
     );

revoke all on public.module_templates_effective from anon, authenticated, public;
grant select on public.module_templates_effective to authenticated;


-- ── 7 · Grants ─────────────────────────────────────────────────────────────
revoke all on function public.catalog_product_override_set(uuid, jsonb)   from public, anon;
revoke all on function public.catalog_product_override_clear(uuid)        from public, anon;
revoke all on function public.module_template_fork(uuid)                  from public, anon;
revoke all on function public.module_template_set_meta(uuid, jsonb)       from public, anon;
revoke all on function public.module_rule_save(uuid, uuid, jsonb)         from public, anon;
revoke all on function public.module_rule_delete(uuid)                    from public, anon;

grant execute on function public.catalog_product_override_set(uuid, jsonb) to authenticated;
grant execute on function public.catalog_product_override_clear(uuid)      to authenticated;
grant execute on function public.module_template_fork(uuid)                to authenticated;
grant execute on function public.module_template_set_meta(uuid, jsonb)     to authenticated;
grant execute on function public.module_rule_save(uuid, uuid, jsonb)       to authenticated;
grant execute on function public.module_rule_delete(uuid)                  to authenticated;


-- ── 8 · Assertions ─────────────────────────────────────────────────────────
-- No catalogue write policy may still admit a global row. This is the finding
-- itself, expressed as a check that fails if anyone reinstates it.
do $$
declare bad text;
begin
  select string_agg(tablename || '.' || policyname, ', ' order by tablename, policyname)
    into bad
  from pg_policies
  where schemaname = 'public'
    and tablename in ('catalog_categories', 'catalog_products', 'catalog_embeddings',
                      'labour_activities',  'module_rules',     'module_templates',
                      'product_alternates', 'product_skus',     'regions')
    and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
    and roles && array['authenticated', 'anon', 'public']::name[]
    and coalesce(qual, '') || ' ' || coalesce(with_check, '') ~ 'firm_id IS NULL';

  if bad is not null then
    raise exception
      'H2b: a catalogue write policy still admits global rows: %', bad;
  end if;
  raise notice 'H2b verified: no catalogue write policy admits a global row';
end $$;

-- And none of them may be unconditional (Phase 2's schema-wide check, kept).
do $$
declare bad text;
begin
  select string_agg(tablename || '.' || policyname, ', ' order by tablename)
    into bad
  from pg_policies
  where schemaname = 'public'
    and roles && array['authenticated', 'anon', 'public']::name[]
    and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
    and coalesce(qual, 'true') = 'true' and coalesce(with_check, 'true') = 'true';

  if bad is not null then
    raise exception 'H2b: unconditional client write policies remain: %', bad;
  end if;
  raise notice 'H2b verified: no unconditional client write policy in schema public';
end $$;

-- Behaviour, not just policy text: impersonate a firm and try to write a
-- global row. RLS does not apply to the table owner, so this runs as a role
-- that RLS does apply to.
do $$
declare
  v_firm    uuid;
  v_uid     uuid := '00000000-0000-4000-8000-0000000000b2';
  v_prod    uuid;
  v_before  numeric;
  v_after   numeric;
begin
  select id into v_firm from public.firms limit 1;
  select id into v_prod from public.catalog_products where firm_id is null limit 1;
  if v_firm is null or v_prod is null then
    raise notice 'H2b: no global catalogue rows present, skipping rehearsal';
    return;
  end if;

  insert into public.profiles (firm_id, email, full_name, role, auth_uid)
  values (v_firm, 'h2b-assert@invalid.test', 'H2b Assertion', 'owner', v_uid)
  on conflict (firm_id, email) do update set auth_uid = excluded.auth_uid;

  select waste_factor into v_before from public.catalog_products where id = v_prod;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid::text)::text, true);
  perform set_config('role', 'authenticated', true);

  begin
    update public.catalog_products set waste_factor = 0.99 where id = v_prod;
  exception when others then
    null;  -- RLS refuses by matching zero rows, but a raise is fine too
  end;

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);

  select waste_factor into v_after from public.catalog_products where id = v_prod;
  if v_after is distinct from v_before then
    raise exception
      'H2b: an authenticated firm owner still rewrote a global catalogue row '
      '(waste_factor % -> %)', v_before, v_after;
  end if;

  delete from public.catalog_product_overrides
   where firm_id = v_firm and product_id = v_prod;
  delete from public.profiles where email = 'h2b-assert@invalid.test';

  raise notice 'H2b verified: an authenticated firm owner cannot rewrite a global catalogue row';
end $$;

-- The resolver view must preserve the global row's id, or every foreign key
-- into catalog_products silently stops matching.
do $$
declare n_mismatch int;
begin
  select count(*) into n_mismatch
  from public.catalog_products p
  where not exists (
    select 1 from public.catalog_products_effective e where e.id = p.id
  );
  if n_mismatch > 0 then
    raise exception
      'H2b: catalog_products_effective does not expose % product id(s) — '
      'foreign keys into catalog_products would stop resolving', n_mismatch;
  end if;
  raise notice 'H2b verified: the resolver view preserves every product id';
end $$;
