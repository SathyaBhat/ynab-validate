import * as ynab from "ynab";
import {Account} from "ynab";
import {TransactionDetail, TransactionsResponse} from "ynab";


export class YNAB {
  private privateAccessToken = process.env.YNAB_TOKEN!;
  private ausBudgetId = process.env.BUDGET_ID!;
  private amexAccountId = process.env.ACCOUNT_ID!;
  public ynabAPI = new ynab.API(this.privateAccessToken);

  public async getYnabTransactions(startingDate: string) {
    try {
      return this.ynabAPI.transactions.getTransactionsByAccount(
        this.ausBudgetId,
        this.amexAccountId,
        startingDate
      );
    } catch (error) {
      console.log(error);
      throw new Error(`Error ${error} while fetching transactions`);
    }
  }

  public async getYnabAccounts() {
    try {
      const accounts = await this.ynabAPI.accounts.getAccounts(this.ausBudgetId);
      return accounts.data.accounts;
    } catch (error) {
      console.error(`Couldn't fetch accounts due to ${error}`);
    }
  }
}
