export const initialMigrationSql = `
CREATE TABLE IF NOT EXISTS pregnancy_profiles (
  id TEXT PRIMARY KEY,
  estimated_due_date TEXT,
  gestational_age_at_setup_days INTEGER,
  region TEXT NOT NULL CHECK (region IN ('US', 'UK', 'EU', 'OTHER')),
  care_team_phone TEXT,
  birth_location_phone TEXT,
  doula_name TEXT,
  doula_phone TEXT,
  emergency_phone TEXT NOT NULL,
  planned_cesarean INTEGER NOT NULL DEFAULT 0,
  high_risk_or_call_early INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_rules (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES pregnancy_profiles(id) ON DELETE CASCADE,
  interval_seconds_max INTEGER NOT NULL,
  duration_seconds_min INTEGER NOT NULL,
  observation_window_minutes INTEGER NOT NULL,
  label TEXT NOT NULL,
  action_text TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('user_provider', 'app_default')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'closed')),
  content_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contraction_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  start_at TEXT NOT NULL,
  end_at TEXT,
  start_monotonic_ms REAL,
  end_monotonic_ms REAL,
  start_boot_id TEXT,
  end_boot_id TEXT,
  timezone TEXT NOT NULL,
  intensity TEXT CHECK (intensity IN ('mild', 'moderate', 'strong', 'cannot_talk_walk')),
  note TEXT,
  manually_edited INTEGER NOT NULL DEFAULT 0,
  clock_change_suspected INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (end_at IS NULL OR end_at >= start_at)
);

CREATE INDEX IF NOT EXISTS idx_contraction_events_session_start
  ON contraction_events(session_id, start_at);

CREATE INDEX IF NOT EXISTS idx_contraction_events_session_deleted
  ON contraction_events(session_id, deleted_at);

CREATE TABLE IF NOT EXISTS urgent_events (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  timezone TEXT NOT NULL,
  note TEXT,
  source_ids_json TEXT NOT NULL,
  consent_to_record INTEGER NOT NULL DEFAULT 0,
  content_version TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS event_revisions (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS share_packs (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  range_start TEXT NOT NULL,
  range_end TEXT NOT NULL,
  target TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('plain_text', 'pdf', 'csv')),
  include_notes INTEGER NOT NULL,
  include_urgent_events INTEGER NOT NULL,
  local_file_uri TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS app_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;
