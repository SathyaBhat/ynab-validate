import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

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

  // Read and execute schema
  const schemaPath = path.join(__dirname, '..', 'src', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  return db;
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
 * Get transaction by reference
 */
export function getTransactionByReference(reference: string): AmExTransactionRow | null {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM transactions WHERE reference = ?');
  return (stmt.get(reference) as AmExTransactionRow) || null;
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
  return stmt.all(limit, offset) as AmExTransactionRow[];
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
  const logs = stmt.all(limit, offset) as Array<ImportLog & { errors: string | null }>;
  return logs.map((log) => ({
    ...log,
    errors: log.errors ? JSON.parse(log.errors) : undefined,
  }));
}
