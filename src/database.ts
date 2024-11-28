import sqlite3 from 'sqlite3';
import { ExpenseEntry } from './types';

export async function getExpensesFromDatabase(dbPath: string): Promise<ExpenseEntry[]> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    const expenses: ExpenseEntry[] = [];

    db.serialize(() => {
      db.each(
        `SELECT date, description, amount FROM expenses ORDER BY date DESC`,
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            expenses.push({
              date: row.date,
              description: row.description,
              amount: row.amount,
            });
          }
        },
        () => {
          resolve(expenses);
        }
      );
    });

    db.close((err) => {
      if (err) {
        reject(err);
      }
    });
  });
}

export async function markDuplicateTransaction(expense: ExpenseEntry): Promise<void> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database('expenses.db');

    db.serialize(() => {
      db.run(
        `CREATE TABLE IF NOT EXISTS duplicates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT,
          description TEXT,
          amount REAL
        )`
      );

      const stmt = db.prepare(`INSERT INTO duplicates (date, description, amount) VALUES (?, ?, ?)`);
      stmt.run(expense.date, expense.description, expense.amount);
      stmt.finalize();

      resolve();
    });

    db.close((err) => {
      if (err) {
        reject(err);
      }
    });
  });
}

export async function isDuplicateTransaction(expense: ExpenseEntry): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database('expenses.db');

    db.serialize(() => {
      db.get(
        `SELECT COUNT(*) as count FROM duplicates WHERE date = ? AND description = ? AND amount = ?`,
        [expense.date, expense.description, expense.amount],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row.count > 0);
          }
        }
      );
    });

    db.close((err) => {
      if (err) {
        reject(err);
      }
    });
  });
}
