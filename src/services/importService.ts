import { parseAmExStatement } from '../parser';
import { validateAmExTransaction, validateTransactionBatch } from '../validator';
import {
  batchInsertTransactions,
  transactionExists,
  insertImportLog,
  getDatabase,
} from '../db';
import * as fs from 'fs';

interface ImportServiceOptions {
  skipValidation?: boolean;
  skipDeduplication?: boolean;
  dryRun?: boolean;
}

/**
 * Import AmEx statement from XLSX file
 * Handles parsing, validation, deduplication, and database insertion
 */
export async function importAmExStatement(
  filePath: string,
  options: ImportServiceOptions = {},
): Promise<ImportResult> {
  const startTime = Date.now();
  const fileName = filePath.split('/').pop() || 'unknown';
  const fileSize = fs.statSync(filePath).size;

  const result: ImportResult = {
    success: false,
    totalRecords: 0,
    importedRecords: 0,
    skippedRecords: 0,
    errors: [],
    timestamp: new Date().toISOString(),
  };

  try {
    // Step 1: Parse XLSX file
    const { transactions: parsedTransactions, errors: parseErrors } = parseAmExStatement(filePath);

    result.totalRecords = parsedTransactions.length;

    // Collect parse errors
    if (parseErrors.length > 0) {
      result.errors.push(
        ...parseErrors.map((err) => ({
          rowNumber: err.row,
          error: err.error,
          reference: undefined,
        } as ImportError)),
      );
    }

    if (parsedTransactions.length === 0) {
      result.success = false;
      result.errors.push({
        rowNumber: 0,
        error: 'No transactions found in file',
        reference: undefined,
      } as ImportError);
      logImport(fileName, fileSize, result);
      return result;
    }

    // Step 2: Validate transactions
    if (!options.skipValidation) {
      const validationErrors = validateTransactionBatch(parsedTransactions);

      if (validationErrors.length > 0) {
        result.errors.push(
          ...validationErrors.flatMap((err) =>
            err.errors.map((message) => ({
              rowNumber: err.index + 1,
              error: message,
              reference: parsedTransactions[err.index]?.reference,
            } as ImportError)),
          ),
        );
      }

      // Filter out invalid transactions
      if (validationErrors.length > 0) {
        const invalidIndices = new Set(validationErrors.map((err) => err.index));
        const validTransactions = parsedTransactions.filter((_, idx) => !invalidIndices.has(idx));

        if (validTransactions.length === 0) {
          result.success = false;
          logImport(fileName, fileSize, result);
          return result;
        }

        parsedTransactions.length = 0;
        parsedTransactions.push(...validTransactions);
      }
    }

    // Step 3: Deduplication check
    const transactionsToInsert: AmExTransaction[] = [];
    const duplicateReferences: string[] = [];

    if (!options.skipDeduplication) {
      for (const transaction of parsedTransactions) {
        if (transactionExists(transaction.reference)) {
          duplicateReferences.push(transaction.reference);
          result.skippedRecords++;
        } else {
          transactionsToInsert.push(transaction);
        }
      }
    } else {
      transactionsToInsert.push(...parsedTransactions);
    }

    // Log duplicates as warnings
    duplicateReferences.forEach((ref) => {
      result.errors.push({
        rowNumber: 0,
        error: `Duplicate reference skipped: ${ref}`,
        reference: ref,
      } as ImportError);
    });

    // Step 4: Batch insert (skip if dry run)
    if (transactionsToInsert.length > 0 && !options.dryRun) {
      const insertResult = batchInsertTransactions(transactionsToInsert);
      result.importedRecords = insertResult.inserted;

      // Add insert errors
      if (insertResult.errors.length > 0) {
        result.errors.push(
          ...insertResult.errors.map((err) => ({
            rowNumber: err.index + 1,
            error: err.error,
            reference: err.reference,
          } as ImportError)),
        );
        result.skippedRecords += insertResult.errors.length;
      }
    } else if (options.dryRun) {
      result.importedRecords = transactionsToInsert.length;
    }

    result.success = result.importedRecords > 0 || result.errors.length === 0;

    // Log the import
    logImport(fileName, fileSize, result);

    return result;
  } catch (err) {
    result.success = false;
    result.errors.push({
      rowNumber: 0,
      error: err instanceof Error ? err.message : String(err),
      reference: undefined,
    } as ImportError);
    logImport(fileName, fileSize, result);
    return result;
  }
}

/**
 * Import AmEx statement (synchronous version)
 * Useful for CLI operations without async/await
 */
