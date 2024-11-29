import xlsx from 'xlsx';
import sqlite3 from 'sqlite3';
import moment from 'moment';

export async function readCreditCardStatement(filePath: string): Promise<ExpenseEntry[]> {
  const results: ExpenseEntry[] = [];
  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    data.forEach((row: any[], index: number) => {
      if (index === 0) return; // Skip header row
      const [date, description, amount] = row;
      results.push({
        date: moment(date, 'DD/MM/YYYY').format('YYYY-MM-DD'),
        description: description,
        amount: parseFloat(amount),
      });
    });

    return results;
  } catch (error) {
    throw error;
  }
}

export async function saveExpensesToDatabase(expenses: ExpenseEntry[], dbPath: string): Promise<void> {
  const db = new sqlite3.Database(dbPath);

  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT,
      description TEXT,
      amount REAL
    )`);

    const stmt = db.prepare(`INSERT INTO expenses (date, description, amount) VALUES (?, ?, ?)`);
    expenses.forEach((expense) => {
      stmt.run(expense.date, expense.description, expense.amount);
    });
    stmt.finalize();
  });

  db.close((err) => {
    if (err) {
      throw err;
    }
  });
}
