import { compareExpenses } from '../src/index';
import { expect } from 'chai';
import 'mocha';

describe('compareExpenses', () => {
  it('should correctly identify transactions that are in YNAB but not in the statement', async () => {
    const creditCardExpenses = [
      { date: '2023-01-01', description: 'Test Transaction 1', amount: 100.0 },
    ];
    const ynabExpenses = [
      { id: '1', date: '2023-01-02', description: 'Test Transaction 2', amount: -200000 },
    ];

    const result = await compareExpenses(creditCardExpenses, ynabExpenses);

    expect(result).to.deep.equal([]);
  });

  it('should correctly identify transactions that are in the statement but not in YNAB', async () => {
    const creditCardExpenses = [
      { date: '2023-01-01', description: 'Test Transaction 1', amount: 100.0 },
    ];
    const ynabExpenses = [
      { id: '1', date: '2023-01-02', description: 'Test Transaction 2', amount: -200000 },
    ];

    const result = await compareExpenses(creditCardExpenses, ynabExpenses);

    expect(result).to.deep.equal([{ date: '2023-01-01', description: 'Test Transaction 1', amount: 100.0 }]);
  });

  it('should correctly identify duplicate transactions', async () => {
    const creditCardExpenses = [
      { date: '2023-01-01', description: 'Test Transaction 1', amount: 100.0 },
      { date: '2023-01-01', description: 'Test Transaction 1', amount: 100.0 },
    ];
    const ynabExpenses = [
      { id: '1', date: '2023-01-01', description: 'Test Transaction 1', amount: -100000 },
    ];

    const result = await compareExpenses(creditCardExpenses, ynabExpenses);

    expect(result).to.deep.equal([]);
  });

  it('should allow marking duplicate transactions as not duplicates', async () => {
    const creditCardExpenses = [
      { date: '2023-01-01', description: 'Test Transaction 1', amount: 100.0 },
      { date: '2023-01-01', description: 'Test Transaction 1', amount: 100.0 },
    ];
    const ynabExpenses = [
      { id: '1', date: '2023-01-01', description: 'Test Transaction 1', amount: -100000 },
    ];

    // Simulate marking the first transaction as not a duplicate
    await markDuplicateTransaction(creditCardExpenses[0]);

    const result = await compareExpenses(creditCardExpenses, ynabExpenses);

    expect(result).to.deep.equal([]);
  });
});
