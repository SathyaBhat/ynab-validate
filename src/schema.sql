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
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(reference);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_card_member ON transactions(card_member);

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
