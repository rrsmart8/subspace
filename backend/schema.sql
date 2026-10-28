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
