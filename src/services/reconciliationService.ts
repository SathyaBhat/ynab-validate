import type {
  AmExTransactionRow,
  YnabTransaction,
  ReconciliationMatch,
  DiscrepancyReport,
  ReconciliationResult,
  ReconciliationResultWithActions,
  FlagResult,
  CreateResult,
} from '../types/index';
import {
  getTransactions,
  getTransactionsByDateRange,
  batchMarkReconciled,
  insertReconciliationLog,
} from '../db';
import { YnabClient } from './ynabClient';

/**
 * Configuration for reconciliation matching
 */
interface ReconciliationConfig {
  /**
   * Number of days to tolerate for date differences
   * Default: 2 (±2 days)
   */
  dateTolerance: number;

  /**
   * Amount tolerance in currency units (not milliunits)
   * Default: 0.01 (match to exact cent)
   */
  amountTolerance: number;

  /**
   * Whether to exclude deleted/cleared transactions
   * Default: true
   */
  excludeDeletedTransactions: boolean;
}

const DEFAULT_CONFIG: ReconciliationConfig = {
  dateTolerance: 2,
  amountTolerance: 0.01,
  excludeDeletedTransactions: true,
};

/**
 * Reconciliation Service
 * Compares card transactions against YNAB transactions
 */
export class ReconciliationService {
  private ynabClient: YnabClient;
  private config: ReconciliationConfig;

