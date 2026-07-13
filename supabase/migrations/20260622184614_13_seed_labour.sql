-- ─────────────────────────────────────────────────────────────
-- Seed D: labour activities (global) + national labour rate cards
-- ─────────────────────────────────────────────────────────────
insert into labour_activities (code, name, base_uom, trade) values
 ('CARP_MODULAR','Modular carcass making & assembly','rft','carpentry'),
 ('CARP_INSTALL','On-site carpentry installation','rft','carpentry'),
 ('CARP_CUSTOM','Custom carpentry (loose/built-in)','rft','carpentry'),
 ('LAM_PASTING','Laminate pasting','sqft','carpentry'),
 ('POLISH_PU','PU polishing labour','sqft','polishing'),
 ('POLISH_MELAMINE','Melamine polishing labour','sqft','polishing'),
 ('CEIL_GYPSUM','Gypsum false ceiling (incl framework labour)','sqft','civil'),
 ('CEIL_POP','POP false ceiling','sqft','civil'),
 ('PAINT_INTERIOR','Interior painting labour','sqft','painting'),
 ('ELEC_POINT','Electrical point wiring','point','electrical'),
 ('TILE_LAYING','Tile / vitrified laying','sqft','civil'),
 ('MARBLE_LAYING','Marble laying & polishing','sqft','civil'),
 ('CIVIL_MASONRY','Civil masonry work','sqft','civil'),
 ('PANEL_INSTALL','Wall paneling installation','sqft','carpentry'),
 ('GLASS_INSTALL','Glass / mirror installation','sqft','installation'),
 ('SMART_INSTALL','Smart home device installation','point','electrical');

insert into rate_cards (firm_id, region_id, labour_activity_id, rate, source, valid_from)
select '11111111-1111-4111-8111-111111111111', null, la.id, v.rate, 'market_survey', current_date
from (values
 ('CARP_MODULAR',350),('CARP_INSTALL',120),('CARP_CUSTOM',420),('LAM_PASTING',25),
 ('POLISH_PU',35),('POLISH_MELAMINE',18),('CEIL_GYPSUM',65),('CEIL_POP',45),
 ('PAINT_INTERIOR',18),('ELEC_POINT',250),('TILE_LAYING',45),('MARBLE_LAYING',85),
 ('CIVIL_MASONRY',120),('PANEL_INSTALL',90),('GLASS_INSTALL',40),('SMART_INSTALL',800)
) v(code, rate)
join labour_activities la on la.code = v.code and la.firm_id is null;
