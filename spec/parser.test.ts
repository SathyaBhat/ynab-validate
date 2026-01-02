import { expect } from 'chai';
import { parseAmExStatement } from '../src/parser';
import * as fs from 'fs';
import * as path from 'path';

describe('AmEx Parser', () => {
  const testFilePath = path.join(__dirname, '..', 'activity.xlsx');

  before(() => {
    if (!fs.existsSync(testFilePath)) {
      throw new Error(`Test file not found: ${testFilePath}`);
    }
  });

  it('should parse AmEx XLSX statement successfully', () => {
    const { transactions, errors } = parseAmExStatement(testFilePath);

    expect(transactions).to.be.an('array');
    expect(transactions.length).to.be.greaterThan(0);
    expect(errors).to.be.an('array');

    console.log(`Parsed ${transactions.length} transactions with ${errors.length} errors`);
  });

  it('should extract transaction fields correctly', () => {
    const { transactions } = parseAmExStatement(testFilePath);

    const firstTransaction = transactions[0];
    expect(firstTransaction).to.have.all.keys(
      'date',
      'dateProcessed',
      'description',
      'cardMember',
      'accountNumber',
      'amount',
      'foreignSpendAmount',
      'commission',
      'exchangeRate',
      'additionalInformation',
      'appearsOnStatement',
      'address',
      'townCity',
      'postcode',
      'country',
      'reference',
    );
  });

  it('should have valid data types', () => {
    const { transactions } = parseAmExStatement(testFilePath);

    const firstTransaction = transactions[0];
    expect(firstTransaction.date).to.be.a('string');
    expect(firstTransaction.amount).to.be.a('number');
    expect(firstTransaction.reference).to.be.a('string');
  });

  it('should parse dates in ISO format', () => {
    const { transactions } = parseAmExStatement(testFilePath);

    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    transactions.forEach((txn) => {
      expect(txn.date).to.match(isoDateRegex, `Invalid date format: ${txn.date}`);
      expect(txn.dateProcessed).to.match(
        isoDateRegex,
        `Invalid processed date format: ${txn.dateProcessed}`,
      );
    });
  });

  it('should have non-empty reference values', () => {
    const { transactions } = parseAmExStatement(testFilePath);

    transactions.forEach((txn) => {
      expect(txn.reference).to.not.be.empty;
    });
  });

  it('should throw error for non-existent file', () => {
    expect(() => parseAmExStatement('/nonexistent/file.xlsx')).to.throw();
  });

  it('should throw error for non-XLSX file', () => {
    expect(() => parseAmExStatement('/path/to/file.csv')).to.throw();
  });
});
