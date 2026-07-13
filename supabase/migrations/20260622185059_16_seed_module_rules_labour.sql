-- ─────────────────────────────────────────────────────────────
-- Seed E3: module_rules — labour outputs
-- ─────────────────────────────────────────────────────────────
insert into module_rules (template_id, seq, output_kind, labour_activity_id, label, condition, qty_formula, uom)
select v.tid::uuid, v.seq, 'labour'::module_output_kind, la.id, v.label, v.cond, v.formula, v.uom::uom
from (values
 -- KITCHEN
 ('d0000000-0000-4000-8000-000000000001',20,'CARP_MODULAR','Carcass making & assembly',null,'total_rft','rft'),
 ('d0000000-0000-4000-8000-000000000001',21,'CARP_INSTALL','Site installation',null,'total_rft','rft'),
 ('d0000000-0000-4000-8000-000000000001',22,'LAM_PASTING','Laminate pasting',null,'(base_rft+wall_rft+loft_rft)*4.8','sqft'),
 -- WARDROBE
 ('d0000000-0000-4000-8000-000000000002',20,'CARP_MODULAR','Carcass making & assembly',null,'face_sqft/2.5','rft'),
 ('d0000000-0000-4000-8000-000000000002',21,'CARP_INSTALL','Site installation',null,'face_sqft/2.5','rft'),
 ('d0000000-0000-4000-8000-000000000002',22,'LAM_PASTING','Laminate pasting','shutter_finish == "laminate"','face_sqft*2','sqft'),
 -- TV UNIT
 ('d0000000-0000-4000-8000-000000000003',20,'CARP_MODULAR','Carcass making & assembly',null,'storage_rft + panel_sqft/4','rft'),
 ('d0000000-0000-4000-8000-000000000003',21,'CARP_INSTALL','Site installation',null,'storage_rft + panel_sqft/4','rft'),
 ('d0000000-0000-4000-8000-000000000003',22,'LAM_PASTING','Laminate pasting','shutter_finish == "laminate"','panel_sqft + storage_rft*4','sqft'),
 -- FALSE CEILING
 ('d0000000-0000-4000-8000-000000000004',20,'CEIL_GYPSUM','Gypsum ceiling labour','type == "gypsum"','area','sqft'),
 ('d0000000-0000-4000-8000-000000000004',21,'CEIL_POP','POP ceiling labour','type == "pop"','area','sqft'),
 -- WALL PANELING
 ('d0000000-0000-4000-8000-000000000005',20,'PANEL_INSTALL','Paneling installation',null,'area','sqft'),
 ('d0000000-0000-4000-8000-000000000005',21,'LAM_PASTING','Laminate/veneer pasting',null,'area','sqft'),
 -- FLOORING
 ('d0000000-0000-4000-8000-000000000006',20,'TILE_LAYING','Tile/wood laying','material != "marble"','area','sqft'),
 ('d0000000-0000-4000-8000-000000000006',21,'MARBLE_LAYING','Marble laying & polishing','material == "marble"','area','sqft'),
 -- LIGHTING
 ('d0000000-0000-4000-8000-000000000007',20,'ELEC_POINT','Lighting wiring & fixing',null,'spots + ceil(profile_rft/10) + ceil(strip_rft/10)','point'),
 -- ELECTRICAL
 ('d0000000-0000-4000-8000-000000000008',20,'ELEC_POINT','Point wiring',null,'points','point'),
 -- CIVIL
 ('d0000000-0000-4000-8000-000000000009',20,'CIVIL_MASONRY','Civil masonry',null,'area','sqft'),
 -- PAINTING
 ('d0000000-0000-4000-8000-000000000010',20,'PAINT_INTERIOR','Painting labour',null,'area','sqft'),
 -- CUSTOM CARPENTRY
 ('d0000000-0000-4000-8000-000000000013',20,'CARP_CUSTOM','Custom carpentry',null,'run_rft','rft'),
 ('d0000000-0000-4000-8000-000000000013',21,'LAM_PASTING','Laminate pasting','shutter_finish == "laminate"','face_sqft*2','sqft'),
 ('d0000000-0000-4000-8000-000000000013',22,'POLISH_PU','PU polishing','shutter_finish == "pu"','face_sqft','sqft'),
 -- SMART HOME
 ('d0000000-0000-4000-8000-000000000014',20,'SMART_INSTALL','Device installation',null,'devices_n','point')
) v(tid, seq, code, label, cond, formula, uom)
join labour_activities la on la.code = v.code and la.firm_id is null;
