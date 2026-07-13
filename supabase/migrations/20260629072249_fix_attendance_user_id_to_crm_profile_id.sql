
-- Fix attendance records where user_id was stored as profiles.id instead of crm_profiles.id.
-- For any authenticated user, profiles.id ≠ crm_profiles.id (separate UUID namespaces).
-- The owner register looks up by crm_profiles.id, so we must align.
UPDATE attendance_records ar
SET
  user_id = cp.id::text,
  user_name = COALESCE(cp.full_name, ar.user_name)
FROM profiles p
JOIN crm_profiles cp ON cp.email = p.email AND cp.firm_id = p.firm_id
WHERE ar.user_id = p.id::text
  AND ar.user_id != cp.id::text;
