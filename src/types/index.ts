// Legacy types (kept for backward compatibility)
export interface ExpenseEntry {
  date: string;
  description: string;
  amount: number;
}

export interface YnabExpenseEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
}

// AmEx Statement Types
export interface AmExTransaction {
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

export interface AmExTransactionRow {
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
  reconciled?: boolean;
  ynab_transaction_id?: string;
  reconciled_at?: string;
}

export interface ImportResult {
  success: boolean;
  totalRecords: number;
  importedRecords: number;
  skippedRecords: number;
  errors: ImportError[];
  timestamp: string;
}

export interface ImportError {
  rowNumber: number;
  error: string;
  reference?: string;
}

export interface ImportLog {
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
export interface YnabTransaction {
  id: string;
  date: string; // ISO 8601 format
  amount: number; // in milliunits (1000 = 1 unit of currency)
  payee_name: string | null;
  category_name: string | null;
  memo: string | null;
  cleared: 'cleared' | 'uncleared' | 'reconciled';
  deleted: boolean;
}

export interface YnabBudget {
  id: string;
  name: string;
}

export interface YnabAccount {
  id: string;
  name: string;
  type: string;
  currency_format: {
    iso_code: string;
    example_format: string;
    decimal_digits: number;
  };
}

export interface ReconciliationMatch {
  cardTransaction: AmExTransactionRow;
  ynabTransaction: YnabTransaction;
  dateDifference: number; // days between transactions
}

export interface DiscrepancyReport {
  missingInYnab: AmExTransactionRow[]; // On card, not in YNAB
  unexpectedInYnab: YnabTransaction[]; // In YNAB, not on card
  matched: ReconciliationMatch[];
}

export interface ReconciliationResult {
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

export interface ReconciliationResultWithActions extends ReconciliationResult {
  actions: {
    canPersist: boolean;
    canFlag: boolean;
    canCreate: boolean;
    persistedCount?: number;
  };
}

export interface ReconciliationLog {
  id: number;
  budget_id: string;
  start_date: string;
  end_date: string;
  matched_count: number;
  missing_in_ynab_count: number;
  unexpected_in_ynab_count: number;
  flagged_count: number;
  created_in_ynab_count: number;
  reconciled_at: string;
  config?: string;
  notes?: string;
}

export interface MatchPair {
  cardId: number;
  ynabId: string;
}

export interface PersistResult {
  success: boolean;
  updated: number;
  errors: Array<{ cardId: number; error: string }>;
}

export interface FlagResult {
  success: boolean;
  flagged: number;
  errors: Array<{ id: string; error: string }>;
}

export interface CreateResult {
  success: boolean;
  created: number;
  skipped: number;
  errors: Array<{ cardId: number; error: string }>;
}

export interface UnmatchResult {
  success: boolean;
  unmatched: boolean;
}
