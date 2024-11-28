import { readCreditCardStatement } from '../src/parse';
import { expect } from 'chai';
import 'mocha';

describe('readCreditCardStatement', () => {
  it('should correctly read data from an Excel file and return the expected results', async () => {
    const filePath = 'test/activity.xlsx';
    const expectedResults = [
      { date: '2023-01-01', description: 'Test Transaction 1', amount: 100.0 },
      { date: '2023-01-02', description: 'Test Transaction 2', amount: 200.0 },
    ];

    const results = await readCreditCardStatement(filePath);

    expect(results).to.deep.equal(expectedResults);
  });

  it('should handle errors appropriately when reading from an invalid Excel file', async () => {
    const filePath = 'test/invalid.xlsx';

    try {
      await readCreditCardStatement(filePath);
    } catch (error) {
      expect(error).to.be.an('error');
    }
  });
});
