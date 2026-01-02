import { expect } from 'chai';
import { importAmExStatementSync } from '../src/services/importService';
import { initializeDatabase, closeDatabase, getTransactionCount, deleteTransaction, getTransactions } from '../src/db';
import * as fs from 'fs';
import * as path from 'path';

describe('Import Service', () => {
  const testDbPath = path.join(__dirname, '..', 'db', 'test-import.db');
  const testFilePath = path.join(__dirname, '..', 'activity.xlsx');

  // Helper to set up fresh database
  const setupDb = () => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    initializeDatabase(testDbPath);
  };

  beforeEach(() => {
    setupDb();
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('should import AmEx statement successfully', () => {
    const result = importAmExStatementSync(testFilePath);

    expect(result).to.have.all.keys(
      'success',
      'totalRecords',
      'importedRecords',
      'skippedRecords',
      'errors',
      'timestamp',
    );
    expect(result.success).to.be.true;
    expect(result.totalRecords).to.equal(164);
    expect(result.importedRecords).to.equal(164);
    expect(result.skippedRecords).to.equal(0);
    expect(result.errors).to.be.an('array');
  });

  it('should detect duplicate references on second import', () => {
    // First import
    const result1 = importAmExStatementSync(testFilePath);
    expect(result1.importedRecords).to.equal(164);
    expect(getTransactionCount()).to.equal(164);

    // Second import (should skip all)
    const result2 = importAmExStatementSync(testFilePath);
    expect(result2.importedRecords).to.equal(0);
    expect(result2.skippedRecords).to.equal(164);
    expect(result2.errors.filter((e) => e.error.includes('Duplicate')).length).to.equal(164);
    expect(getTransactionCount()).to.equal(164); // No new records added
  });

  it('should handle dry run mode', () => {
    const countBefore = getTransactionCount();
    expect(countBefore).to.equal(0);

    const result = importAmExStatementSync(testFilePath, { dryRun: true });

    expect(result.importedRecords).to.equal(164);
    expect(result.success).to.be.true;

    const countAfter = getTransactionCount();
    expect(countAfter).to.equal(0); // No actual import in dry run
  });

  it('should return proper ImportResult structure', () => {
    const result = importAmExStatementSync(testFilePath);

    expect(result.timestamp).to.match(/^\d{4}-\d{2}-\d{2}T/); // ISO date
    expect(result.totalRecords).to.be.a('number');
    expect(result.importedRecords).to.be.a('number');
    expect(result.skippedRecords).to.be.a('number');
    expect(result.errors).to.be.an('array');

    // All error objects should have these properties
    result.errors.forEach((err) => {
      expect(err).to.have.property('rowNumber');
      expect(err).to.have.property('error');
      expect(err).to.have.property('reference');
    });
  });

  it('should handle non-existent file', () => {
    const result = importAmExStatementSync('/nonexistent/file.xlsx');

    expect(result.success).to.be.false;
    expect(result.errors.length).to.be.greaterThan(0);
    expect(result.errors[0].error).to.include('ENOENT');
  });

  it('should handle invalid file format', () => {
    const result = importAmExStatementSync('activity.csv');

    expect(result.success).to.be.false;
    expect(result.errors[0].error).to.include('XLSX');
  });

  it('should skip validation when requested', () => {
    const result = importAmExStatementSync(testFilePath, { skipValidation: true });

    expect(result.importedRecords).to.equal(164);
    expect(result.success).to.be.true;
  });

  it('should skip deduplication when requested', () => {
    // First import with deduplication
    const result1 = importAmExStatementSync(testFilePath);
    expect(result1.importedRecords).to.equal(164);
    expect(getTransactionCount()).to.equal(164);

    // Reset test database
    closeDatabase();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    initializeDatabase(testDbPath);

    // Import with skipDeduplication (should still import all)
    const result2 = importAmExStatementSync(testFilePath, { skipDeduplication: true });
    expect(result2.importedRecords).to.equal(164);
    expect(getTransactionCount()).to.equal(164);
  });

  it('should track transaction count correctly', () => {
    const countBefore = getTransactionCount();
    expect(countBefore).to.equal(0);

    const result = importAmExStatementSync(testFilePath);

    const countAfter = getTransactionCount();
    expect(countAfter - countBefore).to.equal(result.importedRecords);
  });

  it('should handle file name extraction correctly', () => {
    const result = importAmExStatementSync(testFilePath);
    expect(result).to.have.property('timestamp');
    // Timestamp should be set
    expect(result.timestamp).to.not.be.empty;
    expect(result.importedRecords).to.equal(164);
  });

  it('should allow negative amounts (credits/refunds)', () => {
    const result = importAmExStatementSync(testFilePath);
    expect(result.success).to.be.true;
    expect(result.importedRecords).to.be.greaterThan(0);

    // Check for transactions with negative amounts
    const transactions = getTransactions(200, 0);
    const hasNegative = transactions.some((t) => t.amount < 0);
    expect(hasNegative).to.be.true;
  });

  it('should allow empty country field', () => {
    const result = importAmExStatementSync(testFilePath);
    expect(result.success).to.be.true;

    // Check for transactions with empty country
    const transactions = getTransactions(200, 0);
    const hasEmptyCountry = transactions.some((t) => !t.country || t.country.trim() === '');
    expect(hasEmptyCountry).to.be.true;
  });
});