export function importAmExStatementSync(
  filePath: string,
  options: ImportServiceOptions = {},
): ImportResult {
  const fileName = filePath.split('/').pop() || 'unknown';

  // Check if file exists before calling statSync
  let fileSize = 0;
  try {
    fileSize = fs.statSync(filePath).size;
  } catch (err) {
    // File doesn't exist or can't be accessed
    const result: ImportResult = {
      success: false,
      totalRecords: 0,
      importedRecords: 0,
      skippedRecords: 0,
      errors: [
        {
          rowNumber: 0,
          error: err instanceof Error ? err.message : String(err),
          reference: undefined,
        } as ImportError,
      ],
      timestamp: new Date().toISOString(),
    };
    logImport(fileName, 0, result);
    return result;
  }

  const result: ImportResult = {
    success: false,
    totalRecords: 0,
    importedRecords: 0,
    skippedRecords: 0,
    errors: [],
    timestamp: new Date().toISOString(),
  };

  try {
    // Step 1: Parse XLSX file
    const { transactions: parsedTransactions, errors: parseErrors } = parseAmExStatement(filePath);

    result.totalRecords = parsedTransactions.length;

    // Collect parse errors
    if (parseErrors.length > 0) {
      result.errors.push(
        ...parseErrors.map((err) => ({
          rowNumber: err.row,
          error: err.error,
          reference: undefined,
        } as ImportError)),
      );
    }

    if (parsedTransactions.length === 0) {
      result.success = false;
      result.errors.push({
        rowNumber: 0,
        error: 'No transactions found in file',
        reference: undefined,
      } as ImportError);
      logImport(fileName, fileSize, result);
      return result;
    }

    // Step 2: Validate transactions
    if (!options.skipValidation) {
      const validationErrors = validateTransactionBatch(parsedTransactions);

      if (validationErrors.length > 0) {
        result.errors.push(
          ...validationErrors.flatMap((err) =>
            err.errors.map((message) => ({
              rowNumber: err.index + 1,
              error: message,
              reference: parsedTransactions[err.index]?.reference,
            } as ImportError)),
          ),
        );
      }

      // Filter out invalid transactions
      if (validationErrors.length > 0) {
        const invalidIndices = new Set(validationErrors.map((err) => err.index));
        const validTransactions = parsedTransactions.filter((_, idx) => !invalidIndices.has(idx));

        if (validTransactions.length === 0) {
          result.success = false;
          logImport(fileName, fileSize, result);
          return result;
        }

        parsedTransactions.length = 0;
        parsedTransactions.push(...validTransactions);
      }
    }

    // Step 3: Deduplication check
    const transactionsToInsert: AmExTransaction[] = [];
    const duplicateReferences: string[] = [];

    if (!options.skipDeduplication) {
      for (const transaction of parsedTransactions) {
        if (transactionExists(transaction.reference)) {
          duplicateReferences.push(transaction.reference);
          result.skippedRecords++;
        } else {
          transactionsToInsert.push(transaction);
        }
      }
    } else {
      transactionsToInsert.push(...parsedTransactions);
    }

    // Log duplicates as warnings
    duplicateReferences.forEach((ref) => {
      result.errors.push({
        rowNumber: 0,
        error: `Duplicate reference skipped: ${ref}`,
        reference: ref,
      } as ImportError);
    });

    // Step 4: Batch insert (skip if dry run)
    if (transactionsToInsert.length > 0 && !options.dryRun) {
      const insertResult = batchInsertTransactions(transactionsToInsert);
      result.importedRecords = insertResult.inserted;

      // Add insert errors
      if (insertResult.errors.length > 0) {
        result.errors.push(
          ...insertResult.errors.map((err) => ({
            rowNumber: err.index + 1,
            error: err.error,
            reference: err.reference,
          } as ImportError)),
        );
        result.skippedRecords += insertResult.errors.length;
      }
    } else if (options.dryRun) {
      result.importedRecords = transactionsToInsert.length;
    }

    result.success = result.importedRecords > 0 || result.errors.length === 0;

    // Log the import
    logImport(fileName, fileSize, result);

    return result;
  } catch (err) {
    result.success = false;
    result.errors.push({
      rowNumber: 0,
      error: err instanceof Error ? err.message : String(err),
      reference: undefined,
    } as ImportError);
    logImport(fileName, fileSize, result);
    return result;
  }
}

/**
 * Log import to database
 */
function logImport(fileName: string, fileSize: number, result: ImportResult): void {
  try {
    const errorLog: ImportLog = {
      id: 0,
      fileName,
      fileSize,
      totalRecords: result.totalRecords,
      importedRecords: result.importedRecords,
      skippedRecords: result.skippedRecords,
      errorCount: result.errors.length,
      errors: result.errors,
      importTimestamp: result.timestamp,
    };

    insertImportLog(errorLog);
  } catch (err) {
    console.error('Failed to log import:', err);
  }
}
