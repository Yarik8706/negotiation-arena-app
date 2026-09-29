-- Core persistence for scenarios, attempts, and profiles.
-- Group rooms stay on the JSON demo store for now; see 001_group_rooms.sql for the target schema.

CREATE TABLE IF NOT EXISTS _migrations (
  id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scenarios (
  id text PRIMARY KEY,
  payload jsonb NOT NULL,
  version int NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attempts (
  id uuid PRIMARY KEY,
  scenario_id text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS attempts_scenario_id ON attempts (scenario_id);
CREATE INDEX IF NOT EXISTS attempts_status ON attempts (status);
CREATE INDEX IF NOT EXISTS attempts_profile_id ON attempts ((payload->>'profileId'));
CREATE INDEX IF NOT EXISTS attempts_updated_at ON attempts (updated_at DESC);

CREATE TABLE IF NOT EXISTS profiles (
  id text PRIMARY KEY,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
