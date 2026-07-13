-- ─────────────────────────────────────────────────────────────
-- Vasto BOQ — Migration 01: Extensions + Enums
-- ─────────────────────────────────────────────────────────────
create extension if not exists pgcrypto;     -- gen_random_uuid (also core in PG17)
create extension if not exists ltree;         -- category hierarchy paths
create extension if not exists pg_trgm;       -- fuzzy catalog search
create extension if not exists vector;        -- pgvector for RAG / material recommendation

-- ── Domain enums ──────────────────────────────────────────────
create type user_role          as enum ('owner','architect','engineer','client');

create type catalog_kind       as enum ('material','labour','service');
create type uom                 as enum ('sqft','sqm','rft','rmt','nos','sheet','set','pair','litre','kg','box','bag','point','day','hour','lumpsum','cum');
create type quality_grade       as enum ('economy','standard','premium','luxury');
create type alternate_relation  as enum ('upgrade','downgrade','equivalent');

create type rate_source         as enum ('vendor_quote','market_survey','calibrated','manual','price_list');
create type vendor_status       as enum ('active','preferred','probation','blacklisted','inactive');

create type module_output_kind  as enum ('material','labour','hardware','service');
create type room_type           as enum ('kitchen','living','dining','master_bedroom','bedroom','kids_room','bathroom','balcony','study','pooja','utility','foyer','office','retail','other');

create type boq_status          as enum ('draft','in_review','approved','sent','accepted','rejected','superseded');
create type boq_line_source     as enum ('engine','ai_suggested','manual','catalog_pick');
create type approval_decision   as enum ('approved','rejected','changes_requested');

create type po_status           as enum ('draft','issued','partially_received','received','closed','cancelled');
create type quotation_doc_type  as enum ('customer','internal_costing','procurement','vendor_rfq');

create type project_priority    as enum ('balanced','speed','margin','quality');
create type extraction_status   as enum ('pending','processing','needs_review','confirmed','failed');
