// Legacy types (kept for backward compatibility)
interface ExpenseEntry {
  date: string;
  description: string;
  amount: number;
}

interface YnabExpenseEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
}

// AmEx Statement Types
interface AmExTransaction {
  date: string;
  dateProcessed: string;
  description: string;
  cardMember: string;
  accountNumber: string;
  amount: number;
  foreignSpendAmount?: string;
  commission?: string;
  exchangeRate?: string;
  additionalInformation?: string;
  appearsOnStatement: string;
  address?: string;
  townCity?: string;
  postcode?: string;
  country: string;
  reference: string;
}

interface AmExTransactionRow {
  id: number;
  date: string;
  date_processed: string;
  description: string;
  card_member: string;
  account_number: string;
  amount: number;
  foreign_spend_amount?: string;
  commission?: string;
  exchange_rate?: string;
  additional_information?: string;
  appears_on_statement: string;
  address?: string;
  town_city?: string;
  postcode?: string;
  country: string;
  reference: string;
  created_at: string;
  updated_at: string;
}

interface ImportResult {
  success: boolean;
  totalRecords: number;
  importedRecords: number;
  skippedRecords: number;
  errors: ImportError[];
  timestamp: string;
}

interface ImportError {
  rowNumber: number;
  error: string;
  reference?: string;
}

interface ImportLog {
  id: number;
  fileName: string;
  fileSize?: number;
  totalRecords: number;
  importedRecords: number;
  skippedRecords: number;
  errorCount: number;
  errors?: ImportError[];
  importTimestamp: string;
}

// YNAB API Types
interface YnabTransaction {
  id: string;
  date: string; // ISO 8601 format
  amount: number; // in milliunits (1000 = 1 unit of currency)
  payee_name: string | null;
  category_name: string | null;
  memo: string | null;
  cleared: 'cleared' | 'uncleared' | 'reconciled';
  deleted: boolean;
}

interface YnabBudget {
  id: string;
  name: string;
}

interface YnabAccount {
  id: string;
  name: string;
  type: string;
  currency_format: {
    iso_code: string;
    example_format: string;
    decimal_digits: number;
  };
}

interface ReconciliationMatch {
  cardTransaction: AmExTransactionRow;
  ynabTransaction: YnabTransaction;
  dateDifference: number; // days between transactions
}

interface DiscrepancyReport {
  missingInYnab: AmExTransactionRow[]; // On card, not in YNAB
  unexpectedInYnab: YnabTransaction[]; // In YNAB, not on card
  matched: ReconciliationMatch[];
}

interface ReconciliationResult {
  success: boolean;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  budgetId: string;
  cardTransactionCount: number;
  ynabTransactionCount: number;
  matchedCount: number;
  discrepancies: DiscrepancyReport;
  timestamp: string;
  error?: string;
}
