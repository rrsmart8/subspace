PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  currency TEXT NOT NULL DEFAULT 'RON' CHECK(currency = 'RON'),
  tier INTEGER NOT NULL CHECK(tier BETWEEN 1 AND 3),
  cash_bani INTEGER NOT NULL CHECK(cash_bani >= 0),
  state_json TEXT NOT NULL CHECK(json_valid(state_json))
);
CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  content_json TEXT NOT NULL CHECK(json_valid(content_json))
);
CREATE TABLE IF NOT EXISTS requests (
  account_id TEXT NOT NULL REFERENCES accounts(id),
  request_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  response TEXT NOT NULL,
  PRIMARY KEY(account_id, request_id)
);

CREATE TABLE IF NOT EXISTS account_creations (
  request_id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  response TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS accounts_email ON accounts(lower(json_extract(state_json, '$.profile.email')));

CREATE TABLE IF NOT EXISTS performance_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  run_id TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  body_json TEXT NOT NULL CHECK(json_valid(body_json))
);
CREATE INDEX IF NOT EXISTS performance_snapshot_run ON performance_snapshots(account_id, run_id, id);
