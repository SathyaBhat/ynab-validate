import { Router, Request, Response } from 'express';
import type { ReconciliationResult } from '../../types/index';
import { ReconciliationService } from '../../services/reconciliationService';
import { YnabClient } from '../../services/ynabClient';
import {
  batchMarkReconciled,
  unreconcileTransaction,
  getReconciliationLogs,
  insertReconciliationLog,
} from '../../db';
import { getQueryInt, getQueryString } from '../utils/queryParams';

export function reconcileRoutes(): Router {
  const router = Router();

/**
 * POST /api/reconcile
 * Reconcile card transactions against YNAB
 *
 * Body:
 * {
 *   "budgetId": "YNAB_BUDGET_ID",
 *   "accountId": "YNAB_ACCOUNT_ID",
 *   "startDate": "2024-01-01",
 *   "endDate": "2024-01-31",
 *   "dateTolerance": 2,           // Optional: days tolerance (default: 2)
 *   "amountTolerance": 0.01       // Optional: amount tolerance (default: 0.01)
 * }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { budgetId, accountId, startDate, endDate, dateTolerance, amountTolerance } = req.body;
    const persist = req.query.persist === 'true';

    // Validate required fields
    if (!budgetId || !accountId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: budgetId, accountId, startDate, endDate',
        code: 'MISSING_FIELDS',
        timestamp: new Date().toISOString(),
      });
    }

    // Validate date format (ISO 8601)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use ISO 8601 (YYYY-MM-DD)',
        code: 'INVALID_DATE_FORMAT',
        timestamp: new Date().toISOString(),
      });
    }

    // Validate date range
    if (startDate > endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate must be before or equal to endDate',
        code: 'INVALID_DATE_RANGE',
        timestamp: new Date().toISOString(),
      });
    }

    // Create YNAB client and reconciliation service
    try {
      const ynabClient = new YnabClient(process.env.YNAB_ACCESS_TOKEN || '');
      const reconciliationService = new ReconciliationService(ynabClient, {
        dateTolerance: dateTolerance || 2,
        amountTolerance: amountTolerance || 0.01,
      });

      // Perform reconciliation with optional persistence
      const result = await reconciliationService.reconcileAndPersist(
        budgetId,
        accountId,
        startDate,
        endDate,
        persist,
      );

      return res.status(result.success ? 200 : 400).json({
        success: result.success,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Handle authentication errors
      if (errorMessage.includes('Unauthorized') || errorMessage.includes('Invalid')) {
        return res.status(401).json({
          success: false,
          error: 'Authentication failed. Check your YNAB_ACCESS_TOKEN',
          code: 'AUTH_FAILED',
          timestamp: new Date().toISOString(),
        });
      }

      // Handle budget not found
      if (errorMessage.includes('Not found')) {
        return res.status(404).json({
          success: false,
          error: `Budget with ID ${budgetId} not found`,
          code: 'BUDGET_NOT_FOUND',
          timestamp: new Date().toISOString(),
        });
      }

      // Handle rate limiting
      if (errorMessage.includes('Rate limit')) {
        return res.status(429).json({
          success: false,
          error: 'YNAB API rate limit exceeded. Please try again later.',
          code: 'RATE_LIMIT',
          timestamp: new Date().toISOString(),
        });
      }

      throw error;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      success: false,
      error: errorMessage,
      code: 'RECONCILIATION_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/reconcile/persist
 * Manually persist matches to database
 *
 * Body:
 * {
 *   "matches": [{ "cardId": 1, "ynabId": "ynab-001" }],
 *   "budgetId": "budget-id",
 *   "startDate": "2024-01-01",
 *   "endDate": "2024-01-31"
 * }
 */
router.post('/persist', async (req: Request, res: Response) => {
  try {
    const { matches, budgetId, startDate, endDate } = req.body;

    if (!matches || !Array.isArray(matches)) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid matches array',
        code: 'INVALID_REQUEST',
        timestamp: new Date().toISOString(),
      });
    }

    const result = batchMarkReconciled(matches);

    // Log reconciliation if provided
    if (budgetId && startDate && endDate) {
      await insertReconciliationLog({
        budget_id: budgetId,
        start_date: startDate,
        end_date: endDate,
        matched_count: result.updated,
        missing_in_ynab_count: 0,
        unexpected_in_ynab_count: 0,
        flagged_count: 0,
        created_in_ynab_count: 0,
        reconciled_at: new Date().toISOString(),
      });
    }

    return res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      success: false,
      error: errorMessage,
      code: 'PERSIST_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/reconcile/flag
 * Flag selected YNAB transactions
 *
 * Body:
 * {
 *   "budgetId": "budget-id",
 *   "transactionIds": ["id1", "id2"],
 *   "flagColor": "orange"
 * }
 */
router.post('/flag', async (req: Request, res: Response) => {
  try {
    const { budgetId, transactionIds, flagColor = 'orange' } = req.body;

    if (!budgetId || !transactionIds || !Array.isArray(transactionIds)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: budgetId, transactionIds',
        code: 'INVALID_REQUEST',
        timestamp: new Date().toISOString(),
      });
    }

    const ynabClient = new YnabClient(process.env.YNAB_ACCESS_TOKEN || '');
    const reconciliationService = new ReconciliationService(ynabClient);

    const result = await reconciliationService.flagUnexpectedInYnab(
      budgetId,
      transactionIds,
      flagColor,
    );

    return res.json({
      success: result.success,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      success: false,
      error: errorMessage,
      code: 'FLAG_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/reconcile/create
 * Create selected transactions in YNAB
 *
 * Body:
 * {
 *   "budgetId": "budget-id",
 *   "accountId": "account-id",
 *   "cardTransactionIds": [1, 2, 3]
 * }
 */
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { budgetId, accountId, cardTransactionIds } = req.body;

    if (!budgetId || !accountId || !cardTransactionIds || !Array.isArray(cardTransactionIds)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: budgetId, accountId, cardTransactionIds',
        code: 'INVALID_REQUEST',
        timestamp: new Date().toISOString(),
      });
    }

    const ynabClient = new YnabClient(process.env.YNAB_ACCESS_TOKEN || '');
    const reconciliationService = new ReconciliationService(ynabClient);

    const result = await reconciliationService.createMissingInYnab(
      budgetId,
      accountId,
      cardTransactionIds,
    );

    return res.json({
      success: result.success,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      success: false,
      error: errorMessage,
      code: 'CREATE_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * DELETE /api/reconcile/match/:cardTransactionId
 * Unmatch a reconciled transaction
 */
router.delete('/match/:cardTransactionId', async (req: Request, res: Response) => {
  try {
    const cardTransactionId = parseInt(getQueryString(req.params.cardTransactionId), 10);

    if (isNaN(cardTransactionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid cardTransactionId',
        code: 'INVALID_REQUEST',
        timestamp: new Date().toISOString(),
      });
    }

    const unmatched = unreconcileTransaction(cardTransactionId);

    return res.json({
      success: true,
      data: { unmatched },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      success: false,
      error: errorMessage,
      code: 'UNMATCH_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/reconcile/history
 * Get reconciliation history logs
 *
 * Query params:
 * - budgetId (optional): Filter by budget ID
 * - limit (optional): Number of records (default: 50)
 * - offset (optional): Pagination offset (default: 0)
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const budgetId = getQueryString(req.query.budgetId) || undefined;
    const limit = getQueryInt(req.query.limit, 50, 1);
    const offset = getQueryInt(req.query.offset, 0, 0);

    const logs = getReconciliationLogs(budgetId, limit, offset);

    return res.json({
      success: true,
      data: logs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      success: false,
      error: errorMessage,
      code: 'HISTORY_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/reconcile/accounts/:budgetId
 * Get YNAB accounts for budget (for account selection UI)
 */
router.get('/accounts/:budgetId', async (req: Request, res: Response) => {
  try {
    const budgetId = getQueryString(req.params.budgetId);

    if (!budgetId) {
      return res.status(400).json({
        success: false,
        error: 'Missing budgetId parameter',
        code: 'INVALID_REQUEST',
        timestamp: new Date().toISOString(),
      });
    }

    const ynabClient = new YnabClient(process.env.YNAB_ACCESS_TOKEN || '');
    const accounts = await ynabClient.getAccounts(budgetId);

    return res.json({
      success: true,
      data: accounts,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('Unauthorized') || errorMessage.includes('Invalid')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication failed. Check your YNAB_ACCESS_TOKEN',
        code: 'AUTH_FAILED',
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(500).json({
      success: false,
      error: errorMessage,
      code: 'ACCOUNTS_FETCH_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/reconcile/budgets
 * Get list of YNAB budgets (for UI dropdown)
 */
router.get('/budgets', async (req: Request, res: Response) => {
  try {
    const ynabClient = new YnabClient(process.env.YNAB_ACCESS_TOKEN || '');
    const budgets = await ynabClient.getBudgets();

    return res.json({
      success: true,
      data: budgets,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('Unauthorized') || errorMessage.includes('Invalid')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication failed. Check your YNAB_ACCESS_TOKEN',
        code: 'AUTH_FAILED',
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(500).json({
      success: false,
      error: errorMessage,
      code: 'BUDGETS_FETCH_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
  });

  return router;
}
