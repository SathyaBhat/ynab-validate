import type { AmExTransaction } from './types/index';

/**
 * Validate AmEx transaction data
 */
export function validateAmExTransaction(transaction: AmExTransaction, rowNumber?: number): string[] {
  const errors: string[] = [];
  const prefix = rowNumber ? `Row ${rowNumber}: ` : '';

  // Validate required fields
  if (!transaction.date || transaction.date.trim() === '') {
    errors.push(`${prefix}Date is required`);
  }

  if (!transaction.dateProcessed || transaction.dateProcessed.trim() === '') {
    errors.push(`${prefix}Date Processed is required`);
  }

  if (!transaction.description || transaction.description.trim() === '') {
    errors.push(`${prefix}Description is required`);
  }

  if (!transaction.cardMember || transaction.cardMember.trim() === '') {
    errors.push(`${prefix}Card Member is required`);
  }

  if (!transaction.accountNumber || transaction.accountNumber.trim() === '') {
    errors.push(`${prefix}Account # is required`);
  }

  if (transaction.amount === undefined || transaction.amount === null || isNaN(transaction.amount)) {
    errors.push(`${prefix}Amount must be a valid number`);
  }

  // Allow negative amounts (credits/refunds)
  // if (transaction.amount < 0) {
  //   errors.push(`${prefix}Amount cannot be negative`);
  // }

  if (!transaction.reference || transaction.reference.trim() === '') {
    errors.push(`${prefix}Reference is required`);
  }

  // Country is optional if address is empty (domestic transactions)
  // if (!transaction.country || transaction.country.trim() === '') {
  //   errors.push(`${prefix}Country is required`);
  // }

  // Validate date formats (ISO 8601)
  if (transaction.date && !isValidISODate(transaction.date)) {
    errors.push(`${prefix}Date must be in ISO 8601 format (YYYY-MM-DD)`);
  }

  if (transaction.dateProcessed && !isValidISODate(transaction.dateProcessed)) {
    errors.push(`${prefix}Date Processed must be in ISO 8601 format (YYYY-MM-DD)`);
  }

  // Validate reference format (should be unique and contain alphanumeric)
  if (transaction.reference && !/^[A-Z0-9]{15,}$/.test(transaction.reference.trim())) {
    // AmEx references seem to be 15+ alphanumeric characters, but allow flexibility
    if (!/^[A-Za-z0-9]+$/.test(transaction.reference.trim())) {
      errors.push(`${prefix}Reference must contain only alphanumeric characters`);
    }
  }

  // Validate optional numeric fields
  if (transaction.foreignSpendAmount) {
    const numStr = transaction.foreignSpendAmount.trim().replace(/[^\d.,]/g, '');
    if (numStr && isNaN(parseFloat(numStr))) {
      errors.push(`${prefix}Foreign Spend Amount must be a valid number`);
    }
  }

  if (transaction.commission) {
    const numStr = transaction.commission.trim().replace(/[^\d.,]/g, '');
    if (numStr && isNaN(parseFloat(numStr))) {
      errors.push(`${prefix}Commission must be a valid number`);
    }
  }

  if (transaction.exchangeRate) {
    const numStr = transaction.exchangeRate.trim().replace(/[^\d.,]/g, '');
    if (numStr && isNaN(parseFloat(numStr))) {
      errors.push(`${prefix}Exchange Rate must be a valid number`);
    }
  }

  return errors;
}

/**
 * Check if string is valid ISO 8601 date (YYYY-MM-DD)
 */
function isValidISODate(dateStr: string): boolean {
  const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoRegex.test(dateStr)) return false;

  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Validate batch of transactions
 */
export function validateTransactionBatch(
  transactions: AmExTransaction[],
): Array<{ index: number; errors: string[] }> {
  const validationErrors: Array<{ index: number; errors: string[] }> = [];

  transactions.forEach((transaction, index) => {
    const errors = validateAmExTransaction(transaction, index + 1);
    if (errors.length > 0) {
      validationErrors.push({ index, errors });
    }
  });

  return validationErrors;
}
