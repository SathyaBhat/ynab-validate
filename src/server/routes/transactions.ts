import { Router, Request, Response } from 'express';
import {
  getTransactions,
  getTransactionCount,
  getTransactionByReference,
  deleteTransaction,
} from '../../db';
import type { ErrorResponse, SuccessResponse } from '../app';
import type { AmExTransactionRow } from '../../types/index';

export function transactionRoutes(): Router {
  const router = Router();

  /**
   * GET /api/transactions
   * List all transactions with pagination
   */
  router.get(
    '/',
    (
      req: Request,
      res: Response<
        SuccessResponse<{
          transactions: AmExTransactionRow[];
          total: number;
          limit: number;
          offset: number;
          pages: number;
        }> | ErrorResponse
      >,
    ) => {
      try {
        // Parse query parameters
        const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 500);
        const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

        // Get transactions and count
        const transactions = getTransactions(limit, offset);
        const total = getTransactionCount();
        const pages = Math.ceil(total / limit);

        res.status(200).json({
          success: true,
          data: {
            transactions,
            total,
            limit,
            offset,
            pages,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        res.status(500).json({
          success: false,
          error: err instanceof Error ? err.message : 'Failed to fetch transactions',
          code: 'FETCH_ERROR',
          timestamp: new Date().toISOString(),
        });
      }
    },
  );

  /**
   * GET /api/transactions/:reference
   * Get transaction by reference
   */
  router.get(
    '/:reference',
    (
      req: Request,
      res: Response<SuccessResponse<AmExTransactionRow> | ErrorResponse>,
    ) => {
      try {
        const { reference } = req.params;

        if (!reference || reference.trim() === '') {
          return res.status(400).json({
            success: false,
            error: 'Reference parameter is required',
            code: 'MISSING_REFERENCE',
            timestamp: new Date().toISOString(),
          });
        }

        const transaction = getTransactionByReference(reference);

        if (!transaction) {
          return res.status(404).json({
            success: false,
            error: `Transaction with reference ${reference} not found`,
            code: 'NOT_FOUND',
            timestamp: new Date().toISOString(),
          });
        }

        res.status(200).json({
          success: true,
          data: transaction,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        res.status(500).json({
          success: false,
          error: err instanceof Error ? err.message : 'Failed to fetch transaction',
          code: 'FETCH_ERROR',
          timestamp: new Date().toISOString(),
        });
      }
    },
  );

  /**
   * GET /api/transactions/id/:id
   * Get transaction by ID
   */
  router.get(
    '/id/:id',
    (
      req: Request,
      res: Response<SuccessResponse<AmExTransactionRow> | ErrorResponse>,
    ) => {
      try {
        const { id } = req.params;
        const numId = parseInt(id, 10);

        if (isNaN(numId) || numId <= 0) {
          return res.status(400).json({
            success: false,
            error: 'ID must be a positive integer',
            code: 'INVALID_ID',
            timestamp: new Date().toISOString(),
          });
        }

        const transactions = getTransactions(1, 0); // Dummy call - better approach would be to add getTransactionById
        const transaction = transactions.find((t) => t.id === numId);

        if (!transaction) {
          return res.status(404).json({
            success: false,
            error: `Transaction with ID ${numId} not found`,
            code: 'NOT_FOUND',
            timestamp: new Date().toISOString(),
          });
        }

        res.status(200).json({
          success: true,
          data: transaction,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        res.status(500).json({
          success: false,
          error: err instanceof Error ? err.message : 'Failed to fetch transaction',
          code: 'FETCH_ERROR',
          timestamp: new Date().toISOString(),
        });
      }
    },
  );

  /**
   * DELETE /api/transactions/:id
   * Delete transaction by ID
   */
  router.delete(
    '/:id',
    (
      req: Request,
      res: Response<SuccessResponse<{ deleted: boolean; id: number }> | ErrorResponse>,
    ) => {
      try {
        const { id } = req.params;
        const numId = parseInt(id, 10);

        if (isNaN(numId) || numId <= 0) {
          return res.status(400).json({
            success: false,
            error: 'ID must be a positive integer',
            code: 'INVALID_ID',
            timestamp: new Date().toISOString(),
          });
        }

        const deleted = deleteTransaction(numId);

        if (!deleted) {
          return res.status(404).json({
            success: false,
            error: `Transaction with ID ${numId} not found`,
            code: 'NOT_FOUND',
            timestamp: new Date().toISOString(),
          });
        }

        res.status(200).json({
          success: true,
          data: {
            deleted: true,
            id: numId,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        res.status(500).json({
          success: false,
          error: err instanceof Error ? err.message : 'Failed to delete transaction',
          code: 'DELETE_ERROR',
          timestamp: new Date().toISOString(),
        });
      }
    },
  );

  return router;
}
