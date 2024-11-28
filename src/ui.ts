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
