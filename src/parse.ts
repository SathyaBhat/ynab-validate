import csv from 'csv-parser';
import fs from 'fs';
import moment from 'moment';

export async function readCreditCardStatement(filePath: string): Promise<ExpenseEntry[]> {
  return new Promise((resolve, reject) => {
    const results: ExpenseEntry[] = [];
    fs.createReadStream(filePath)
      .pipe(csv({
        mapHeaders: ({header, index}) => {
          switch (header.replace(/ /g, '_').toLowerCase()) {
            case 'date': return 'date';
            case 'description': return 'description';
            case 'amount': return 'amount';
            default: return null;
          }
        },
        mapValues: ({header, value}) => {
          if (header?.toLowerCase() === 'date') {
            return moment(value, 'DD/MM/YYYY').format('YYYY-MM-DD');
          } else if (header?.toLowerCase() === 'amount') {
            return parseFloat(value);
          } else {
            return value;
          }
        }
      }))
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}