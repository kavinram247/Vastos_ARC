-- ─────────────────────────────────────────────────────────────
-- Seed F: vendors + vendor_skus (their prices) + performance history
-- Designed to produce differentiated scores (fast/pricey vs cheap/slow).
-- ─────────────────────────────────────────────────────────────
insert into vendors (id, firm_id, company_name, contact_person, phone, category, region_ids, status) values
 ('e1000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','Sai Plywood & Boards','Mahesh','9820011111','materials', array['c1000000-0000-4000-8000-000000000004']::uuid[], 'preferred'),
 ('e1000000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','National Timber Mart','Suresh','9844022222','materials', array['c1000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000003']::uuid[], 'active'),
 ('e1000000-0000-4000-8000-000000000003','11111111-1111-4111-8111-111111111111','Greenline Distributors','Anita','9811033333','materials', array['c1000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000004','c1000000-0000-4000-8000-000000000005']::uuid[], 'active'),
 ('e1000000-0000-4000-8000-000000000004','11111111-1111-4111-8111-111111111111','Fittings Hub','Imran','9820044444','mep', array['c1000000-0000-4000-8000-000000000004']::uuid[], 'preferred'),
 ('e1000000-0000-4000-8000-000000000005','11111111-1111-4111-8111-111111111111','HardwareKart','Vikram','9811055555','mep', array['c1000000-0000-4000-8000-000000000005']::uuid[], 'probation');

-- vendor_skus: prices per the SKU's base_uom (sqft for ply, sheet for laminate, nos/pair for hardware)
insert into vendor_skus (firm_id, vendor_id, sku_id, price, moq, lead_time_days)
select '11111111-1111-4111-8111-111111111111', v.vid::uuid, s.id, v.price, v.moq, v.lead
from (values
 ('e1000000-0000-4000-8000-000000000001','VAS-BRD-PLY-CEN-BWP18',96, 32, 4),
 ('e1000000-0000-4000-8000-000000000001','VAS-BRD-PLY-CEN-BWP12',79, 32, 4),
 ('e1000000-0000-4000-8000-000000000001','VAS-LAM-MER-STD',1120, 5, 4),
 ('e1000000-0000-4000-8000-000000000001','VAS-BRD-MDF-ACT-18',56, 32, 4),
 ('e1000000-0000-4000-8000-000000000002','VAS-BRD-PLY-CEN-BWP18',92, 64, 9),
 ('e1000000-0000-4000-8000-000000000002','VAS-LAM-MER-STD',1080, 10, 9),
 ('e1000000-0000-4000-8000-000000000002','VAS-BRD-MDF-ACT-18',53, 64, 9),
 ('e1000000-0000-4000-8000-000000000003','VAS-BRD-PLY-CEN-BWP18',95, 32, 6),
 ('e1000000-0000-4000-8000-000000000003','VAS-LAM-MER-STD',1100, 5, 6),
 ('e1000000-0000-4000-8000-000000000003','VAS-BRD-PLY-GRP-BWP18',121, 32, 6),
 ('e1000000-0000-4000-8000-000000000004','VAS-HW-HNG-HET-SC',150, 50, 5),
 ('e1000000-0000-4000-8000-000000000004','VAS-HW-CHN-HET-SC',450, 20, 5),
 ('e1000000-0000-4000-8000-000000000004','VAS-HW-HNG-HAF-SC',250, 20, 5),
 ('e1000000-0000-4000-8000-000000000005','VAS-HW-HNG-HET-SC',140, 100, 11),
 ('e1000000-0000-4000-8000-000000000005','VAS-HW-CHN-HET-SC',430, 50, 11)
) v(vid, sku_code, price, moq, lead)
join product_skus s on s.sku_code = v.sku_code;

-- vendor_performance: closed-PO history (the raw scoring signal)
insert into vendor_performance (firm_id, vendor_id, promised_days, actual_days, qty_ordered, qty_defective, price_at_order, market_price)
select '11111111-1111-4111-8111-111111111111', v.vid::uuid, v.promised, v.actual, v.ordered, v.defective, v.price, v.market
from (values
 -- Sai: fast, perfect quality, slightly above market
 ('e1000000-0000-4000-8000-000000000001',4,4,100,0,96,95),
 ('e1000000-0000-4000-8000-000000000001',4,3,80,0,96,95),
 ('e1000000-0000-4000-8000-000000000001',5,5,120,1,96,95),
 -- National Timber: cheap, slow, more defects
 ('e1000000-0000-4000-8000-000000000002',9,12,100,5,92,95),
 ('e1000000-0000-4000-8000-000000000002',9,11,90,4,92,95),
 ('e1000000-0000-4000-8000-000000000002',8,13,110,6,92,95),
 -- Greenline: balanced, dependable
 ('e1000000-0000-4000-8000-000000000003',6,6,100,1,95,95),
 ('e1000000-0000-4000-8000-000000000003',6,5,100,1,95,95),
 ('e1000000-0000-4000-8000-000000000003',7,7,100,2,95,95),
 -- Fittings Hub: reliable premium hardware
 ('e1000000-0000-4000-8000-000000000004',5,5,50,0,150,150),
 ('e1000000-0000-4000-8000-000000000004',5,4,40,0,150,150),
 -- HardwareKart: cheap, slow, variable
 ('e1000000-0000-4000-8000-000000000005',11,14,60,3,140,150),
 ('e1000000-0000-4000-8000-000000000005',10,15,50,2,140,150)
) v(vid, promised, actual, ordered, defective, price, market);
