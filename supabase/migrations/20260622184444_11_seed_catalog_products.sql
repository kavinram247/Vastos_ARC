-- ─────────────────────────────────────────────────────────────
-- Seed B: catalog products (global master). Losses per material reality.
-- ─────────────────────────────────────────────────────────────
with p(catpath, name, base_uom, sec_uom, conv, waste, pkg, install, attrs, gst) as (
  values
   -- Boards (sheet = 32 sqft)
   ('material.boards.plywood','18mm BWP Plywood','sqft','sheet',32,0.10,0.01,0.00,'{"thickness_mm":18,"grade":"BWP","core":"hardwood"}'::jsonb,18),
   ('material.boards.plywood','12mm BWP Plywood','sqft','sheet',32,0.10,0.01,0.00,'{"thickness_mm":12,"grade":"BWP"}'::jsonb,18),
   ('material.boards.plywood','6mm Commercial Ply (Back Panel)','sqft','sheet',32,0.08,0.01,0.00,'{"thickness_mm":6,"grade":"MR"}'::jsonb,18),
   ('material.boards.mdf','18mm MDF','sqft','sheet',32,0.08,0.01,0.00,'{"thickness_mm":18}'::jsonb,18),
   ('material.boards.hdhmr','18mm HDHMR','sqft','sheet',32,0.09,0.01,0.00,'{"thickness_mm":18,"water_resistant":true}'::jsonb,18),
   ('material.boards.particle','18mm Pre-laminated Particle Board','sqft','sheet',32,0.07,0.01,0.00,'{"thickness_mm":18}'::jsonb,18),
   -- Surfacing
   ('material.surfacing.laminate','1mm Laminate','sheet',null,null,0.12,0.02,0.00,'{"thickness_mm":1,"size":"2440x1220"}'::jsonb,18),
   ('material.surfacing.acrylic','Acrylic Sheet 8x4','sheet',null,null,0.12,0.03,0.00,'{"finish":"high_gloss"}'::jsonb,18),
   ('material.surfacing.veneer','Natural Veneer 8x4','sheet',null,null,0.12,0.02,0.00,'{}'::jsonb,18),
   ('material.surfacing.pu','PU Finish','sqft',null,null,0.05,0.00,0.05,'{"coats":2}'::jsonb,18),
   ('material.surfacing.edgeband','2mm PVC Edge Band','rft',null,null,0.10,0.01,0.00,'{"thickness_mm":2}'::jsonb,18),
   -- Glass
   ('material.glass','8mm Toughened Glass','sqft',null,null,0.05,0.05,0.02,'{"thickness_mm":8,"toughened":true}'::jsonb,18),
   ('material.glass','5mm Mirror','sqft',null,null,0.05,0.05,0.02,'{"thickness_mm":5}'::jsonb,18),
   -- Hardware
   ('material.hardware.hinges','Soft-close Hinge','nos',null,null,0.02,0.00,0.00,'{"soft_close":true}'::jsonb,18),
   ('material.hardware.hinges','Standard Auto Hinge','nos',null,null,0.02,0.00,0.00,'{"soft_close":false}'::jsonb,18),
   ('material.hardware.channels','Soft-close Telescopic Channel','pair',null,null,0.02,0.00,0.00,'{"soft_close":true}'::jsonb,18),
   ('material.hardware.channels','Standard Drawer Channel','pair',null,null,0.02,0.00,0.00,'{}'::jsonb,18),
   ('material.hardware.handles','SS Cabinet Handle','nos',null,null,0.02,0.00,0.00,'{"material":"SS"}'::jsonb,18),
   ('material.hardware.fittings','Tandem Drawer Box Set','set',null,null,0.02,0.00,0.00,'{}'::jsonb,18),
   ('material.hardware.fittings','Hydraulic Lift-up Fitting','nos',null,null,0.02,0.00,0.00,'{}'::jsonb,18),
   -- Lighting
   ('material.lighting','LED Profile Light','rft',null,null,0.05,0.01,0.00,'{}'::jsonb,18),
   ('material.lighting','LED Spot Light','nos',null,null,0.03,0.01,0.00,'{}'::jsonb,18),
   ('material.lighting','LED Strip','rft',null,null,0.05,0.01,0.00,'{}'::jsonb,18),
   ('material.lighting','LED Driver','nos',null,null,0.02,0.00,0.00,'{}'::jsonb,18),
   -- Paints
   ('material.paints','Interior Emulsion','litre',null,null,0.05,0.00,0.05,'{"coverage_sqft_per_litre":120,"coats":2}'::jsonb,18),
   ('material.paints','Primer','litre',null,null,0.05,0.00,0.05,'{"coverage_sqft_per_litre":140}'::jsonb,18),
   ('material.paints','Putty','kg',null,null,0.05,0.00,0.05,'{"coverage_sqft_per_kg":18}'::jsonb,18),
   -- Electrical
   ('material.electrical','1.5sqmm FR Wire','rmt',null,null,0.05,0.00,0.00,'{"size_sqmm":1.5}'::jsonb,18),
   ('material.electrical','Modular Switch Point','point',null,null,0.02,0.00,0.00,'{}'::jsonb,18),
   ('material.electrical','MCB 16A','nos',null,null,0.02,0.00,0.00,'{}'::jsonb,18),
   -- Flooring
   ('material.flooring','Vitrified Tile 2x2','sqft',null,null,0.08,0.05,0.05,'{}'::jsonb,18),
   ('material.flooring','Laminate Wooden Flooring','sqft',null,null,0.08,0.03,0.03,'{}'::jsonb,18),
   ('material.flooring','Italian Marble','sqft',null,null,0.10,0.05,0.05,'{}'::jsonb,18),
   -- False Ceiling
   ('material.ceiling','Gypsum Board 12.5mm','sqft',null,null,0.10,0.02,0.00,'{"thickness_mm":12.5}'::jsonb,18),
   ('material.ceiling','GI Framework','sqft',null,null,0.08,0.01,0.00,'{}'::jsonb,18),
   ('material.ceiling','POP Punning','sqft',null,null,0.10,0.00,0.00,'{}'::jsonb,18),
   -- Furniture / Decor (supply items, priced as nos/lumpsum)
   ('material.furniture','Designer Furniture (allowance)','nos',null,null,0.00,0.02,0.02,'{}'::jsonb,18),
   ('material.decor','Decor & Soft Furnishing (allowance)','lumpsum',null,null,0.00,0.00,0.00,'{}'::jsonb,18)
)
insert into catalog_products (category_id, name, base_uom, secondary_uom, uom_conversion, waste_factor, packaging_loss, install_loss, attributes, gst_rate)
select c.id, p.name, p.base_uom::uom,
       case when p.sec_uom is null then null else p.sec_uom::uom end,
       p.conv, p.waste, p.pkg, p.install, p.attrs, p.gst
from p join catalog_categories c on c.path = p.catpath::ltree;