  constructor(ynabClient: YnabClient, config?: Partial<ReconciliationConfig>) {
    this.ynabClient = ynabClient;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Reconcile card transactions against YNAB for a date range
   * @param budgetId - YNAB budget ID
   * @param startDate - Start date (ISO 8601)
   * @param endDate - End date (ISO 8601)
   * @param limit - Max card transactions to fetch
   * @param offset - Pagination offset for card transactions
   */
  async reconcile(
    budgetId: string,
    startDate: string,
    endDate: string,
    limit: number = 500,
    offset: number = 0,
  ): Promise<ReconciliationResult> {
    try {
      // Fetch card transactions
      const cardTransactions = await this.getCardTransactionsInRange(startDate, endDate, limit, offset);

      // Fetch YNAB transactions
      const ynabTransactions = await this.ynabClient.getTransactionsByDateRange(
        budgetId,
        startDate,
        endDate,
      );

      // Filter out deleted transactions if configured
      const filteredYnabTransactions = this.config.excludeDeletedTransactions
        ? ynabTransactions.filter((t) => !t.deleted)
        : ynabTransactions;

      // Perform reconciliation
      const { matched, missingInYnab, unexpectedInYnab } = this.matchTransactions(
        cardTransactions,
        filteredYnabTransactions,
      );

      return {
        success: true,
        dateRange: { startDate, endDate },
        budgetId,
        cardTransactionCount: cardTransactions.length,
        ynabTransactionCount: filteredYnabTransactions.length,
        matchedCount: matched.length,
        discrepancies: {
          missingInYnab,
          unexpectedInYnab,
          matched,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        dateRange: { startDate, endDate },
        budgetId,
        cardTransactionCount: 0,
        ynabTransactionCount: 0,
        matchedCount: 0,
        discrepancies: {
          missingInYnab: [],
          unexpectedInYnab: [],
          matched: [],
        },
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Reconcile and optionally persist matches to database
   */
  async reconcileAndPersist(
    budgetId: string,
    startDate: string,
    endDate: string,
    persist: boolean = false,
  ): Promise<ReconciliationResultWithActions> {
    // Run standard reconciliation
    const result = await this.reconcile(budgetId, startDate, endDate);

    // Determine available actions
    const actions = {
      canPersist: result.matchedCount > 0,
      canFlag: result.discrepancies.unexpectedInYnab.length > 0,
      canCreate: result.discrepancies.missingInYnab.length > 0,
      persistedCount: undefined as number | undefined,
    };

    // Persist matches if requested
    if (persist && actions.canPersist) {
      const matches = result.discrepancies.matched.map((match) => ({
        cardId: match.cardTransaction.id,
        ynabId: match.ynabTransaction.id,
      }));
      const persistResult = batchMarkReconciled(matches);
      actions.persistedCount = persistResult.updated;

      // Log reconciliation
      await insertReconciliationLog({
        budget_id: budgetId,
        start_date: startDate,
        end_date: endDate,
        matched_count: result.matchedCount,
        missing_in_ynab_count: result.discrepancies.missingInYnab.length,
        unexpected_in_ynab_count: result.discrepancies.unexpectedInYnab.length,
        flagged_count: 0,
        created_in_ynab_count: 0,
        reconciled_at: new Date().toISOString(),
        config: JSON.stringify(this.config),
      });
    }

    return {
      ...result,
      actions,
    };
  }

  /**
   * Flag unexpected YNAB transactions (in YNAB but not on card)
   */
  async flagUnexpectedInYnab(
    budgetId: string,
    ynabTransactionIds: string[],
    flagColor: 'orange' = 'orange',
  ): Promise<FlagResult> {
    const errors: Array<{ id: string; error: string }> = [];
    let flagged = 0;

    for (const txnId of ynabTransactionIds) {
      try {
        await this.ynabClient.updateTransactionFlag(budgetId, txnId, flagColor);
        flagged++;
      } catch (error) {
        errors.push({
          id: txnId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      success: errors.length === 0,
      flagged,
      errors,
    };
  }

  /**
   * Create missing transactions in YNAB from card transactions
   */
  async createMissingInYnab(
    budgetId: string,
    accountId: string,
    cardTransactionIds: number[],
  ): Promise<CreateResult> {
    const errors: Array<{ cardId: number; error: string }> = [];
    let created = 0;
    let skipped = 0;

    // Fetch card transactions by IDs
    const allCardTransactions = getTransactions(1000, 0);
    const cardTransactionsMap = new Map(allCardTransactions.map((txn) => [txn.id, txn]));

    for (const cardId of cardTransactionIds) {
      const cardTxn = cardTransactionsMap.get(cardId);
      if (!cardTxn) {
        errors.push({
          cardId,
          error: 'Transaction not found',
        });
        continue;
      }

      try {
        // Generate import_id for duplicate detection
        const importId = YnabClient.generateImportId(cardTxn.amount, cardTxn.date, cardTxn.reference);

        // Create transaction in YNAB
        await this.ynabClient.createTransaction(budgetId, accountId, {
          date: cardTxn.date,
          amount: YnabClient.amountToMilliunits(cardTxn.amount),
          payee_name: cardTxn.description,
          memo: `${cardTxn.card_member} | ${cardTxn.reference}`,
          cleared: 'uncleared',
          import_id: importId,
        });
        created++;
      } catch (error) {
        if (error instanceof Error && error.message.includes('Duplicate transaction')) {
          skipped++;
        } else {
          errors.push({
            cardId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return {
      success: errors.length === 0,
      created,
      skipped,
      errors,
    };
  }

  /**
   * Get card transactions within a date range
   */
  private async getCardTransactionsInRange(
    startDate: string,
    endDate: string,
    limit: number,
    offset: number,
  ): Promise<AmExTransactionRow[]> {
    // Use optimized database query for date range
    return getTransactionsByDateRange(startDate, endDate);
  }

  /**
   * Match card transactions against YNAB transactions
   * Returns matched pairs and discrepancies
   */
  private matchTransactions(
    cardTransactions: AmExTransactionRow[],
    ynabTransactions: YnabTransaction[],
  ): {
    matched: ReconciliationMatch[];
    missingInYnab: AmExTransactionRow[];
    unexpectedInYnab: YnabTransaction[];
  } {
    const matched: ReconciliationMatch[] = [];
    const unmatchedCard = new Map<number, AmExTransactionRow>();
    const unmatchedYnab = new Map<string, YnabTransaction>();

    // Initialize unmatched maps
    cardTransactions.forEach((txn, index) => {
      unmatchedCard.set(index, txn);
    });
    ynabTransactions.forEach((txn) => {
      unmatchedYnab.set(txn.id, txn);
    });

    // Try to match each card transaction
    for (const [cardIndex, cardTxn] of unmatchedCard.entries()) {
      const candidates = this.findMatchingYnabTransactions(cardTxn, ynabTransactions);

      if (candidates.length > 0) {
        // Pick the best match (closest date)
        const bestMatch = candidates.reduce((prev, current) =>
          Math.abs(this.dateDifference(cardTxn.date, prev.ynabTransaction.date)) <
          Math.abs(this.dateDifference(cardTxn.date, current.ynabTransaction.date))
            ? prev
            : current,
        );

        matched.push(bestMatch);
        unmatchedCard.delete(cardIndex);
        unmatchedYnab.delete(bestMatch.ynabTransaction.id);
      }
    }

    return {
      matched,
      missingInYnab: Array.from(unmatchedCard.values()),
      unexpectedInYnab: Array.from(unmatchedYnab.values()),
    };
  }

  /**
   * Find YNAB transactions that could match a card transaction
   */
  private findMatchingYnabTransactions(
    cardTxn: AmExTransactionRow,
    ynabTransactions: YnabTransaction[],
  ): ReconciliationMatch[] {
    const cardAmount = cardTxn.amount;
    const cardDate = cardTxn.date;

    return ynabTransactions
      .filter((ynabTxn) => {
        // Check amount match (convert milliunits to standard units)
        const ynabAmount = YnabClient.milliunitsToAmount(ynabTxn.amount);
        const amountDiff = Math.abs(cardAmount - ynabAmount);

        // Check date match (within tolerance)
        const dateDiff = Math.abs(this.dateDifference(cardDate, ynabTxn.date));

        return amountDiff <= this.config.amountTolerance && dateDiff <= this.config.dateTolerance;
      })
      .map((ynabTxn) => ({
        cardTransaction: cardTxn,
        ynabTransaction: ynabTxn,
        dateDifference: this.dateDifference(cardDate, ynabTxn.date),
      }));
  }

  /**
   * Calculate difference between two ISO dates in days
   * Positive if second date is after first, negative if before
   */
  private dateDifference(date1: string, date2: string): number {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffMs = d2.getTime() - d1.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  }
}

/**
 * Factory function to create reconciliation service with YNAB client
 */
export function createReconciliationService(
  config?: Partial<ReconciliationConfig>,
): ReconciliationService {
  const ynabClient = new YnabClient(process.env.YNAB_ACCESS_TOKEN || '');
  return new ReconciliationService(ynabClient, config);
}
