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
