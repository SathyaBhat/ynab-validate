import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import type { AmExTransaction, AmExTransactionRow, ImportLog } from './types/index';

let db: Database.Database | null = null;

/**
 * Initialize database and create tables if they don't exist
 */
export function initializeDatabase(dbPath: string = 'db/transactions.db'): Database.Database {
  // Ensure db directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Run migrations FIRST for existing databases
  runMigrations(db);

  // Then execute schema (which will create tables/indexes if they don't exist)
  const schemaPath = path.join(__dirname, '..', 'src', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  return db;
}

/**
 * Run database migrations for existing databases
 */
function runMigrations(database: Database.Database): void {
  // Check if transactions table exists first
  const tables = database.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='transactions'"
  ).all() as Array<{ name: string }>;

  if (tables.length === 0) {
    // Table doesn't exist yet, schema will create it
    return;
  }

  // Check if reconciliation columns exist
  const tableInfo = database.prepare("PRAGMA table_info(transactions)").all() as Array<{ name: string }>;
  const columnNames = tableInfo.map(col => col.name);

  // Add reconciliation columns if they don't exist
  if (!columnNames.includes('reconciled')) {
    console.log('Adding reconciled column to transactions table');
    database.exec('ALTER TABLE transactions ADD COLUMN reconciled BOOLEAN DEFAULT 0');
  }
  if (!columnNames.includes('ynab_transaction_id')) {
    console.log('Adding ynab_transaction_id column to transactions table');
    database.exec('ALTER TABLE transactions ADD COLUMN ynab_transaction_id TEXT');
  }
  if (!columnNames.includes('reconciled_at')) {
    console.log('Adding reconciled_at column to transactions table');
    database.exec('ALTER TABLE transactions ADD COLUMN reconciled_at TEXT');
  }
}

/**
 * Get database instance (throws if not initialized)
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Insert a single transaction
 */
