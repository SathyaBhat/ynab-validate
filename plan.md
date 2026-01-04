# AmEx Statement Importer - Implementation Plan

## Phase 1: Infrastructure & Database Setup

### 1.1 Database Schema & Type Definitions
- [x] Create SQLite database schema for transactions
  - [x] Analyze activity.xlsx structure to identify all fields
  - [x] Design `transactions` table with columns matching AmEx statement fields
  - [x] Add `id` (primary key), `reference` (unique for deduplication), `created_at`, `updated_at`
  - [x] Create import_logs table for tracking imports
- [x] Update `src/types.d.ts` with TypeScript interfaces for AmEx transactions
  - [x] Define `AmExTransaction` interface with strict typing
  - [x] Define database row type for SQLite integration
  - [x] Define `ImportLog`, `ImportResult`, `ImportError` types

### 1.2 SQLite Integration
- [x] Add SQLite dependencies to package.json
  - [x] `better-sqlite3` (selected for synchronous, fast performance)
  - [x] `@types/better-sqlite3` for TypeScript support
- [x] Create `src/db.ts` module
  - [x] Database initialization function with WAL mode
  - [x] Helper functions for CRUD operations
  - [x] Transaction support for batch imports
  - [x] Import log tracking functions

### 1.3 XLSX Parser Implementation
- [x] Add XLSX parsing library to package.json
  - [x] `xlsx` library installed and working
- [x] Create `src/parser.ts`
  - [x] Dynamic header row detection (currently row 7, flexible for changes)
  - [x] Parse "Transaction Details" worksheet specifically
  - [x] Convert Excel date formats to JavaScript Date objects
  - [x] Handle all AmEx-specific fields (dates, amounts, descriptions, reference numbers)
  - [x] Type-safe parsing with proper error messages

---

## Phase 2: Data Import Logic

### 2.1 Data Validation
- [x] Create `src/validator.ts`
  - [x] Validate required fields
  - [x] Date format validation (ISO 8601)
  - [x] Amount format validation (allows negative for credits)
  - [x] Reference field validation (alphanumeric)
  - [x] Batch validation function
  - [x] Return detailed validation errors per row

### 2.2 Deduplication Strategy
- [x] Deduplication logic integrated into import service
  - [x] Use "Reference" field as unique identifier
  - [x] Check existing database before inserting
  - [x] Return count of new vs. skipped records
  - [x] Log duplicate references for audit trail

### 2.3 Import Service
- [x] Create `src/services/importService.ts`
  - [x] `importAmExStatementSync(filePath: string)` function
  - [x] Type-safe parsing with validation errors
  - [x] Deduplication check before batch insert
  - [x] Batch insert with transaction support
  - [x] Return import results (success count, errors, duplicates)
  - [x] Error recovery for partial imports
  - [x] Automatic import log creation
  - [x] Async version (`importAmExStatement`) also provided
  - [x] Dry-run mode for validation without insertion

### 2.4 Tests
- [x] Create `spec/importService.test.ts` with 12 tests
  - [x] Successful import
  - [x] Duplicate detection
  - [x] Dry-run mode
  - [x] Error handling (missing files, invalid formats)
  - [x] Deduplication skip option
  - [x] Validation skip option
  - [x] Negative amounts support
  - [x] Empty country field support

---

## Phase 3: Backend API Setup

### 3.1 Web Framework & Server
- [x] Add Express.js to dependencies
- [x] Create `src/server/` directory structure
  - [x] `src/server/app.ts` - Express app initialization with middleware
  - [x] `src/server/index.ts` - Server entry point
  - [x] `src/server/routes/` - API route handlers (import, transactions, history)

### 3.2 API Endpoints (REST)
- [x] `POST /api/import` - Upload and import XLSX file
  - [x] Multipart form data handling with multer
  - [x] File validation (XLSX only)
  - [x] Return import results with full status details
- [x] `POST /api/import/validate` - Validate file before importing
  - [x] Returns validation results without database changes
- [x] `GET /api/transactions` - List transactions with pagination
  - [x] Query parameters: limit (max 500), offset
  - [x] Return paginated JSON with total count
- [x] `GET /api/transactions/:reference` - Get transaction by reference
- [x] `GET /api/transactions/id/:id` - Get transaction by ID
- [x] `DELETE /api/transactions/:id` - Delete transaction by ID
- [x] `GET /api/import-history` - View import history with pagination
- [x] `GET /health` - Health check endpoint

