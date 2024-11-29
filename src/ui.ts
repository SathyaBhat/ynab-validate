import inquirer from 'inquirer';
import { ExpenseEntry } from './types';

export async function promptMarkDuplicate(expense: ExpenseEntry): Promise<boolean> {
  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'isDuplicate',
      message: `Is this a duplicate transaction? ${expense.date} ${expense.description} ${expense.amount}`,
      default: true,
    },
  ]);

  return answers.isDuplicate;
}

export async function promptMarkNotDuplicate(expense: ExpenseEntry): Promise<boolean> {
  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'isNotDuplicate',
      message: `Mark this transaction as not a duplicate? ${expense.date} ${expense.description} ${expense.amount}`,
      default: false,
    },
  ]);

  return answers.isNotDuplicate;
}
