import { YNAB } from '../src/ynab';
import { expect } from 'chai';
import 'mocha';

describe('submitYNABTransaction', () => {
  it('should correctly submit transactions to the YNAB API', async () => {
    const ynab = new YNAB();
    const transaction = {
      date: '2023-01-01',
      description: 'Test Transaction',
      amount: 100.0,
    };

    const result = await ynab.submitYNABTransaction(transaction);

    expect(result).to.be.an('object');
    expect(result).to.have.property('transaction_ids');
  });

  it('should handle errors appropriately when submitting transactions to the YNAB API', async () => {
    const ynab = new YNAB();
    const transaction = {
      date: 'invalid-date',
      description: 'Test Transaction',
      amount: 100.0,
    };

    try {
      await ynab.submitYNABTransaction(transaction);
    } catch (error) {
      expect(error).to.be.an('error');
    }
  });
});
