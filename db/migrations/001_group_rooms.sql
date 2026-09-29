-- PostgreSQL target schema for moving group rooms off the local JSON demo store.
-- Invite and participant credentials are one-way hashes; role briefs are derived server-side.
CREATE TABLE group_rooms (
  id uuid PRIMARY KEY,
  public_code text NOT NULL UNIQUE,
  template text NOT NULL CHECK (template IN ('client-seller', 'project-team', 'solo-board')),
  status text NOT NULL CHECK (status IN ('waiting', 'active', 'completed')),
  invite_hash char(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE group_room_members (
  id uuid PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES group_rooms(id) ON DELETE CASCADE,
  display_name varchar(40) NOT NULL,
  role text NOT NULL CHECK (role IN ('seller', 'client', 'project-lead', 'analyst')),
  access_token_hash char(64) NOT NULL UNIQUE,
  finished boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, role)
);

CREATE TABLE group_room_messages (
  id uuid PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES group_rooms(id) ON DELETE CASCADE,
  author_member_id uuid REFERENCES group_room_members(id) ON DELETE SET NULL,
  author_label varchar(60) NOT NULL,
  author_role varchar(60) NOT NULL,
  body varchar(2000) NOT NULL,
  is_bot boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX group_room_messages_timeline ON group_room_messages(room_id, created_at, id);
CREATE INDEX group_room_members_room ON group_room_members(room_id);

CREATE TABLE group_matchmaking_tickets (
  id uuid PRIMARY KEY,
  participant_search_token_hash char(64) NOT NULL UNIQUE,
  display_name varchar(40) NOT NULL,
  room_id uuid REFERENCES group_rooms(id) ON DELETE SET NULL,
  member_id uuid REFERENCES group_room_members(id) ON DELETE SET NULL,
  state text NOT NULL CHECK (state IN ('waiting', 'matched', 'cancelled', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX group_matchmaking_waiting ON group_matchmaking_tickets(created_at) WHERE state = 'waiting';

-- NOTE: group-rooms JSON store remains in use until a later cutover; schema above is the target.
