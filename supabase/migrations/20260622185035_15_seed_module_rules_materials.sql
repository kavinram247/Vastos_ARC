-- ─────────────────────────────────────────────────────────────
-- Seed E2: module_rules — material & hardware outputs (DSL uses double-quoted strings)
-- ─────────────────────────────────────────────────────────────
insert into module_rules (template_id, seq, output_kind, product_id, label, condition, qty_formula, uom)
select v.tid::uuid, v.seq, v.kind::module_output_kind, p.id, v.label, v.cond, v.formula, v.uom::uom
from (values
 -- KITCHEN
 ('d0000000-0000-4000-8000-000000000001',1,'material','18mm BWP Plywood','Carcass & shutters (18mm ply)',null,'base_rft*11 + wall_rft*7.5 + loft_rft*6.5','sqft'),
 ('d0000000-0000-4000-8000-000000000001',2,'material','6mm Commercial Ply (Back Panel)','Back panels (6mm)',null,'(base_rft+wall_rft+loft_rft)*2.4','sqft'),
 ('d0000000-0000-4000-8000-000000000001',3,'material','1mm Laminate','Shutter laminate',
   'shutter_finish == "laminate"','(base_rft+wall_rft+loft_rft)*0.30','sheet'),
 ('d0000000-0000-4000-8000-000000000001',4,'material','Acrylic Sheet 8x4','Acrylic shutters',
   'shutter_finish == "acrylic"','(base_rft+wall_rft+loft_rft)*0.30','sheet'),
 ('d0000000-0000-4000-8000-000000000001',5,'material','Natural Veneer 8x4','Veneer shutters',
   'shutter_finish == "veneer"','(base_rft+wall_rft+loft_rft)*0.30','sheet'),
 ('d0000000-0000-4000-8000-000000000001',6,'material','2mm PVC Edge Band','Edge banding',null,'(base_rft+wall_rft+loft_rft)*6','rft'),
 ('d0000000-0000-4000-8000-000000000001',7,'hardware','Soft-close Hinge','Soft-close hinges',
   'grade != "economy"','hinges_total','nos'),
 ('d0000000-0000-4000-8000-000000000001',8,'hardware','Standard Auto Hinge','Standard hinges',
   'grade == "economy"','hinges_total','nos'),
 ('d0000000-0000-4000-8000-000000000001',9,'hardware','Soft-close Telescopic Channel','Drawer channels',null,'drawers','pair'),
 ('d0000000-0000-4000-8000-000000000001',10,'hardware','SS Cabinet Handle','Handles',null,'shutter_count + drawers','nos'),
 ('d0000000-0000-4000-8000-000000000001',11,'hardware','Tandem Drawer Box Set','Premium drawer boxes',
   'grade == "luxury"','drawers','set'),
 ('d0000000-0000-4000-8000-000000000001',12,'hardware','Hydraulic Lift-up Fitting','Lift-up fitting',
   'tall_unit','1','nos'),
 -- WARDROBE
 ('d0000000-0000-4000-8000-000000000002',1,'material','18mm BWP Plywood','Carcass & shutters (18mm ply)',null,'carcass_sqft','sqft'),
 ('d0000000-0000-4000-8000-000000000002',2,'material','6mm Commercial Ply (Back Panel)','Back panel (6mm)',null,'face_sqft','sqft'),
 ('d0000000-0000-4000-8000-000000000002',3,'material','1mm Laminate','Laminate (front+back)','shutter_finish == "laminate"','face_sqft/16','sheet'),
 ('d0000000-0000-4000-8000-000000000002',4,'material','Acrylic Sheet 8x4','Acrylic shutters','shutter_finish == "acrylic"','face_sqft/32','sheet'),
 ('d0000000-0000-4000-8000-000000000002',5,'material','Natural Veneer 8x4','Veneer shutters','shutter_finish == "veneer"','face_sqft/32','sheet'),
 ('d0000000-0000-4000-8000-000000000002',6,'material','5mm Mirror','Sliding shutter mirror','type == "sliding"','face_sqft*0.5','sqft'),
 ('d0000000-0000-4000-8000-000000000002',7,'material','2mm PVC Edge Band','Edge banding',null,'carcass_sqft*0.8','rft'),
 ('d0000000-0000-4000-8000-000000000002',8,'hardware','Soft-close Hinge','Soft-close hinges','type == "hinged" && grade != "economy"','hinges_total','nos'),
 ('d0000000-0000-4000-8000-000000000002',9,'hardware','Standard Auto Hinge','Standard hinges','type == "hinged" && grade == "economy"','hinges_total','nos'),
 ('d0000000-0000-4000-8000-000000000002',10,'hardware','Soft-close Telescopic Channel','Drawer channels',null,'drawers','pair'),
 ('d0000000-0000-4000-8000-000000000002',11,'hardware','SS Cabinet Handle','Handles',null,'shutter_count + drawers','nos'),
 -- TV UNIT
 ('d0000000-0000-4000-8000-000000000003',1,'material','18mm BWP Plywood','Storage carcass + panel substrate',null,'storage_rft*9 + panel_sqft*1.05','sqft'),
 ('d0000000-0000-4000-8000-000000000003',2,'material','6mm Commercial Ply (Back Panel)','Back panel (6mm)',null,'storage_rft*2.4','sqft'),
 ('d0000000-0000-4000-8000-000000000003',3,'material','1mm Laminate','Laminate finish','shutter_finish == "laminate"','(panel_sqft + storage_rft*4)/32','sheet'),
 ('d0000000-0000-4000-8000-000000000003',4,'material','Acrylic Sheet 8x4','Acrylic finish','shutter_finish == "acrylic"','panel_sqft/32','sheet'),
 ('d0000000-0000-4000-8000-000000000003',5,'material','Natural Veneer 8x4','Veneer finish','shutter_finish == "veneer"','panel_sqft/32','sheet'),
 ('d0000000-0000-4000-8000-000000000003',6,'material','2mm PVC Edge Band','Edge banding',null,'storage_rft*5','rft'),
 ('d0000000-0000-4000-8000-000000000003',7,'hardware','Soft-close Hinge','Hinges',null,'shutter_count*2','nos'),
 ('d0000000-0000-4000-8000-000000000003',8,'hardware','Soft-close Telescopic Channel','Drawer channels',null,'drawers','pair'),
 ('d0000000-0000-4000-8000-000000000003',9,'hardware','SS Cabinet Handle','Handles',null,'shutter_count + drawers','nos'),
 -- FALSE CEILING
 ('d0000000-0000-4000-8000-000000000004',1,'material','Gypsum Board 12.5mm','Gypsum board','type == "gypsum"','area','sqft'),
 ('d0000000-0000-4000-8000-000000000004',2,'material','GI Framework','GI framework','type == "gypsum"','area','sqft'),
 ('d0000000-0000-4000-8000-000000000004',3,'material','POP Punning','POP punning','type == "pop"','area','sqft'),
 ('d0000000-0000-4000-8000-000000000004',4,'material','LED Strip','Cove lighting strip','cove_lighting','cove_rft','rft'),
 -- WALL PANELING
 ('d0000000-0000-4000-8000-000000000005',1,'material','18mm MDF','Paneling substrate',null,'ply_sqft','sqft'),
 ('d0000000-0000-4000-8000-000000000005',2,'material','1mm Laminate','Laminate finish','finish == "laminate"','area/32','sheet'),
 ('d0000000-0000-4000-8000-000000000005',3,'material','Natural Veneer 8x4','Veneer finish','finish == "veneer"','area/32','sheet'),
 ('d0000000-0000-4000-8000-000000000005',4,'material','Acrylic Sheet 8x4','Acrylic finish','finish == "acrylic"','area/32','sheet'),
 ('d0000000-0000-4000-8000-000000000005',5,'material','2mm PVC Edge Band','Edge banding',null,'area*0.3','rft'),
 -- FLOORING
 ('d0000000-0000-4000-8000-000000000006',1,'material','Vitrified Tile 2x2','Vitrified tiles','material == "vitrified"','area','sqft'),
 ('d0000000-0000-4000-8000-000000000006',2,'material','Laminate Wooden Flooring','Wooden flooring','material == "laminate_wood"','area','sqft'),
 ('d0000000-0000-4000-8000-000000000006',3,'material','Italian Marble','Marble','material == "marble"','area','sqft'),
 -- LIGHTING
 ('d0000000-0000-4000-8000-000000000007',1,'material','LED Profile Light','Profile lights',null,'profile_rft','rft'),
 ('d0000000-0000-4000-8000-000000000007',2,'material','LED Spot Light','Spot lights',null,'spots','nos'),
 ('d0000000-0000-4000-8000-000000000007',3,'material','LED Strip','LED strip',null,'strip_rft','rft'),
 ('d0000000-0000-4000-8000-000000000007',4,'material','LED Driver','Drivers',null,'drivers','nos'),
 -- ELECTRICAL
 ('d0000000-0000-4000-8000-000000000008',1,'material','Modular Switch Point','Switch points',null,'points','point'),
 ('d0000000-0000-4000-8000-000000000008',2,'material','1.5sqmm FR Wire','Wiring',null,'wire_m','rmt'),
 ('d0000000-0000-4000-8000-000000000008',3,'material','MCB 16A','MCBs',null,'mcb_count','nos'),
 -- PAINTING
 ('d0000000-0000-4000-8000-000000000010',1,'material','Interior Emulsion','Emulsion paint',null,'paint_litres','litre'),
 ('d0000000-0000-4000-8000-000000000010',2,'material','Primer','Primer',null,'primer_litres','litre'),
 ('d0000000-0000-4000-8000-000000000010',3,'material','Putty','Wall putty',null,'putty_kg','kg'),
 -- FURNITURE
 ('d0000000-0000-4000-8000-000000000011',1,'material','Designer Furniture (allowance)','Furniture allowance',null,'units_n','nos'),
 -- DECOR
 ('d0000000-0000-4000-8000-000000000012',1,'material','Decor & Soft Furnishing (allowance)','Decor allowance',null,'lots','lumpsum'),
 -- CUSTOM CARPENTRY
 ('d0000000-0000-4000-8000-000000000013',1,'material','18mm BWP Plywood','Carcass (18mm ply)',null,'carcass_sqft','sqft'),
 ('d0000000-0000-4000-8000-000000000013',2,'material','1mm Laminate','Laminate finish','shutter_finish == "laminate"','face_sqft/16','sheet'),
 ('d0000000-0000-4000-8000-000000000013',3,'material','Natural Veneer 8x4','Veneer finish','shutter_finish == "veneer"','face_sqft/32','sheet'),
 ('d0000000-0000-4000-8000-000000000013',4,'material','PU Finish','PU finish','shutter_finish == "pu"','face_sqft','sqft'),
 ('d0000000-0000-4000-8000-000000000013',5,'material','2mm PVC Edge Band','Edge banding',null,'run_rft*4','rft'),
 -- SMART HOME (device stand-in; dedicated SKUs to be added)
 ('d0000000-0000-4000-8000-000000000014',1,'material','Modular Switch Point','Smart switch/device',null,'devices_n','point')
) v(tid, seq, kind, pname, label, cond, formula, uom)
join catalog_products p on p.name = v.pname and p.firm_id is null;
