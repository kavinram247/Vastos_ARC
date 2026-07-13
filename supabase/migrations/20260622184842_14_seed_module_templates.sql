-- ─────────────────────────────────────────────────────────────
-- Seed E1: module templates (param schema + derived-variable formulas)
-- derived_vars is an ORDERED array; engine evaluates top-down before rules.
-- ─────────────────────────────────────────────────────────────
insert into module_templates (id, firm_id, code, name, category, description, param_schema, derived_vars) values
-- 1. MODULAR KITCHEN
('d0000000-0000-4000-8000-000000000001', null, 'KITCHEN_MODULAR','Modular Kitchen','modular_kitchen',
 'Base + wall + optional loft units, carcass + shutters + hardware',
 '{"base_run_mm":{"type":"number","default":3000,"min":600},"wall_run_mm":{"type":"number","default":2400,"min":0},"loft":{"type":"boolean","default":false},"loft_run_mm":{"type":"number","default":0},"drawers":{"type":"number","default":4,"min":0},"shutter_finish":{"type":"enum","values":["laminate","acrylic","veneer"],"default":"laminate"},"tall_unit":{"type":"boolean","default":false}}',
 '[{"name":"base_rft","formula":"base_run_mm/304.8"},{"name":"wall_rft","formula":"wall_run_mm/304.8"},{"name":"loft_rft","formula":"loft ? loft_run_mm/304.8 : 0"},{"name":"total_rft","formula":"base_rft+wall_rft+loft_rft"},{"name":"shutter_count","formula":"round((base_rft+wall_rft)/1.5)"},{"name":"hinges_total","formula":"shutter_count*2 + round(loft_rft/1.5)*2"}]'),
-- 2. WARDROBE
('d0000000-0000-4000-8000-000000000002', null, 'WARDROBE','Wardrobe','wardrobe',
 'Hinged or sliding wardrobe, full-height carcass + shutters',
 '{"width_mm":{"type":"number","default":2400,"min":600},"height_mm":{"type":"number","default":2400,"min":1800},"depth_mm":{"type":"number","default":600},"type":{"type":"enum","values":["hinged","sliding"],"default":"hinged"},"drawers":{"type":"number","default":3},"shutter_finish":{"type":"enum","values":["laminate","acrylic","veneer"],"default":"laminate"},"loft":{"type":"boolean","default":true}}',
 '[{"name":"width_ft","formula":"width_mm/304.8"},{"name":"height_ft","formula":"height_mm/304.8"},{"name":"depth_ft","formula":"depth_mm/304.8"},{"name":"face_sqft","formula":"width_ft*height_ft"},{"name":"carcass_sqft","formula":"face_sqft*1.9"},{"name":"shutter_count","formula":"type==\"sliding\" ? 2 : round(width_ft/1.5)"},{"name":"hinges_total","formula":"type==\"sliding\" ? 0 : shutter_count*(height_mm<=1500?3:4)"}]'),
-- 3. TV UNIT
('d0000000-0000-4000-8000-000000000003', null, 'TV_UNIT','TV Unit','tv_unit',
 'Wall-mounted / floor TV unit with paneling and storage',
 '{"width_mm":{"type":"number","default":2400,"min":900},"height_mm":{"type":"number","default":2700},"panel_area_sqft":{"type":"number","default":0},"drawers":{"type":"number","default":2},"shutter_finish":{"type":"enum","values":["laminate","acrylic","veneer"],"default":"laminate"}}',
 '[{"name":"width_ft","formula":"width_mm/304.8"},{"name":"height_ft","formula":"height_mm/304.8"},{"name":"panel_sqft","formula":"panel_area_sqft>0 ? panel_area_sqft : width_ft*height_ft"},{"name":"storage_rft","formula":"width_ft"},{"name":"shutter_count","formula":"round(width_ft/1.5)"}]'),
-- 4. FALSE CEILING
('d0000000-0000-4000-8000-000000000004', null, 'FALSE_CEILING','False Ceiling','false_ceiling',
 'Gypsum / POP false ceiling by area',
 '{"area_sqft":{"type":"number","default":120,"min":1},"type":{"type":"enum","values":["gypsum","pop"],"default":"gypsum"},"cove_lighting":{"type":"boolean","default":true},"perimeter_rft":{"type":"number","default":0}}',
 '[{"name":"area","formula":"area_sqft"},{"name":"cove_rft","formula":"cove_lighting ? (perimeter_rft>0 ? perimeter_rft : 4*sqrt(area_sqft)) : 0"}]'),
