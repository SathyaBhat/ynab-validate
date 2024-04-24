import dotenv from "dotenv";
import fs from 'fs';
import {readCreditCardStatement} from "./parse";
import {YNAB} from "./ynab";
dotenv.config();

import {TransactionDetail} from "ynab";

function picoDollarsToDollars(amount: number) {
  return amount / 1000;
}
function compareExpenses(creditCardExpenses: ExpenseEntry[], ynabExpenses: TransactionDetail[]) {
  let ynabMissingExpenses = [];
  let ynabDuplicateExpenses = [];
  let amexMissingExpenses = [];

  for (const expense of creditCardExpenses) {
    const missingEntries = ynabExpenses.filter((y) => ((-1 * picoDollarsToDollars(y.amount)) === expense.amount));
    const duplicateEntries = ynabExpenses.filter((y) => (((-1 * picoDollarsToDollars(y.amount)) === expense.amount) && (y.date === expense.date)));
    if (missingEntries.length === 0) {
      ynabMissingExpenses.push({...expense});
    } else if (duplicateEntries.length > 1) {
      ynabDuplicateExpenses.push({...expense});
    }
  }

  for (const expense of ynabExpenses) {
    const missingEntries = creditCardExpenses.filter((y) => (y.amount === (-1 * picoDollarsToDollars(expense.amount)) && expense.cleared !== "uncleared"));
    if (missingEntries.length === 0) {
      amexMissingExpenses.push({...expense});
    }
  }


  if (ynabMissingExpenses.length > 0) {
    console.log('Transactions in Amex Statement but not in YNAB:');
    ynabMissingExpenses.map(t => {
      console.log(`\t${t.date} ${picoDollarsToDollars(t.amount)} (${t.description})`);
    });
  }

  if (amexMissingExpenses.length > 0) {
    console.log('Transactions in YNAB but not in Amex (possibly wrong entries or amex statement not up to date)');
    amexMissingExpenses.map(t => {
      console.log(`\t${t.date} ${picoDollarsToDollars(t.amount)} (${t.memo})`);
    });
  }

  if (ynabDuplicateExpenses.length > 0) {
    console.log('Possible duplicate transactions in YNAB:');
    ynabDuplicateExpenses.map(t => {
      console.log(`\t${t.date} amount ${t.amount} (${t.description})`);
    });
  }
}


async function main() {
  const expensesOnCard = await readCreditCardStatement('activity.csv');
  fs.writeFileSync('clean-amex.csv', JSON.stringify(expensesOnCard));
  const startingDate = expensesOnCard[expensesOnCard.length - 1].date;
  console.log('Checking for transactions starting from', startingDate);

  const ynab = new YNAB();
  const ynabExpenses = (await ynab.getYnabTransactions(startingDate)).data.transactions;
  fs.writeFileSync('clean-ynab.csv', JSON.stringify(ynabExpenses));
  compareExpenses(expensesOnCard, ynabExpenses);

}

if (require.main === module) {
  main();
}

