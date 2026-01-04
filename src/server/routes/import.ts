import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import { importAmExStatementSync } from '../../services/importService';
import { parseAmExStatement } from '../../parser';
import { validateTransactionBatch } from '../../validator';
import type { ErrorResponse, SuccessResponse } from '../app';
import type { ImportResult } from '../../types/index';

export function importRoutes(upload: any): Router {
  const router = Router();

  /**
   * POST /api/import
   * Upload and import AmEx XLSX statement
   */
  router.post(
    '/',
    upload.single('file'),
    (
      req: Request & { file?: Express.Multer.File },
      res: Response<SuccessResponse<ImportResult> | ErrorResponse>,
    ) => {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
          code: 'NO_FILE_UPLOADED',
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const filePath = req.file.path;
        const result = importAmExStatementSync(filePath);

        // Clean up uploaded file
        fs.unlink(filePath, (err) => {
          if (err) console.error('Failed to delete uploaded file:', err);
        });

        const statusCode = result.success ? 200 : 207; // 207 Partial Success if some errors
        res.status(statusCode).json({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        // Clean up uploaded file
        fs.unlink(req.file.path, (err) => {
          if (err) console.error('Failed to delete uploaded file:', err);
        });

        res.status(500).json({
          success: false,
          error: err instanceof Error ? err.message : 'Import failed',
          code: 'IMPORT_ERROR',
          timestamp: new Date().toISOString(),
        });
      }
    },
  );

  /**
   * POST /api/import/validate
   * Validate XLSX file without importing
   */
  router.post(
    '/validate',
    upload.single('file'),
    (
      req: Request & { file?: Express.Multer.File },
      res: Response<
        SuccessResponse<{
          totalRecords: number;
          validRecords: number;
          invalidRecords: number;
          errors: Array<{ rowNumber: number; errors: string[] }>;
        }> | ErrorResponse
      >,
    ) => {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
          code: 'NO_FILE_UPLOADED',
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const filePath = req.file.path;
        const { transactions, errors: parseErrors } = parseAmExStatement(filePath);

        // Validate transactions
        const validationErrors = validateTransactionBatch(transactions);

        const data = {
          totalRecords: transactions.length,
          validRecords: transactions.length - validationErrors.length,
          invalidRecords: validationErrors.length,
          errors: validationErrors.map((err) => ({
            rowNumber: err.index + 1,
            errors: err.errors,
          })),
        };

        // Clean up uploaded file
        fs.unlink(filePath, (err) => {
          if (err) console.error('Failed to delete uploaded file:', err);
        });

        res.status(200).json({
          success: true,
          data,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        // Clean up uploaded file
        fs.unlink(req.file.path, (err) => {
          if (err) console.error('Failed to delete uploaded file:', err);
        });

        res.status(400).json({
          success: false,
          error: err instanceof Error ? err.message : 'Validation failed',
          code: 'VALIDATION_ERROR',
          timestamp: new Date().toISOString(),
        });
      }
    },
  );

  return router;
}
