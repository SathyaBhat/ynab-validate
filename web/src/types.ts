// Import types from backend
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

export interface ValidationResult {
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  errors: Array<{ rowNumber: number; errors: string[] }>;
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