export function insertTransaction(transaction: AmExTransaction): AmExTransactionRow {
  const database = getDatabase();
  const now = new Date().toISOString();

  const stmt = database.prepare(`
    INSERT INTO transactions (
      date, date_processed, description, card_member, account_number,
      amount, foreign_spend_amount, commission, exchange_rate,
      additional_information, appears_on_statement, address, town_city,
      postcode, country, reference, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    transaction.date,
    transaction.dateProcessed,
    transaction.description,
    transaction.cardMember,
    transaction.accountNumber,
    transaction.amount,
    transaction.foreignSpendAmount || null,
    transaction.commission || null,
    transaction.exchangeRate || null,
    transaction.additionalInformation || null,
    transaction.appearsOnStatement,
    transaction.address || null,
    transaction.townCity || null,
    transaction.postcode || null,
    transaction.country,
    transaction.reference,
    now,
    now,
  );

  return getTransactionByReference(transaction.reference) as AmExTransactionRow;
}

/**
 * Batch insert transactions within a transaction
 */
export function batchInsertTransactions(
  transactions: AmExTransaction[],
): { inserted: number; errors: Array<{ index: number; reference: string; error: string }> } {
  const database = getDatabase();
  const errors: Array<{ index: number; reference: string; error: string }> = [];
  let inserted = 0;

  const insertStmt = database.prepare(`
    INSERT INTO transactions (
      date, date_processed, description, card_member, account_number,
      amount, foreign_spend_amount, commission, exchange_rate,
      additional_information, appears_on_statement, address, town_city,
      postcode, country, reference, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = database.transaction((txns: AmExTransaction[]) => {
    const now = new Date().toISOString();
    for (let i = 0; i < txns.length; i++) {
      const txn = txns[i];
      try {
        insertStmt.run(
          txn.date,
          txn.dateProcessed,
          txn.description,
          txn.cardMember,
          txn.accountNumber,
          txn.amount,
          txn.foreignSpendAmount || null,
          txn.commission || null,
          txn.exchangeRate || null,
          txn.additionalInformation || null,
          txn.appearsOnStatement,
          txn.address || null,
          txn.townCity || null,
          txn.postcode || null,
          txn.country,
          txn.reference,
          now,
          now,
        );
        inserted++;
      } catch (err) {
        errors.push({
          index: i,
          reference: txn.reference,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  });

  transaction(transactions);
  return { inserted, errors };
}

/**
 * Check if transaction with reference exists
 */
export function transactionExists(reference: string): boolean {
  const database = getDatabase();
  const stmt = database.prepare('SELECT 1 FROM transactions WHERE reference = ?');
  return stmt.get(reference) !== undefined;
}

/**
 * Transform database row to AmExTransactionRow (ensure all snake_case fields)
 */
function transformTransactionRow(row: any): AmExTransactionRow {
  return {
    id: row.id,
    date: row.date,
    date_processed: row.date_processed,
    description: row.description,
    card_member: row.card_member,
    account_number: row.account_number,
    amount: row.amount,
    foreign_spend_amount: row.foreign_spend_amount,
    commission: row.commission,
    exchange_rate: row.exchange_rate,
    additional_information: row.additional_information,
    appears_on_statement: row.appears_on_statement,
    address: row.address,
    town_city: row.town_city,
    postcode: row.postcode,
    country: row.country,
    reference: row.reference,
    created_at: row.created_at,
    updated_at: row.updated_at,
    reconciled: row.reconciled === 1,
    ynab_transaction_id: row.ynab_transaction_id || undefined,
    reconciled_at: row.reconciled_at || undefined,
  };
}

/**
 * Get transaction by reference
 */
export function getTransactionByReference(reference: string): AmExTransactionRow | null {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM transactions WHERE reference = ?');
  const row = stmt.get(reference) as any;
  if (!row) return null;
  return transformTransactionRow(row);
}

/**
 * Get all transactions with pagination
 */
export function getTransactions(limit: number = 50, offset: number = 0): AmExTransactionRow[] {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT * FROM transactions
    ORDER BY date DESC
    LIMIT ? OFFSET ?
  `);
  const rows = stmt.all(limit, offset) as any[];
  return rows.map(transformTransactionRow);
}

/**
 * Get transaction count
 */
export function getTransactionCount(): number {
  const database = getDatabase();
  const stmt = database.prepare('SELECT COUNT(*) as count FROM transactions');
  const result = stmt.get() as { count: number };
  return result.count;
}

/**
 * Delete transaction by ID
 */
export function deleteTransaction(id: number): boolean {
  const database = getDatabase();
  const stmt = database.prepare('DELETE FROM transactions WHERE id = ?');
  const info = stmt.run(id);
  return (info.changes ?? 0) > 0;
}

/**
 * Insert import log
 */
export function insertImportLog(log: Omit<ImportLog, 'id'>): ImportLog {
  const database = getDatabase();
  const stmt = database.prepare(`
    INSERT INTO import_logs (
      file_name, file_size, total_records, imported_records,
      skipped_records, error_count, errors, import_timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    log.fileName,
    log.fileSize || null,
    log.totalRecords,
    log.importedRecords,
    log.skippedRecords,
    log.errorCount,
    log.errors ? JSON.stringify(log.errors) : null,
    log.importTimestamp,
  );

  // Get the inserted log
  const getStmt = database.prepare(
    'SELECT id, file_name as fileName, file_size as fileSize, total_records as totalRecords, imported_records as importedRecords, skipped_records as skippedRecords, error_count as errorCount, errors, import_timestamp as importTimestamp FROM import_logs ORDER BY id DESC LIMIT 1',
  );
  const result = getStmt.get() as ImportLog & { errors: string | null };
  return {
    ...result,
    errors: result.errors ? JSON.parse(result.errors) : undefined,
  };
}

/**
 * Get import logs with pagination
 */
export function getImportLogs(limit: number = 50, offset: number = 0): ImportLog[] {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT * FROM import_logs
    ORDER BY import_timestamp DESC
    LIMIT ? OFFSET ?
  `);
  const logs = stmt.all(limit, offset) as Array<{
    id: number;
    file_name: string;
    file_size: number;
    total_records: number;
    imported_records: number;
    skipped_records: number;
    error_count: number;
    errors: string | null;
    import_timestamp: string;
  }>;
  return logs.map((log) => ({
    id: log.id,
    fileName: log.file_name,
    fileSize: log.file_size,
    totalRecords: log.total_records,
    importedRecords: log.imported_records,
    skippedRecords: log.skipped_records,
    errorCount: log.error_count,
    importTimestamp: log.import_timestamp,
    errors: log.errors ? JSON.parse(log.errors) : undefined,
  }));
}

/**
 * Mark a single transaction as reconciled
 */
export function markTransactionReconciled(cardTransactionId: number, ynabTransactionId: string): boolean {
  const database = getDatabase();
  const now = new Date().toISOString();
  const stmt = database.prepare(`
    UPDATE transactions
    SET reconciled = 1, ynab_transaction_id = ?, reconciled_at = ?, updated_at = ?
    WHERE id = ?
  `);
  const info = stmt.run(ynabTransactionId, now, now, cardTransactionId);
  return (info.changes ?? 0) > 0;
}

/**
 * Batch mark multiple transactions as reconciled (uses SQLite transaction)
 */
export function batchMarkReconciled(
  matches: Array<{ cardId: number; ynabId: string }>,
): { updated: number; errors: Array<{ cardId: number; error: string }> } {
  const database = getDatabase();
  const errors: Array<{ cardId: number; error: string }> = [];
  let updated = 0;

  const now = new Date().toISOString();
  const updateStmt = database.prepare(`
    UPDATE transactions
    SET reconciled = 1, ynab_transaction_id = ?, reconciled_at = ?, updated_at = ?
    WHERE id = ?
  `);

  const transaction = database.transaction((matchPairs: Array<{ cardId: number; ynabId: string }>) => {
    for (const match of matchPairs) {
      try {
        const info = updateStmt.run(match.ynabId, now, now, match.cardId);
        if ((info.changes ?? 0) > 0) {
          updated++;
        } else {
          errors.push({
            cardId: match.cardId,
            error: 'Transaction not found',
          });
        }
      } catch (err) {
        errors.push({
          cardId: match.cardId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  });

  transaction(matches);
  return { updated, errors };
}

/**
 * Unreconcile a transaction (for manual override)
 */
export function unreconcileTransaction(cardTransactionId: number): boolean {
  const database = getDatabase();
  const now = new Date().toISOString();
  const stmt = database.prepare(`
    UPDATE transactions
    SET reconciled = 0, ynab_transaction_id = NULL, reconciled_at = NULL, updated_at = ?
    WHERE id = ?
  `);
  const info = stmt.run(now, cardTransactionId);
  return (info.changes ?? 0) > 0;
}

/**
 * Get unreconciled transactions in date range
 */
export function getUnreconciledTransactions(startDate: string, endDate: string): AmExTransactionRow[] {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT * FROM transactions
    WHERE reconciled = 0
    AND date >= ?
    AND date <= ?
    ORDER BY date DESC
  `);
  const rows = stmt.all(startDate, endDate) as any[];
  return rows.map(transformTransactionRow);
}

/**
 * Get transactions by date range (for reconciliation)
 */
export function getTransactionsByDateRange(startDate: string, endDate: string): AmExTransactionRow[] {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT * FROM transactions
    WHERE date >= ?
    AND date <= ?
    ORDER BY date DESC
  `);
  const rows = stmt.all(startDate, endDate) as any[];
  return rows.map(transformTransactionRow);
}

/**
 * Insert reconciliation log
 */
export function insertReconciliationLog(
  log: Omit<import('./types/index').ReconciliationLog, 'id'>,
): import('./types/index').ReconciliationLog {
  const database = getDatabase();
  const stmt = database.prepare(`
    INSERT INTO reconciliation_logs (
      budget_id, start_date, end_date, matched_count, missing_in_ynab_count,
      unexpected_in_ynab_count, flagged_count, created_in_ynab_count,
      reconciled_at, config, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    log.budget_id,
    log.start_date,
    log.end_date,
    log.matched_count,
    log.missing_in_ynab_count,
    log.unexpected_in_ynab_count,
    log.flagged_count,
    log.created_in_ynab_count,
    log.reconciled_at,
    log.config || null,
    log.notes || null,
  );

  // Get the inserted log
  const getStmt = database.prepare('SELECT * FROM reconciliation_logs ORDER BY id DESC LIMIT 1');
  const result = getStmt.get() as import('./types/index').ReconciliationLog;
  return result;
}

/**
 * Get reconciliation logs with pagination
 */
export function getReconciliationLogs(
  budgetId?: string,
  limit: number = 50,
  offset: number = 0,
): import('./types/index').ReconciliationLog[] {
  const database = getDatabase();
  let query = 'SELECT * FROM reconciliation_logs';
  const params: any[] = [];

  if (budgetId) {
    query += ' WHERE budget_id = ?';
    params.push(budgetId);
  }

  query += ' ORDER BY reconciled_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const stmt = database.prepare(query);
  const logs = stmt.all(...params) as import('./types/index').ReconciliationLog[];
  return logs;
}