-- 5. WALL PANELING
('d0000000-0000-4000-8000-000000000005', null, 'WALL_PANELING','Wall Paneling','wall_paneling',
 'Decorative wall paneling by area',
 '{"area_sqft":{"type":"number","default":80,"min":1},"finish":{"type":"enum","values":["laminate","veneer","acrylic","fabric"],"default":"laminate"}}',
 '[{"name":"area","formula":"area_sqft"},{"name":"ply_sqft","formula":"area_sqft*1.05"}]'),
-- 6. FLOORING
('d0000000-0000-4000-8000-000000000006', null, 'FLOORING','Flooring','flooring',
 'Tile / laminate / marble flooring by area',
 '{"area_sqft":{"type":"number","default":150,"min":1},"material":{"type":"enum","values":["vitrified","laminate_wood","marble"],"default":"vitrified"}}',
 '[{"name":"area","formula":"area_sqft"}]'),
-- 7. LIGHTING
('d0000000-0000-4000-8000-000000000007', null, 'LIGHTING','Lighting','lighting',
 'Profile / spot / strip lighting',
 '{"profile_rft":{"type":"number","default":0},"spots":{"type":"number","default":6},"strip_rft":{"type":"number","default":0}}',
 '[{"name":"drivers","formula":"ceil((profile_rft+strip_rft)/16) + ceil(spots/8)"}]'),
-- 8. ELECTRICAL
('d0000000-0000-4000-8000-000000000008', null, 'ELECTRICAL','Electrical Works','electrical',
 'Points, wiring and DB by point count',
 '{"points":{"type":"number","default":20,"min":1},"wire_per_point_m":{"type":"number","default":8},"mcb_count":{"type":"number","default":4}}',
 '[{"name":"wire_m","formula":"points*wire_per_point_m"}]'),
-- 9. CIVIL
('d0000000-0000-4000-8000-000000000009', null, 'CIVIL','Civil Works','civil',
 'Masonry / civil work by area',
 '{"area_sqft":{"type":"number","default":50,"min":1}}',
 '[{"name":"area","formula":"area_sqft"}]'),
-- 10. PAINTING
('d0000000-0000-4000-8000-000000000010', null, 'PAINTING','Painting','painting',
 'Interior emulsion painting by wall area',
 '{"wall_area_sqft":{"type":"number","default":400,"min":1},"coats":{"type":"number","default":2}}',
 '[{"name":"area","formula":"wall_area_sqft"},{"name":"paint_litres","formula":"area*coats/120"},{"name":"primer_litres","formula":"area/140"},{"name":"putty_kg","formula":"area/18"}]'),
-- 11. FURNITURE
('d0000000-0000-4000-8000-000000000011', null, 'FURNITURE','Furniture','furniture',
 'Loose / built-in furniture allowance',
 '{"units":{"type":"number","default":1,"min":1},"unit_allowance":{"type":"number","default":15000}}',
 '[{"name":"units_n","formula":"units"}]'),
-- 12. DECOR
('d0000000-0000-4000-8000-000000000012', null, 'DECOR','Decor & Styling','decor',
 'Soft furnishing & decor allowance',
 '{"allowance":{"type":"number","default":50000}}',
 '[{"name":"lots","formula":"1"}]'),
-- 13. CUSTOM CARPENTRY
('d0000000-0000-4000-8000-000000000013', null, 'CUSTOM_CARPENTRY','Custom Carpentry','custom_carpentry',
 'Custom built carpentry by running feet',
 '{"run_mm":{"type":"number","default":1200,"min":300},"height_mm":{"type":"number","default":900},"depth_mm":{"type":"number","default":500},"shutter_finish":{"type":"enum","values":["laminate","veneer","pu"],"default":"laminate"}}',
 '[{"name":"run_rft","formula":"run_mm/304.8"},{"name":"face_sqft","formula":"(run_mm/304.8)*(height_mm/304.8)"},{"name":"carcass_sqft","formula":"run_rft*9"}]'),
-- 14. SMART HOME
('d0000000-0000-4000-8000-000000000014', null, 'SMART_HOME','Smart Home','smart_home',
 'Smart switches, sensors & automation by device count',
 '{"devices":{"type":"number","default":8,"min":1},"device_cost":{"type":"number","default":3500}}',
 '[{"name":"devices_n","formula":"devices"}]');
