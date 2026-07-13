-- ─────────────────────────────────────────────────────────────
-- Seed C: SKUs + national rate cards (cost prices). rate = cost per base_uom.
-- ─────────────────────────────────────────────────────────────
with s(pname, sku_code, brand, grade, size_spec, list_price, cost_rate) as (
 values
  ('18mm BWP Plywood','VAS-BRD-PLY-CEN-BWP18','Century Sainik 710','standard','2440x1220x18',3800,95),
  ('18mm BWP Plywood','VAS-BRD-PLY-GRP-BWP18','Greenply Club Prime','premium','2440x1220x18',4600,120),
  ('12mm BWP Plywood','VAS-BRD-PLY-CEN-BWP12','Century Sainik 710','standard','2440x1220x12',3100,78),
  ('6mm Commercial Ply (Back Panel)','VAS-BRD-PLY-COM-06','Generic MR','economy','2440x1220x6',1300,40),
  ('18mm MDF','VAS-BRD-MDF-ACT-18','Action Tesa','standard','2440x1220x18',1800,55),
  ('18mm HDHMR','VAS-BRD-HDH-ACT-18','Action Tesa HDHMR','standard','2440x1220x18',2600,80),
  ('18mm Pre-laminated Particle Board','VAS-BRD-PRT-18','Generic','economy','2440x1220x18',1550,48),
  ('1mm Laminate','VAS-LAM-MER-STD','Merino','standard','2440x1220x1',1400,1100),
  ('1mm Laminate','VAS-LAM-GRL-DGN','Greenlam Designer','premium','2440x1220x1',2300,1800),
  ('Acrylic Sheet 8x4','VAS-ACR-GLOSS','Senosan','premium','2440x1220',4200,3500),
  ('Natural Veneer 8x4','VAS-VEN-NAT','Greenlam Decowood','premium','2440x1220',2800,2200),
  ('PU Finish','VAS-PU-2K','MRF 2K PU','premium','per_sqft',null,120),
  ('2mm PVC Edge Band','VAS-EDG-PVC2','Rehau','standard','22mm x 2mm',null,6),
  ('8mm Toughened Glass','VAS-GLS-TGH8','Saint-Gobain','standard','8mm',null,140),
  ('5mm Mirror','VAS-GLS-MIR5','Modiguard','standard','5mm',null,110),
  ('Soft-close Hinge','VAS-HW-HNG-HET-SC','Hettich Sensys','standard','110deg',null,150),
  ('Soft-close Hinge','VAS-HW-HNG-HAF-SC','Hafele Metalla','premium','110deg',null,250),
  ('Standard Auto Hinge','VAS-HW-HNG-EBC-STD','Ebco','economy','110deg',null,35),
  ('Soft-close Telescopic Channel','VAS-HW-CHN-HET-SC','Hettich Quadro','standard','450mm',null,450),
  ('Standard Drawer Channel','VAS-HW-CHN-EBC-STD','Ebco','economy','450mm',null,180),
  ('SS Cabinet Handle','VAS-HW-HDL-SS','Generic SS','standard','128mm',null,120),
  ('Tandem Drawer Box Set','VAS-HW-TDM-SET','Hettich InnoTech','premium','set',null,2500),
  ('Hydraulic Lift-up Fitting','VAS-HW-LFT-HYD','Hettich Lift Advanced','premium','nos',null,900),
  ('LED Profile Light','VAS-LGT-PRF','Generic 12V','standard','per_rft',null,180),
  ('LED Spot Light','VAS-LGT-SPOT','Philips','standard','nos',null,350),
  ('LED Strip','VAS-LGT-STRIP','Generic 5050','standard','per_rft',null,45),
  ('LED Driver','VAS-LGT-DRV','Generic 60W','standard','nos',null,450),
  ('Interior Emulsion','VAS-PNT-EMU','Asian Paints Royale','premium','litre',null,280),
  ('Primer','VAS-PNT-PRM','Asian Paints','standard','litre',null,180),
  ('Putty','VAS-PNT-PUT','Birla White','standard','kg',null,35),
  ('1.5sqmm FR Wire','VAS-ELC-WIRE15','Finolex','standard','1.5sqmm',null,18),
  ('Modular Switch Point','VAS-ELC-SWP','Legrand Myrius','standard','point',null,450),
  ('MCB 16A','VAS-ELC-MCB16','Legrand','standard','16A',null,350),
  ('Vitrified Tile 2x2','VAS-FLR-VIT','Kajaria','standard','600x600',null,85),
  ('Laminate Wooden Flooring','VAS-FLR-LAM','Pergo','standard','8mm',null,120),
  ('Italian Marble','VAS-FLR-MRB','Botticino','luxury','per_sqft',null,350),
  ('Gypsum Board 12.5mm','VAS-CLG-GYP','Gyproc','standard','12.5mm',null,28),
  ('GI Framework','VAS-CLG-GI','Gyproc','standard','per_sqft',null,35),
  ('POP Punning','VAS-CLG-POP','Sakarni','standard','per_sqft',null,22),
  ('Designer Furniture (allowance)','VAS-FRN-ALW','Allowance','standard','nos',null,15000),
  ('Decor & Soft Furnishing (allowance)','VAS-DEC-ALW','Allowance','standard','lumpsum',null,50000)
),
ins_sku as (
  insert into product_skus (product_id, sku_code, brand, quality_grade, size_spec, list_price)
  select pr.id, s.sku_code, s.brand, s.grade::quality_grade, s.size_spec, s.list_price
  from s join catalog_products pr on pr.name = s.pname and pr.firm_id is null
  returning id, sku_code
)
insert into rate_cards (firm_id, region_id, sku_id, rate, source, valid_from)
select '11111111-1111-4111-8111-111111111111', null, i.id, s.cost_rate, 'price_list', current_date
from ins_sku i join s on s.sku_code = i.sku_code;
