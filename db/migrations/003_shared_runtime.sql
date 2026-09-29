-- Room history uses normalized rows. Only delivery credentials are encrypted.
ALTER TABLE group_matchmaking_tickets ADD COLUMN room_token_cipher text;
ALTER TABLE group_matchmaking_tickets ADD COLUMN delivered boolean NOT NULL DEFAULT false;
CREATE INDEX group_rooms_updated_at ON group_rooms(updated_at);
ALTER TABLE group_room_messages ADD COLUMN sequence bigint GENERATED ALWAYS AS IDENTITY;
CREATE INDEX attempts_ranking_period ON attempts(scenario_id, status, created_at);
