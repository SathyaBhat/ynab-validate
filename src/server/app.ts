import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import multer from 'multer';
import * as path from 'path';
import { importRoutes } from './routes/import';
import { transactionRoutes } from './routes/transactions';
import { historyRoutes } from './routes/history';
import { reconcileRoutes } from './routes/reconcile';

/**
 * Error response type
 */
interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  timestamp: string;
  path?: string;
}

/**
 * Success response type
 */
interface SuccessResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

/**
 * Create Express app with middleware and routes
 */
export function createApp(): Express {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  // Logging middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(
        `[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`,
      );
    });
    next();
  });

  // Multer configuration for file uploads
  const uploadDir = path.join(__dirname, '..', '..', 'uploads');
  const storage = multer.diskStorage({
    destination: (_req: any, _file: any, cb: any) => {
      cb(null, uploadDir);
    },
    filename: (_req: any, file: any, cb: any) => {
      const timestamp = Date.now();
      cb(null, `${timestamp}-${file.originalname}`);
    },
  });

  const upload = multer({
    storage,
    fileFilter: (_req: any, file: any, cb: any) => {
      if (!file.originalname.endsWith('.xlsx')) {
        return cb(new Error('Only XLSX files are allowed'));
      }
      cb(null, true);
    },
  });

  // Routes
  app.use('/api/import', importRoutes(upload));
  app.use('/api/transactions', transactionRoutes());
  app.use('/api/import-history', historyRoutes());
  app.use('/api/reconcile', reconcileRoutes());

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  });

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: 'Not Found',
      code: 'NOT_FOUND',
      path: req.path,
      timestamp: new Date().toISOString(),
    } as ErrorResponse);
  });

  // Global error handler
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('[ERROR]', err);

    let statusCode = 500;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';

    // Handle multer errors
    if (err instanceof multer.MulterError) {
      statusCode = 400;
      code = 'UPLOAD_ERROR';
      const multerErr = err as any;
      if (multerErr.code === 'LIMIT_FILE_SIZE') {
        message = 'File is too large';
      } else if (multerErr.code === 'FILE_TOO_LARGE') {
        message = 'File exceeds maximum size';
      } else {
        message = err.message;
      }
    } else if (err.message && err.message.includes('Only XLSX files')) {
      statusCode = 400;
      code = 'INVALID_FILE_FORMAT';
      message = err.message;
    } else if (err instanceof SyntaxError) {
      statusCode = 400;
      code = 'INVALID_JSON';
      message = 'Invalid JSON in request body';
    }

    res.status(statusCode).json({
      success: false,
      error: message,
      code,
      timestamp: new Date().toISOString(),
      path: req.path,
    } as ErrorResponse);
  });

  return app;
}

export type { ErrorResponse, SuccessResponse };
