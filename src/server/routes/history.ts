import { Router, Request, Response } from 'express';
import { getImportLogs } from '../../db';
import type { ErrorResponse, SuccessResponse } from '../app';
import type { ImportLog } from '../../types/index';

export function historyRoutes(): Router {
  const router = Router();

  /**
   * GET /api/import-history
   * Get import history with pagination
   */
  router.get(
    '/',
    (
      req: Request,
      res: Response<
        SuccessResponse<{
          logs: ImportLog[];
          total: number;
          limit: number;
          offset: number;
        }> | ErrorResponse
      >,
    ) => {
      try {
        const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 500);
        const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

        const logs = getImportLogs(limit, offset);

        // Get total count (would be better to add separate function, for now we estimate)
        // In a real app, you'd add a getImportLogCount() function to db.ts
        res.status(200).json({
          success: true,
          data: {
            logs,
            total: logs.length + offset, // Simplified
            limit,
            offset,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        res.status(500).json({
          success: false,
          error: err instanceof Error ? err.message : 'Failed to fetch import history',
          code: 'FETCH_ERROR',
          timestamp: new Date().toISOString(),
        });
      }
    },
  );

  /**
   * GET /api/import-history/:id
   * Get specific import log
   */
  router.get(
    '/:id',
    (
      req: Request,
      res: Response<SuccessResponse<ImportLog> | ErrorResponse>,
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

        const logs = getImportLogs(1, 0);
        const log = logs.find((l) => l.id === numId);

        if (!log) {
          return res.status(404).json({
            success: false,
            error: `Import log with ID ${numId} not found`,
            code: 'NOT_FOUND',
            timestamp: new Date().toISOString(),
          });
        }

        res.status(200).json({
          success: true,
          data: log,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        res.status(500).json({
          success: false,
          error: err instanceof Error ? err.message : 'Failed to fetch import log',
          code: 'FETCH_ERROR',
          timestamp: new Date().toISOString(),
        });
      }
    },
  );

  return router;
}
