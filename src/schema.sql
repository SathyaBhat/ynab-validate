-- AmEx Transaction Database Schema

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  date_processed TEXT NOT NULL,
  description TEXT NOT NULL,
  card_member TEXT NOT NULL,
  account_number TEXT NOT NULL,
  amount REAL NOT NULL,
  foreign_spend_amount TEXT,
  commission TEXT,
  exchange_rate TEXT,
  additional_information TEXT,
  appears_on_statement TEXT,
  address TEXT,
  town_city TEXT,
  postcode TEXT,
  country TEXT,
  reference TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  reconciled BOOLEAN DEFAULT 0,
  ynab_transaction_id TEXT,
  reconciled_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(reference);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_card_member ON transactions(card_member);
CREATE INDEX IF NOT EXISTS idx_transactions_reconciled ON transactions(reconciled);
CREATE INDEX IF NOT EXISTS idx_transactions_ynab_id ON transactions(ynab_transaction_id);

CREATE TABLE IF NOT EXISTS import_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  total_records INTEGER NOT NULL,
  imported_records INTEGER NOT NULL,
  skipped_records INTEGER NOT NULL,
  error_count INTEGER NOT NULL,
  errors TEXT,
  import_timestamp TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_import_logs_timestamp ON import_logs(import_timestamp);

CREATE TABLE IF NOT EXISTS reconciliation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  budget_id TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  matched_count INTEGER NOT NULL,
  missing_in_ynab_count INTEGER NOT NULL,
  unexpected_in_ynab_count INTEGER NOT NULL,
  flagged_count INTEGER DEFAULT 0,
  created_in_ynab_count INTEGER DEFAULT 0,
  reconciled_at TEXT NOT NULL,
  config TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_logs_budget ON reconciliation_logs(budget_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_logs_date ON reconciliation_logs(reconciled_at);
