# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack TypeScript application for importing American Express credit card statements and reconciling them with YNAB (You Need A Budget). The application parses XLSX statement files, stores transactions in SQLite, and provides REST APIs for transaction management and YNAB reconciliation.

## Development Commands

### Running the Application

```bash
# Run both backend and frontend (most common during development)
npm run dev:all

# Run backend only (dev server with hot reload)
npm run dev

# Run frontend only (requires backend running separately)
npm --prefix web run dev
```

Backend runs on http://localhost:3000, frontend on http://localhost:5173.

### Building

```bash
# Build everything (backend + frontend)
npm run build:all

# Build backend only (TypeScript -> JavaScript in dist/)
npm run build

# Build frontend only
npm --prefix web run build
```

### Testing and Linting

```bash
# Run backend tests (Mocha + Chai + Supertest)
npm test

# Run all tests (backend + frontend)
npm run test:all

# Run a single test file
npx ts-mocha spec/filename.test.ts

# Lint all code
npm run lint
```

### Docker Operations

```bash
# Start development containers
npm run docker:up

# Stop development containers
npm run docker:down

# Start production containers
npm run docker:up:prod

# Stop production containers
npm run docker:down:prod
```

### Cleanup

```bash
# Remove all build artifacts (dist/, docs/, web/dist/)
npm run clean
```

## Architecture

### High-Level Structure

```
┌─────────────────────────────────────┐
│  React Frontend (Vite)              │
│  Port: 5173                         │
│  - File upload UI                   │
│  - Transaction viewer               │
│  - Import history                   │
└────────────────┬────────────────────┘
                 │ REST API (HTTP)
┌────────────────▼────────────────────┐
│  Express Backend (TypeScript)       │
│  Port: 3000                         │
│  - Routes (/api/*)                  │
│  - Services (business logic)        │
│  - Parser (XLSX processing)         │
│  - Validator (data validation)      │
└────────────────┬────────────────────┘
                 │ better-sqlite3
┌────────────────▼────────────────────┐
│  SQLite Database                    │
│  - transactions table               │
│  - import_logs table                │
└─────────────────────────────────────┘
```

### Backend Architecture

#### Entry Point
- `src/server/index.ts` - Server initialization, loads environment, starts Express app
- `src/server/app.ts` - Express app factory with all middleware and routes

#### Routes (REST API Endpoints)
Routes are modular and mounted at `/api/*`:
- `src/server/routes/import.ts` - File upload, validation, import (`POST /api/import`, `POST /api/import/validate`)
- `src/server/routes/transactions.ts` - Transaction CRUD (`GET/DELETE /api/transactions/*`)
- `src/server/routes/history.ts` - Import history (`GET /api/import-history`)
- `src/server/routes/reconcile.ts` - YNAB reconciliation (`POST /api/reconcile`, `GET /api/reconcile/budgets`)

#### Services (Business Logic)
- `src/services/importService.ts` - Orchestrates file parsing, validation, and database insertion
- `src/services/reconciliationService.ts` - Matches card transactions against YNAB transactions
- `src/services/ynabClient.ts` - YNAB API client (budgets, accounts, transactions)

#### Core Modules
- `src/parser.ts` - XLSX parsing logic using `xlsx` library. Automatically detects headers (row 7 by default) and extracts transactions
- `src/validator.ts` - Transaction validation rules (required fields, date formats, amounts)
- `src/db.ts` - Database operations using `better-sqlite3`. Provides CRUD for transactions and import logs
- `src/schema.sql` - Database schema with indexes on reference, date, card_member

#### Type Definitions
- `src/types/index.ts` - Shared TypeScript types for transactions, YNAB data, reconciliation results
- `src/types.d.ts` - Legacy type definitions (kept for backward compatibility)

### Database Layer

Uses **better-sqlite3** (synchronous SQLite):
- Database file: `db/transactions.db` (auto-created on first run)
- Schema initialized from `src/schema.sql`
- WAL mode enabled for better concurrency
- Key functions in `src/db.ts`:
  - `initializeDatabase()` - Must be called on app startup
  - `batchInsertTransactions()` - Transactional batch insert with error handling
  - `transactionExists()` - Deduplication check using reference field
  - `getTransactions()` - Paginated query, sorted by date DESC

### YNAB Integration

Reconciliation flow:
1. Fetch card transactions from local database (filtered by date range)
2. Fetch YNAB transactions via API (using personal access token from `.env`)
3. Match transactions using flexible algorithm:
   - Date tolerance: ±2 days (configurable)
   - Amount tolerance: ±0.01 (configurable)
   - YNAB amounts in milliunits (1000 = $1.00) - automatically converted
4. Return discrepancies:
   - `missingInYnab` - Transactions on card but not in YNAB
   - `unexpectedInYnab` - Transactions in YNAB but not on card
   - `matched` - Successfully matched transactions

Personal access token required: Get from https://app.ynab.com/settings/developer and add to `.env` as `YNAB_ACCESS_TOKEN`.

### File Upload Flow

1. Client uploads XLSX via `POST /api/import`
2. Multer middleware saves file to `uploads/` with timestamp prefix
3. Parser extracts transactions from "Transaction Details" worksheet
4. Validator checks required fields and formats
5. Import service batches transactions, checks duplicates by reference field
6. Database inserts using transaction (atomic)
7. Import log created with results (total, imported, skipped, errors)
8. Uploaded file deleted after processing

### Frontend Architecture

Located in `web/` directory:
- **Framework**: React 18 + Vite 5
- **Components**: `web/src/components/` - Upload, transaction list, history viewer
- **API Client**: `web/src/api/` - Axios-based API wrapper
- **Types**: `web/src/types.ts` - Frontend-specific types

Frontend communicates with backend via REST API. CORS configured to allow localhost:5173 in development.

### Production Deployment

Production setup uses Docker Compose with two containers:
1. **Backend container**: Node.js app serving API on port 3000
2. **Frontend container**: Caddy web server serving static files on port 80

Key files:
- `docker-compose.prod.yml` - Production container orchestration
- `web/Dockerfile.prod` - Frontend production image with Caddy
- `web/Caddyfile` - Caddy configuration for serving frontend and proxying API

Caddy handles internal routing: frontend assets served at `/`, API requests proxied to backend:3000. External reverse proxy (Traefik/nginx/Caddy) routes subpath to frontend container.

## Environment Configuration

Create `.env` in root directory (see `.env.example`):
- `PORT` - Backend port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `DATABASE_PATH` - SQLite database location
- `CORS_ORIGIN` - Allowed CORS origin (frontend URL)
- `MAX_FILE_SIZE` - Upload size limit in bytes
- `YNAB_ACCESS_TOKEN` - YNAB personal access token (required for reconciliation)

## Important Notes

### Parser Assumptions
- AmEx XLSX files have "Transaction Details" worksheet
- Header row is at index 6 (row 7 in Excel)
- Reference field is unique and used for deduplication

### Database Transactions
All batch inserts use SQLite transactions for atomicity. Individual transaction failures are captured but don't roll back the entire batch.

### Error Handling
Routes use standardized response format:
- Success: `{ success: true, data: T, timestamp: string }`
- Error: `{ success: false, error: string, code: string, timestamp: string, path?: string }`

Global error handler in `src/server/app.ts` catches all errors and formats them consistently.

### Testing
Tests in `spec/` directory use ts-mocha for TypeScript support. Backend tests use Supertest for API endpoint testing. No mocking of database - tests run against real SQLite database (in-memory or test file).
