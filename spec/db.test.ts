import { expect } from 'chai';
import {
  initializeDatabase,
  closeDatabase,
  insertTransaction,
  transactionExists,
  getTransactionByReference,
  getTransactions,
  getTransactionCount,
  deleteTransaction,
  batchInsertTransactions,
  insertImportLog,
  getImportLogs,
} from '../src/db';
import * as fs from 'fs';
import * as path from 'path';

describe('Database Operations', () => {
  const testDbPath = path.join(__dirname, '..', 'db', 'test.db');

  before(() => {
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    initializeDatabase(testDbPath);
  });

  after(() => {
    closeDatabase();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('should initialize database', () => {
    expect(getTransactionCount()).to.equal(0);
  });

  it('should insert a single transaction', () => {
    const transaction: AmExTransaction = {
      date: '2025-10-04',
      dateProcessed: '2025-10-04',
      description: 'Test Transaction',
      cardMember: 'John Doe',
      accountNumber: '-11002',
      amount: 100.5,
      country: 'Australia',
      appearsOnStatement: 'Test Transaction',
      reference: 'REF001TEST00000001',
    };

    const inserted = insertTransaction(transaction);
    expect(inserted.id).to.be.a('number');
    expect(inserted.reference).to.equal(transaction.reference);
    expect(getTransactionCount()).to.equal(1);
  });

  it('should check if transaction exists by reference', () => {
    expect(transactionExists('REF001TEST00000001')).to.be.true;
    expect(transactionExists('NONEXISTENT')).to.be.false;
  });

  it('should retrieve transaction by reference', () => {
    const transaction = getTransactionByReference('REF001TEST00000001');
    expect(transaction).to.not.be.null;
    expect(transaction?.description).to.equal('Test Transaction');
    expect(transaction?.amount).to.equal(100.5);
  });

  it('should batch insert transactions', () => {
    const transactions: AmExTransaction[] = [
      {
        date: '2025-10-03',
        dateProcessed: '2025-10-04',
        description: 'Transaction 2',
        cardMember: 'Jane Doe',
        accountNumber: '-11010',
        amount: 50.25,
        country: 'Australia',
        appearsOnStatement: 'Transaction 2',
        reference: 'REF002TEST00000002',
      },
      {
        date: '2025-10-02',
        dateProcessed: '2025-10-03',
        description: 'Transaction 3',
        cardMember: 'Bob Smith',
        accountNumber: '-11002',
        amount: 200.0,
        country: 'Australia',
        appearsOnStatement: 'Transaction 3',
        reference: 'REF003TEST00000003',
      },
    ];

    const result = batchInsertTransactions(transactions);
    expect(result.inserted).to.equal(2);
    expect(result.errors).to.be.empty;
    expect(getTransactionCount()).to.equal(3);
  });

  it('should retrieve transactions with pagination', () => {
    const transactions = getTransactions(10, 0);
    expect(transactions).to.be.an('array');
    expect(transactions.length).to.equal(3);
    expect(transactions[0].reference).to.exist;
  });

  it('should delete transaction by id', () => {
    const transaction = getTransactionByReference('REF001TEST00000001');
    if (transaction) {
      const deleted = deleteTransaction(transaction.id);
      expect(deleted).to.be.true;
      expect(getTransactionCount()).to.equal(2);
    }
  });

  it('should insert import log', () => {
    const log: Omit<ImportLog, 'id'> = {
      fileName: 'test.xlsx',
      fileSize: 1024,
      totalRecords: 100,
      importedRecords: 98,
      skippedRecords: 2,
      errorCount: 0,
      importTimestamp: new Date().toISOString(),
    };

    const inserted = insertImportLog(log);
    expect(inserted.id).to.be.a('number');
    expect(inserted.fileName).to.equal('test.xlsx');
  });

  it('should retrieve import logs', () => {
    const logs = getImportLogs(10, 0);
    expect(logs).to.be.an('array');
    expect(logs.length).to.be.greaterThan(0);
  });

  it('should handle duplicate reference with error', () => {
    const transaction: AmExTransaction = {
      date: '2025-10-04',
      dateProcessed: '2025-10-04',
      description: 'Duplicate Test',
      cardMember: 'John Doe',
      accountNumber: '-11002',
      amount: 100.0,
      country: 'Australia',
      appearsOnStatement: 'Duplicate Test',
      reference: 'REF002TEST00000002', // Already exists
    };

    expect(() => insertTransaction(transaction)).to.throw();
  });
});
