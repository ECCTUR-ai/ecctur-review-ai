-- Migration: Update action_resolutions table unique constraint to exclude source_period
ALTER TABLE action_resolutions DROP CONSTRAINT IF EXISTS action_resolutions_hotel_id_action_key_source_period_key;

-- Delete any existing duplicates before applying unique constraint
DELETE FROM action_resolutions a USING action_resolutions b 
  WHERE a.id > b.id AND a.hotel_id = b.hotel_id AND a.action_key = b.action_key;

-- Add new unique constraint on hotel_id + action_key
ALTER TABLE action_resolutions ADD CONSTRAINT action_resolutions_hotel_id_action_key_key UNIQUE (hotel_id, action_key);