### 3.3 Error Handling & Responses
- [x] Standardized response format (success/error with timestamp)
- [x] Error response includes: error message, error code, path, timestamp
- [x] HTTP status codes (200, 207 partial, 400, 404, 500)
- [x] Request/response logging middleware
- [x] Multer error handling (file uploads)
- [x] Global error handler for uncaught exceptions

### 3.4 Environment Configuration
- [x] Create `.env.example` with all configuration variables
- [x] Support for: PORT, NODE_ENV, DATABASE_PATH, CORS_ORIGIN, MAX_FILE_SIZE

### 3.5 Tests
- [x] Create `spec/server.test.ts` with 25+ integration tests
  - [x] Health check endpoint
  - [x] File upload and import
  - [x] File validation
  - [x] Transaction listing and pagination
  - [x] Transaction retrieval
  - [x] Import history
  - [x] Transaction deletion
  - [x] Error handling (404, 400, 500)
  - [x] Response format consistency

### 3.6 npm Scripts
- [x] `npm run start` - Run production server
- [x] `npm run dev` - Run development server with ts-node

---

## Phase 4: Frontend Scaffold (Backend-Ready)

### 4.1 Project Structure
- [x] Create `web/` directory for frontend
- [x] Prepare for React/Vue/Svelte integration (backend first)
- [x] API client library stub

### 4.2 React Frontend (Complete)
- [x] Create React 18 + TypeScript + Vite project
- [x] API client with axios (`src/api/client.ts`)
- [x] Type-safe interfaces (`src/types.ts`)
- [x] Components:
  - [x] Header.tsx - Server health check
  - [x] FileUpload.tsx - XLSX upload with validation
  - [x] TransactionList.tsx - Paginated transaction table
  - [x] ImportHistory.tsx - Import operation history
- [x] Responsive CSS styling
- [x] Production build

---

## Phase 5: Build & Deployment Updates

### 5.1 Build Configuration
- [x] Update `tsconfig.json` if needed (server-side TS)
- [x] Update npm scripts in package.json
  - [x] `npm run dev` - Run backend server with ts-node
  - [x] `npm run dev:all` - Run both backend and frontend with concurrently
  - [x] `npm run build` - Build backend
  - [x] `npm run build:all` - Build backend and frontend
  - [x] `npm run start` - Run compiled server
  - [x] `npm test`, `npm run lint` available

### 5.2 Environment Configuration
- [x] `.env.example` has all required variables:
  - [x] `DATABASE_PATH` - SQLite database file location
  - [x] `PORT` - Server port (default 3000)
  - [x] `NODE_ENV` - Development/production
- [x] `.gitignore` updated for database files and temp uploads

### 5.3 Docker & Deployment
- [x] Multi-stage Dockerfile for backend (optimized production)
- [x] Dockerfile for frontend dev mode
- [x] Dockerfile.prod for frontend with nginx (production)
- [x] docker-compose.yml for local development
- [x] docker-compose.prod.yml for production with volumes and health checks
- [x] nginx.conf for frontend reverse proxy and API routing

---

## Implementation Priorities

**Immediate (Phase 1 + 2):**
1. Database schema and SQLite setup
2. XLSX parser for AmEx format
3. Import service with deduplication
4. Basic validation

**Next (Phase 3):**
1. Express server setup
2. POST /api/import endpoint
3. GET /api/transactions endpoint
4. Error handling

**Future:**
- Frontend development
- Authentication
- Advanced filtering/reporting
- Bulk operations
- YNAB integration (from original tool)

---

## Technical Decisions to Confirm

- [ ] SQLite vs. PostgreSQL (SQLite for simplicity, portable)
- [ ] XLSX library choice (`xlsx` - widely used, feature-rich)
- [ ] Database driver (better-sqlite3 vs sqlite3 for async)
- [ ] Multer for file uploads in Express
- [ ] Database initialization (migrations or schema setup script)
- [ ] Logging library (Winston, Pino, or native console)

---

## Testing Strategy

- [ ] Unit tests for parsers and validators
- [ ] Integration tests for import service
- [ ] API endpoint tests (supertest)
- [ ] Fixture data: sample activity.xlsx and edge cases
