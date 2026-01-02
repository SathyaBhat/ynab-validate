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
- [ ] Add Express.js to dependencies
- [ ] Create `src/server/` directory structure
  - [ ] `src/server/app.ts` - Express app initialization
  - [ ] `src/server/middleware/` - CORS, logging, error handling
  - [ ] `src/server/routes/` - API route handlers

### 3.2 API Endpoints (REST)
- [ ] `POST /api/import` - Upload and import XLSX file
  - [ ] Multipart form data handling
  - [ ] File validation (XLSX only, file size limits)
  - [ ] Return import results with status
- [ ] `GET /api/transactions` - List transactions with pagination
  - [ ] Query parameters: limit, offset, sort, filter
  - [ ] Return paginated JSON response
- [ ] `GET /api/transactions/:id` - Get single transaction
- [ ] `GET /api/import-history` - View previous imports
  - [ ] Timestamp, file name, record count, status
- [ ] `DELETE /api/transactions/:id` - Delete transaction (if needed)
- [ ] `POST /api/import/validate` - Validate file before importing (optional)

### 3.3 Error Handling & Responses
- [ ] Standardized error response format
  - [ ] HTTP status codes (400, 409 for duplicates, 500)
  - [ ] Error messages and codes for debugging
- [ ] Request/response logging
- [ ] Input validation middleware

### 3.4 Authentication (Optional - Phase 2 consideration)
- [ ] Placeholder for future authentication layer

---

## Phase 4: Frontend Scaffold (Backend-Ready)

### 4.1 Project Structure
- [ ] Create `web/` directory for frontend
- [ ] Prepare for React/Vue/Svelte integration (backend first)
- [ ] API client library stub

---

## Phase 5: Build & Deployment Updates

### 5.1 Build Configuration
- [ ] Update `tsconfig.json` if needed (server-side TS)
- [ ] Update npm scripts in package.json
  - [ ] `npm run dev` - Run dev server with nodemon
  - [ ] `npm run build` - Build backend
  - [ ] `npm run start` - Run compiled server
  - [ ] Keep `npm test`, `npm run lint`

### 5.2 Environment Configuration
- [ ] Update `.env.example` with:
  - [ ] `DATABASE_PATH` - SQLite database file location
  - [ ] `PORT` - Server port (default 3000)
  - [ ] `NODE_ENV` - Development/production
- [ ] Update `.gitignore` for database files and temp uploads

### 5.3 Docker & Deployment
- [ ] Update Dockerfile for backend server

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
