import * as XLSX from 'xlsx';
import * as fs from 'fs';
import type { AmExTransaction } from './types/index';

interface ParserOptions {
  worksheetName?: string;
  headerRowNumber?: number;
}

/**
 * Parse AmEx XLSX statement file
 * Dynamically detects header row and extracts transactions
 */
export function parseAmExStatement(
  filePath: string,
  options: ParserOptions = {},
): { transactions: AmExTransaction[]; errors: Array<{ row: number; error: string }> } {
  const worksheetName = options.worksheetName || 'Transaction Details';
  const headerRowNumber = options.headerRowNumber || 6; // 0-indexed, so row 7 = index 6

  // Validate file exists and is XLSX
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  if (!filePath.endsWith('.xlsx')) {
    throw new Error('File must be in XLSX format');
  }

  // Read workbook
  const workbook = XLSX.readFile(filePath);

  // Get the transaction details sheet
  if (!workbook.SheetNames.includes(worksheetName)) {
    throw new Error(`Worksheet "${worksheetName}" not found. Available: ${workbook.SheetNames.join(', ')}`);
  }

  const worksheet = workbook.Sheets[worksheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as Array<Array<unknown>>;

  if (rows.length <= headerRowNumber) {
    throw new Error(`Header row ${headerRowNumber + 1} not found in worksheet`);
  }

  // Extract and normalize headers
  const headerRow = rows[headerRowNumber] as string[];
  const headers = normalizeHeaders(headerRow);

  // Parse data rows starting from headerRowNumber + 1
  const transactions: AmExTransaction[] = [];
  const errors: Array<{ row: number; error: string }> = [];

  for (let i = headerRowNumber + 1; i < rows.length; i++) {
    const row = rows[i] as Array<unknown>;

    // Skip empty rows
    if (!row || row.length === 0 || row.every((cell) => !cell)) {
      continue;
    }

    try {
      const transaction = parseTransactionRow(row, headers, i + 1); // +1 for 1-indexed row numbers
      transactions.push(transaction);
    } catch (err) {
      errors.push({
        row: i + 1,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { transactions, errors };
}

/**
 * Normalize header names from XLSX to camelCase
 */
function normalizeHeaders(headerRow: string[]): Record<string, number> {
  const headerMap: Record<string, number> = {};

  headerRow.forEach((header, index) => {
    if (!header) return;

    // Convert header to camelCase
    // "Date Processed" -> "dateProcessed"
    // "Foreign Spend Amount" -> "foreignSpendAmount"
    const normalized = header
      .trim()
      .split(/[\s\/\-]+/) // Split on spaces, slashes, or hyphens
      .map((word, idx) => {
        if (idx === 0) return word.toLowerCase();
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join('')
      .replace(/[^a-zA-Z0-9]/g, ''); // Remove any remaining non-alphanumeric

    headerMap[normalized] = index;
  });

  return headerMap;
}

/**
 * Parse a single transaction row into AmExTransaction object
 */
function parseTransactionRow(row: Array<unknown>, headers: Record<string, number>, rowNumber: number): AmExTransaction {
  const getField = (fieldNames: string | string[]): unknown => {
    const names = Array.isArray(fieldNames) ? fieldNames : [fieldNames];
    for (const name of names) {
      const index = headers[name];
      if (index !== undefined) {
        return row[index];
      }
    }
    return undefined;
  };

  const date = getField('date');
  const dateProcessed = getField('dateProcessed');
  const description = getField('description');
  const cardMember = getField('cardMember');
  const accountNumber = getField(['accountNumber', 'account']);
  const amount = getField('amount');
  const reference = getField('reference');

  // Validate required fields
  if (!date) throw new Error(`Row ${rowNumber}: Missing required field "Date"`);
  if (!dateProcessed) throw new Error(`Row ${rowNumber}: Missing required field "Date Processed"`);
  if (!description) throw new Error(`Row ${rowNumber}: Missing required field "Description"`);
  if (!cardMember) throw new Error(`Row ${rowNumber}: Missing required field "Card Member"`);
  if (!accountNumber) throw new Error(`Row ${rowNumber}: Missing required field "Account #"`);
  if (amount === undefined || amount === null || amount === '') {
    throw new Error(`Row ${rowNumber}: Missing required field "Amount"`);
  }
  if (!reference || reference === '') throw new Error(`Row ${rowNumber}: Missing required field "Reference"`);

  // Parse amount as number
  let parsedAmount: number;
  if (typeof amount === 'number') {
    parsedAmount = amount;
  } else if (typeof amount === 'string') {
    parsedAmount = parseFloat(amount.replace(/,/g, ''));
    if (isNaN(parsedAmount)) {
      throw new Error(`Row ${rowNumber}: Invalid amount format "${amount}"`);
    }
  } else {
    throw new Error(`Row ${rowNumber}: Invalid amount type`);
  }

  // Normalize date formats (handle both string and Excel date number)
  const normalizedDate = normalizeDate(date, rowNumber);
  const normalizedProcessedDate = normalizeDate(dateProcessed, rowNumber);

  return {
    date: normalizedDate,
    dateProcessed: normalizedProcessedDate,
    description: String(description).trim(),
    cardMember: String(cardMember).trim(),
    accountNumber: String(accountNumber).trim(),
    amount: parsedAmount,
    foreignSpendAmount: formatOptionalField(getField('foreignSpendAmount')),
    commission: formatOptionalField(getField('commission')),
    exchangeRate: formatOptionalField(getField('exchangeRate')),
    additionalInformation: formatOptionalField(getField('additionalInformation')),
    appearsOnStatement: String(getField('appearsOnYourStatementAs') || description).trim(),
    address: formatOptionalField(getField('address')),
    townCity: formatOptionalField(getField('townCity')),
    postcode: formatOptionalField(getField('postcode')),
    country: String(getField('country') || '').trim(),
    reference: String(reference).trim(),
  };
}

/**
 * Normalize date to ISO string (DD/MM/YYYY or Excel date number)
 */
function normalizeDate(dateValue: unknown, rowNumber: number): string {
  if (!dateValue) {
    throw new Error(`Row ${rowNumber}: Invalid date value`);
  }

  let date: Date;

  if (typeof dateValue === 'number') {
    // Excel date number (days since 1900-01-01)
    date = excelDateToDate(dateValue);
  } else if (typeof dateValue === 'string') {
    // Parse DD/MM/YYYY or other common formats
    const parsed = parseDateString(dateValue);
    if (!parsed) {
      throw new Error(`Row ${rowNumber}: Unable to parse date "${dateValue}"`);
    }
    date = parsed;
  } else {
    throw new Error(`Row ${rowNumber}: Invalid date type`);
  }

  return date.toISOString().split('T')[0]; // Return YYYY-MM-DD
}

/**
 * Convert Excel date number to JavaScript Date
 */
function excelDateToDate(excelDate: number): Date {
  // Excel date is days since January 1, 1900
  // Need to account for the leap year bug in Excel
  const epochStart = new Date(1900, 0, 1);
  const daysOffset = excelDate - 2; // Adjust for Excel's leap year bug
  const date = new Date(epochStart.getTime() + daysOffset * 24 * 60 * 60 * 1000);
  return date;
}

/**
 * Parse date string in various formats
 */
function parseDateString(dateStr: string): Date | null {
  // Try DD/MM/YYYY format (AmEx format)
  const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dateStr);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // Try YYYY-MM-DD format
  const yyyymmdd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (yyyymmdd) {
    const [, year, month, day] = yyyymmdd;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // Try JavaScript Date parsing as fallback
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  return null;
}

/**
 * Format optional field: trim and return null/undefined for empty values
 */
function formatOptionalField(value: unknown): string | undefined {
  if (!value) return undefined;
  const str = String(value).trim();
  return str.length > 0 ? str : undefined;
}
