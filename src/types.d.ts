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
