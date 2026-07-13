-- ─────────────────────────────────────────────────────────────
-- Seed G: 6 completed projects + estimated-vs-actual history (Mumbai).
-- Encodes realistic drift: ply over-consumes ~6%, tiles ~9% (breakage),
-- laminate rate creeping ~5%, gypsum ~7%; hinges accurate.
-- ─────────────────────────────────────────────────────────────
insert into projects (id, firm_id, name, region_id, project_type, status, project_value) values
 ('40000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','Andheri 3BHK','c1000000-0000-4000-8000-000000000004','residential','completed',2200000),
 ('40000000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','Powai Villa','c1000000-0000-4000-8000-000000000004','residential','completed',4800000),
 ('40000000-0000-4000-8000-000000000003','11111111-1111-4111-8111-111111111111','Bandra Apartment','c1000000-0000-4000-8000-000000000004','residential','completed',1900000),
 ('40000000-0000-4000-8000-000000000004','11111111-1111-4111-8111-111111111111','Worli Penthouse','c1000000-0000-4000-8000-000000000004','residential','completed',6500000),
 ('40000000-0000-4000-8000-000000000005','11111111-1111-4111-8111-111111111111','Thane Office','c1000000-0000-4000-8000-000000000004','commercial','completed',3100000),
 ('40000000-0000-4000-8000-000000000006','11111111-1111-4111-8111-111111111111','Juhu Bungalow','c1000000-0000-4000-8000-000000000004','residential','completed',5400000);

-- variance rows: product drift × per-project noise (deterministic spread → clean medians)
insert into boq_actual_variance (firm_id, project_id, region_id, product_id,
  estimated_qty, actual_qty, estimated_rate, actual_rate, estimated_cost, actual_cost)
select '11111111-1111-4111-8111-111111111111', pr.pid::uuid, 'c1000000-0000-4000-8000-000000000004', cp.id,
  d.base_qty,
  round((d.base_qty * d.q_ratio * pr.noise)::numeric, 3),
  d.base_rate,
  round((d.base_rate * d.r_ratio)::numeric, 2),
  round((d.base_qty * d.base_rate)::numeric, 2),
  round((d.base_qty * d.q_ratio * pr.noise * d.base_rate * d.r_ratio)::numeric, 2)
from (values
  ('18mm BWP Plywood', 1.06, 1.03, 180.0, 95.0),
  ('Vitrified Tile 2x2', 1.09, 1.00, 150.0, 85.0),
  ('1mm Laminate',      1.04, 1.05, 6.0,   1100.0),
  ('Gypsum Board 12.5mm',1.07, 1.01, 120.0, 28.0),
  ('Soft-close Hinge',  1.01, 1.00, 24.0,  150.0)
) d(pname, q_ratio, r_ratio, base_qty, base_rate)
join catalog_products cp on cp.name = d.pname and cp.firm_id is null
cross join (values
  ('40000000-0000-4000-8000-000000000001', 0.98),
  ('40000000-0000-4000-8000-000000000002', 1.01),
  ('40000000-0000-4000-8000-000000000003', 1.05),
  ('40000000-0000-4000-8000-000000000004', 0.99),
  ('40000000-0000-4000-8000-000000000005', 1.03),
  ('40000000-0000-4000-8000-000000000006', 1.00)
) pr(pid, noise);
