-- ─────────────────────────────────────────────────────────────
-- Seed A: firm, regions, owner, margin policy, category tree
-- ─────────────────────────────────────────────────────────────
insert into firms (id, name, gstin, address, payment_split_default, created_at) values
 ('11111111-1111-4111-8111-111111111111','Studio Horizon Architects','27AABCS1234F1ZP',
  '402 Design Tower, Bandra West, Mumbai 400050', 5, '2024-01-15T10:00:00Z');

insert into profiles (id, firm_id, email, full_name, role) values
 ('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111',
  'rahul@studiohorizon.in','Rahul Mehta','owner');

-- 5 cities with market-surveyed cost indices (national baseline = 1.0)
insert into regions (id, firm_id, name, state, material_index, labour_index, logistics_index, availability_risk) values
 ('c1000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','Chennai','Tamil Nadu',0.98,0.95,1.00,0.05),
 ('c1000000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','Bangalore','Karnataka',1.00,1.05,1.02,0.05),
 ('c1000000-0000-4000-8000-000000000003','11111111-1111-4111-8111-111111111111','Hyderabad','Telangana',0.97,0.95,1.00,0.03),
 ('c1000000-0000-4000-8000-000000000004','11111111-1111-4111-8111-111111111111','Mumbai','Maharashtra',1.05,1.25,1.10,0.08),
 ('c1000000-0000-4000-8000-000000000005','11111111-1111-4111-8111-111111111111','Delhi','Delhi NCR',1.00,1.10,1.05,0.06);

-- Margin policy: 35% target, 18% floor, 8% overhead recovery
insert into margin_policies (firm_id, category_id, grade, target_margin_pct, margin_floor_pct, overhead_pct) values
 ('11111111-1111-4111-8111-111111111111', null, null, 35, 18, 8);

-- ── Material category tree (ltree) ──
insert into catalog_categories (path, name, kind, order_index) values
 ('material','Material','material',0),
 ('material.boards','Boards','material',1),
 ('material.boards.plywood','Plywood','material',1),
 ('material.boards.mdf','MDF','material',2),
 ('material.boards.hdhmr','HDHMR','material',3),
 ('material.boards.particle','Particle Board','material',4),
 ('material.surfacing','Surfacing','material',2),
 ('material.surfacing.laminate','Laminate','material',1),
 ('material.surfacing.acrylic','Acrylic','material',2),
 ('material.surfacing.veneer','Veneer','material',3),
 ('material.surfacing.pu','PU / Lacquer','material',4),
 ('material.surfacing.edgeband','Edge Banding','material',5),
 ('material.glass','Glass & Mirror','material',3),
 ('material.hardware','Hardware','material',4),
 ('material.hardware.hinges','Hinges','material',1),
 ('material.hardware.channels','Drawer Channels','material',2),
 ('material.hardware.handles','Handles','material',3),
 ('material.hardware.fittings','Fittings & Baskets','material',4),
 ('material.lighting','Lighting','material',5),
 ('material.paints','Paints & Finishes','material',6),
 ('material.electrical','Electrical','material',7),
 ('material.flooring','Flooring','material',8),
 ('material.ceiling','False Ceiling','material',9),
 ('material.furniture','Furniture','material',10),
 ('material.decor','Decor','material',11),
 ('labour','Labour','labour',20),
 ('service','Service','service',30);

-- backfill parent_id from path hierarchy
update catalog_categories c set parent_id = p.id
from catalog_categories p
where nlevel(c.path) > 1 and p.path = subpath(c.path, 0, nlevel(c.path)-1);
