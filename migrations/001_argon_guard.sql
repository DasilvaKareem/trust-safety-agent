CREATE SCHEMA IF NOT EXISTS argon_guard;
CREATE TABLE IF NOT EXISTS argon_guard.records (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  expires_at timestamptz
);
CREATE INDEX IF NOT EXISTS records_expiry ON argon_guard.records (expires_at) WHERE expires_at IS NOT NULL;
CREATE TABLE IF NOT EXISTS argon_guard.set_members (
  key text NOT NULL,
  member text NOT NULL,
  PRIMARY KEY (key, member)
);
CREATE TABLE IF NOT EXISTS argon_guard.deployments (
  id text PRIMARY KEY,
  owner_id text,
  created_at bigint NOT NULL,
  status text NOT NULL,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS deployments_owner_created ON argon_guard.deployments (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS deployments_created ON argon_guard.deployments (created_at DESC);
CREATE INDEX IF NOT EXISTS deployments_review ON argon_guard.deployments (status) WHERE status = 'review';
