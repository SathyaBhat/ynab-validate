import chalk from "chalk";
import dotenv from "dotenv";
import { TransactionDetail } from "ynab";
import { readCreditCardStatement, saveExpensesToDatabase } from "./parse";
import { YNAB } from "./ynab";
import { getExpensesFromDatabase, markDuplicateTransaction, isDuplicateTransaction } from "./database";
import { promptMarkDuplicate, promptMarkNotDuplicate } from "./ui";

dotenv.config();
const publishToYNAB = process.env.PUBLISH_TO_YNAB === "true";

function picoDollarsToDollars(amount: number) {
  return amount / 1000;
}

function prettyPrintAmount(amount: number) {
  return amount > 0 ? chalk.red(amount) : chalk.green(amount);
}

async function compareExpenses(creditCardExpenses: ExpenseEntry[], ynabExpenses: TransactionDetail[]) {
  let ynabMissingExpenses = [];
  let ynabDuplicateExpenses = [];
  let amexMissingExpenses = [];

  for (const expense of creditCardExpenses) {
    const missingEntries = ynabExpenses.filter((y) => -1 * picoDollarsToDollars(y.amount) === expense.amount);
    const duplicateEntries = ynabExpenses.filter(
      (y) => -1 * picoDollarsToDollars(y.amount) === expense.amount && y.date === expense.date
    );
    if (missingEntries.length === 0) {
      ynabMissingExpenses.push({ ...expense });
    } else if (duplicateEntries.length > 1) {
      const isDuplicate = await isDuplicateTransaction(expense);
      if (!isDuplicate) {
        const markAsNotDuplicate = await promptMarkNotDuplicate(expense);
        if (markAsNotDuplicate) {
          await markDuplicateTransaction(expense);
        } else {
          ynabDuplicateExpenses.push({ ...expense });
        }
      } else {
        ynabDuplicateExpenses.push({ ...expense });
      }
    }
  }

  for (const expense of ynabExpenses) {
    const missingEntries = creditCardExpenses.filter(
      (y) => y.amount === -1 * picoDollarsToDollars(expense.amount) && expense.cleared !== "uncleared"
    );
    if (missingEntries.length === 0) {
      amexMissingExpenses.push({ ...expense });
    }
  }

  if (ynabMissingExpenses.length > 0) {
    console.log(chalk.yellowBright("Transactions in Amex Statement but not in YNAB:"));
    ynabMissingExpenses.map((t) => {
      console.log(`\t${t.date} ${prettyPrintAmount(t.amount)} ${chalk.italic(t.description)}`);
    });
  }

  if (amexMissingExpenses.length > 0) {
    console.log(
      chalk.yellowBright(
        "Transactions in YNAB but not in Amex (possibly wrong entries or amex statement not up to date)"
      )
    );
    amexMissingExpenses.map((t) => {
      console.log(`\t${t.date} ${prettyPrintAmount(-1 * picoDollarsToDollars(t.amount))} ${chalk.italic(t.memo)}`);
    });
  }

  if (ynabDuplicateExpenses.length > 0) {
    console.log("Possible duplicate transactions in YNAB:");
    ynabDuplicateExpenses.map((t) => {
      console.log(`\t${t.date} amount ${prettyPrintAmount(t.amount)} ${chalk.italic(t.description)}`);
    });
  }
  return ynabMissingExpenses;
}

async function main() {
  const expensesOnCard = await readCreditCardStatement("activity.xlsx");
  await saveExpensesToDatabase(expensesOnCard, "expenses.db");
  const expensesFromDb = await getExpensesFromDatabase("expenses.db");
  const startingDate = expensesFromDb[expensesFromDb.length - 1].date;
  const lastDate = expensesFromDb[0].date;
  console.log(`Checking for transactions starting from ${startingDate} to ${lastDate}`);
  const ynab = new YNAB();

  const ynabExpenses = (await ynab.getYnabTransactions(startingDate)).data.transactions;
  const filteredYnabExpenses = ynabExpenses.filter((t) => new Date(t.date) <= new Date(lastDate));
  let ynabMissingExpenses = await compareExpenses(expensesFromDb, filteredYnabExpenses);
  if (publishToYNAB && ynabMissingExpenses.length) {
    console.log("Publishing missing transactions to YNAB");
    ynabMissingExpenses.map(async (transaction) => {
      await ynab.submitYNABTransaction({ ...transaction });
    });
  }
}

if (require.main === module) {
  main();
}
