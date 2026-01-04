import { createApp } from './app';
import { initializeDatabase } from '../db';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);
const DATABASE_PATH = process.env.DATABASE_PATH || 'db/transactions.db';
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

/**
 * Start the server
 */
export async function startServer(): Promise<void> {
  try {
    // Ensure uploads directory exists
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    // Initialize database
    console.log(`Initializing database at ${DATABASE_PATH}`);
    initializeDatabase(DATABASE_PATH);

    // Create Express app
    const app = createApp();

    // Start listening
    app.listen(PORT, () => {
      console.log(`
╔═════════════════════════════════════════╗
║   AmEx Statement Importer API Server    ║
╚═════════════════════════════════════════╝

✓ Server running on http://localhost:${PORT}
✓ Database: ${DATABASE_PATH}
✓ Uploads: ${UPLOADS_DIR}

Endpoints:
  POST   /api/import               - Import XLSX statement
  POST   /api/import/validate      - Validate XLSX file
  GET    /api/transactions         - List transactions
  GET    /api/transactions/:ref    - Get by reference
  GET    /api/transactions/id/:id  - Get by ID
  DELETE /api/transactions/:id     - Delete transaction
  GET    /api/import-history       - View import history
  GET    /health                   - Health check
`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}
