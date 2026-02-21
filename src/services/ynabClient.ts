import axios, { AxiosInstance } from 'axios';
import type { YnabBudget, YnabAccount, YnabTransaction } from '../types/index';

const YNAB_API_BASE = 'https://api.ynab.com/v1';

/**
 * YNAB API Client
 * Handles authentication and API calls to YNAB
 */
export class YnabClient {
  private client: AxiosInstance;

  constructor(accessToken: string) {
    if (!accessToken) {
      throw new Error('YNAB_ACCESS_TOKEN environment variable is required');
    }

    this.client = axios.create({
      baseURL: YNAB_API_BASE,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }

  /**
   * Get all budgets available to the user
   */
  async getBudgets(): Promise<YnabBudget[]> {
    try {
      const response = await this.client.get('/budgets');
      return response.data.data.budgets.map((budget: any) => ({
        id: budget.id,
        name: budget.name,
      }));
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch budgets');
    }
  }

  /**
   * Get accounts for a specific budget
   */
  async getAccounts(budgetId: string): Promise<YnabAccount[]> {
    try {
      const response = await this.client.get(`/budgets/${budgetId}/accounts`);
      return response.data.data.accounts.map((account: any) => ({
        id: account.id,
        name: account.name,
        type: account.type,
        currency_format: account.currency_format,
      }));
    } catch (error) {
      throw this.handleError(error, `Failed to fetch accounts for budget ${budgetId}`);
    }
  }

  /**
   * Get transactions for a specific month
   * @param budgetId - YNAB budget ID
   * @param month - Month in YYYY-MM format (e.g., "2024-01")
   * @param sinceDate - Optional: fetch transactions since this date (ISO 8601)
   */
  async getTransactionsByMonth(
    budgetId: string,
    month: string,
    sinceDate?: string,
  ): Promise<YnabTransaction[]> {
    try {
      let url = `/budgets/${budgetId}/transactions`;
      const params: Record<string, string> = {};

      if (sinceDate) {
        params.since_date = sinceDate;
      }

      const response = await this.client.get(url, { params });
      return response.data.data.transactions.map((txn: any) => ({
        id: txn.id,
        date: txn.date,
        amount: txn.amount,
        payee_name: txn.payee_name,
        category_name: txn.category_name,
        memo: txn.memo,
        cleared: txn.cleared,
        deleted: txn.deleted,
      }));
    } catch (error) {
      throw this.handleError(error, `Failed to fetch transactions for budget ${budgetId}`);
    }
  }

  /**
   * Get transactions for a date range
   * @param budgetId - YNAB budget ID
   * @param startDate - Start date (ISO 8601)
   * @param endDate - End date (ISO 8601)
   */
  async getTransactionsByDateRange(
    budgetId: string,
    startDate: string,
    endDate: string,
  ): Promise<YnabTransaction[]> {
    try {
      const response = await this.client.get(`/budgets/${budgetId}/transactions`, {
        params: {
          since_date: startDate,
        },
      });

      const allTransactions = response.data.data.transactions.map((txn: any) => ({
        id: txn.id,
        date: txn.date,
        amount: txn.amount,
        payee_name: txn.payee_name,
        category_name: txn.category_name,
        memo: txn.memo,
        cleared: txn.cleared,
        deleted: txn.deleted,
      }));

      // Filter by end date since YNAB API doesn't support it directly
      return allTransactions.filter((txn: YnabTransaction) => txn.date <= endDate);
    } catch (error) {
      throw this.handleError(
        error,
        `Failed to fetch transactions for budget ${budgetId} between ${startDate} and ${endDate}`,
      );
    }
  }

  /**
   * Create a single transaction in YNAB
   * POST /budgets/{budget_id}/transactions
   */
  async createTransaction(
    budgetId: string,
    accountId: string,
    transaction: {
      date: string; // ISO 8601: YYYY-MM-DD
      amount: number; // In milliunits (1000 = $1.00)
      payee_name?: string;
      memo?: string;
      cleared?: 'cleared' | 'uncleared' | 'reconciled';
      import_id?: string; // For duplicate detection
    },
  ): Promise<YnabTransaction> {
    try {
      const response = await this.client.post(`/budgets/${budgetId}/transactions`, {
        transaction: {
          account_id: accountId,
          date: transaction.date,
          amount: transaction.amount,
          payee_name: transaction.payee_name,
          memo: transaction.memo,
          cleared: transaction.cleared || 'uncleared',
          import_id: transaction.import_id,
        },
      });
      const txn = response.data.data.transaction;
      return {
        id: txn.id,
        date: txn.date,
        amount: txn.amount,
        payee_name: txn.payee_name,
        category_name: txn.category_name,
        memo: txn.memo,
        cleared: txn.cleared,
        deleted: txn.deleted,
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        throw new Error('Duplicate transaction: import_id already exists');
      }
      throw this.handleError(error, 'Failed to create transaction');
    }
  }

  /**
   * Update transaction flag color
   * PATCH /budgets/{budget_id}/transactions/{transaction_id}
   */
  async updateTransactionFlag(
    budgetId: string,
    transactionId: string,
    flagColor: 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | null,
  ): Promise<YnabTransaction> {
    try {
      const response = await this.client.patch(`/budgets/${budgetId}/transactions/${transactionId}`, {
        transaction: {
          flag_color: flagColor,
        },
      });
      const txn = response.data.data.transaction;
      return {
        id: txn.id,
        date: txn.date,
        amount: txn.amount,
        payee_name: txn.payee_name,
        category_name: txn.category_name,
        memo: txn.memo,
        cleared: txn.cleared,
        deleted: txn.deleted,
      };
    } catch (error) {
      throw this.handleError(error, `Failed to update flag for transaction ${transactionId}`);
    }
  }

  /**
   * Bulk create transactions
   * POST /budgets/{budget_id}/transactions/bulk
   */
  async bulkCreateTransactions(
    budgetId: string,
    accountId: string,
    transactions: Array<{
      date: string;
      amount: number;
      payee_name?: string;
      memo?: string;
      cleared?: 'cleared' | 'uncleared' | 'reconciled';
      import_id?: string;
    }>,
  ): Promise<{ transaction_ids: string[]; duplicate_import_ids: string[] }> {
    try {
      const response = await this.client.post(`/budgets/${budgetId}/transactions/bulk`, {
        transactions: transactions.map((txn) => ({
          account_id: accountId,
          date: txn.date,
          amount: txn.amount,
          payee_name: txn.payee_name,
          memo: txn.memo,
          cleared: txn.cleared || 'uncleared',
          import_id: txn.import_id,
        })),
      });
      return {
        transaction_ids: response.data.data.transaction_ids || [],
        duplicate_import_ids: response.data.data.duplicate_import_ids || [],
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to bulk create transactions');
    }
  }

  /**
   * Generate import_id for duplicate detection
   * Format: YNAB:{milliunits}:{date}:{reference_substring}
   */
  static generateImportId(amount: number, date: string, reference: string): string {
    const milliunits = YnabClient.amountToMilliunits(amount);
    const refSubstring = reference.substring(0, 12);
    return `YNAB:${milliunits}:${date}:${refSubstring}`;
  }

  /**
   * Convert milliunits to standard currency units
   * YNAB amounts are in milliunits: 1000 milliunits = 1 currency unit
   */
  static milliunitsToAmount(milliunits: number): number {
    return milliunits / 1000;
  }

  /**
   * Convert standard currency units to milliunits
   */
  static amountToMilliunits(amount: number): number {
    return Math.round(amount * 1000);
  }

  /**
   * Handle API errors with helpful messages
   */
  private handleError(error: any, context: string): Error {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        return new Error('Unauthorized: Invalid YNAB access token');
      }
      if (error.response?.status === 404) {
        return new Error(`${context}: Not found`);
      }
      if (error.response?.status === 429) {
        return new Error('Rate limit exceeded. Please try again later.');
      }
      return new Error(`${context}: ${error.response?.data?.error?.detail || error.message}`);
    }
    return new Error(`${context}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Factory function to create a YNAB client with token from environment
 */
export function createYnabClient(): YnabClient {
  const token = process.env.YNAB_ACCESS_TOKEN;
  if (!token) {
    throw new Error('YNAB_ACCESS_TOKEN environment variable is not set');
  }
  return new YnabClient(token);
}
