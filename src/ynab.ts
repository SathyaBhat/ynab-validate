import * as ynab from "ynab";

export class YNAB {
  private privateAccessToken = process.env.YNAB_TOKEN!;
  private ausBudgetId = process.env.BUDGET_ID!;
  private amexAccountId = process.env.ACCOUNT_ID!;
  public ynabAPI = new ynab.API(this.privateAccessToken);

  public async getYnabTransactions(startingDate: string) {
    try {
      return this.ynabAPI.transactions.getTransactionsByAccount(this.ausBudgetId, this.amexAccountId, startingDate);
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

  public dollarsToPicoDollars(amount: number) {
    return amount * 1000;
  }

  public async submitYNABTransaction(transaction: ExpenseEntry) {
    try {
      const resp = await this.ynabAPI.transactions.createTransaction(this.ausBudgetId, {
        transaction: {
          account_id: this.amexAccountId,
          date: transaction.date,
          amount: -1 * this.dollarsToPicoDollars(transaction.amount),
          approved: false,
          memo: transaction.description,
          cleared: ynab.TransactionClearedStatus.Uncleared,
        },
      });
      if (resp.data.transaction_ids) {
        console.log("Submitted to YNAB with transaction id ", resp.data.transaction_ids.join(" "));
      }
    } catch (error) {
      console.error("Couldn't submit to YNAB", error);
      throw new Error(`Error ${error} while submitting transaction`);
    }
  }
}
