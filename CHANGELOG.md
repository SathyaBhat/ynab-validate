# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Increased reconciliation date tolerance from ±2 days to ±7 days to better handle posting date differences between AmEx and YNAB
- Expanded YNAB transaction query window by `dateTolerance` days on both ends so transactions near date range boundaries are not missed during matching
- Reduced false positives in "Unexpected in YNAB" by scoping it to the original date range (buffer zone transactions used for matching only) and excluding already-reconciled transactions

### Added
- Account filtering for YNAB reconciliation to prevent false "unexpected" transactions
  - Added `account_id` field to `YnabTransaction` type
  - Added `accountId` parameter (required) to reconciliation API endpoint
  - Added 5 comprehensive tests for account filtering
  - API now requires `accountId` in POST /api/reconcile requests
- Makefile for Docker image versioning and publishing
  - Auto-incrementing semantic versions (MAJOR.MINOR.PATCH)
  - Version files: `.version-backend` and `.version-web`
  - Commands: `make release`, `make build`, `make push`
  - Error handling with automatic version rollback on build failure
  - Colorized output using printf for cross-shell compatibility
- Query parameter utility functions for type-safe Express parameter handling
  - `getQueryString()`: Extract string from query/path parameters
  - `getQueryInt()`: Parse integers with min/max validation
  - Handles Express ParsedQs type (string | string[] | object | undefined)
- Comprehensive documentation files:
  - `DOCKER_RELEASE.md`: Complete Docker publishing guide
  - `MAKEFILE_QUICKSTART.md`: Quick reference for Makefile commands
  - `MAKEFILE_ERROR_HANDLING.md`: Error handling and recovery guide
  - `ACCOUNT_FILTERING_FIX.md`: Account filtering implementation details

### Fixed
- **CRITICAL**: Reconciliation sign matching bug
  - Card transactions stored as positive amounts (e.g., $30.00)
  - YNAB expenses stored as negative amounts (e.g., -$30.00)
  - Matching now compares absolute values: `|30.00| - |-30.00| = 0`
  - Added 8 comprehensive tests for sign handling including real examples (Coles, Bunnings)
  - Tests: Sign handling for expenses, refunds, mixed types, tolerance with opposite signs
- **CRITICAL**: Account filtering in reconciliation
  - Previously compared against ALL accounts in budget (checking, savings, other cards)
  - Now filters to only the specified account ID
  - Eliminates false positives in "unexpected in YNAB" results
  - Example: Feb 2026 reconciliation now shows 12 matched instead of 11 false "unexpected"
- TypeScript compilation errors in route handlers
  - Fixed 7 type errors related to Express query parameter types
  - Created utility functions to handle `string | string[] | ParsedQs` types safely
  - Updated routes: history.ts, reconcile.ts, transactions.ts
- Makefile error handling
  - Build failures now automatically revert version increments
  - Push commands validate image existence before attempting push
  - Clear error messages with recovery instructions
  - Prevents broken Docker tags and version inconsistencies
- Makefile color output
  - Replaced `echo` with `printf` for POSIX compliance
  - Colors now display correctly in zsh, bash, and sh
  - Added `.make-alias` helper for shells with echo conflicts

### Changed
- **BREAKING**: Reconciliation API now requires `accountId` parameter
  - Old: `POST /api/reconcile { budgetId, startDate, endDate }`
  - New: `POST /api/reconcile { budgetId, accountId, startDate, endDate }`
  - ✅ Frontend updated to pass selected account ID
- YnabClient.getTransactionsByDateRange() now accepts optional `accountId` parameter
- ReconciliationService.reconcile() signature updated to require `accountId`
- ReconciliationService.reconcileAndPersist() signature updated to require `accountId`
- All YNAB transaction mappings now include `account_id` field
- Frontend types updated:
  - `ReconciliationParams` now includes required `accountId` field
  - `YnabTransaction` now includes `account_id` field
- ReconciliationPanel component updated to pass `accountId` in API calls
- Validation updated to require account selection before reconciliation

### Technical Details

#### Reconciliation Sign Matching Fix
```typescript
// Before: Compared raw values
const amountDiff = Math.abs(cardAmount - ynabAmount);
// Card: 30, YNAB: -30 → diff = 60 ❌

// After: Compare absolute values
const amountDiff = Math.abs(Math.abs(cardAmount) - Math.abs(ynabAmount));
// Card: 30, YNAB: -30 → diff = 0 ✅
```

#### Account Filtering Implementation
```typescript
// Before: Fetched all accounts
GET /budgets/{budgetId}/transactions

// After: Filter to specific account
transactions.filter(txn => txn.account_id === accountId)
```

#### Makefile Error Handling
```bash
# Build failure detection
if docker build -t image:version . ; then
  echo "Success"
else
  echo "Build failed - reverting version"
  # Decrement version back
  exit 1
fi
```

### Test Coverage
- Total tests: 83 (was 78)
- New tests added:
  - 8 tests for reconciliation sign handling
  - 5 tests for account filtering
- All tests passing ✅
- TypeScript build successful ✅

### Files Modified

Backend:
- `src/types/index.ts`: Added `account_id` to YnabTransaction
- `src/services/ynabClient.ts`: Account filtering, account_id capture
- `src/services/reconciliationService.ts`: Sign matching fix, account parameter
- `src/server/routes/reconcile.ts`: accountId validation
- `src/server/routes/history.ts`: Query parameter type fixes
- `src/server/routes/transactions.ts`: Query parameter type fixes
- `src/server/utils/queryParams.ts`: New utility file
- `spec/reconciliation.test.ts`: Added 13 new tests

Frontend:
- `web/src/types.ts`: Added `accountId` to ReconciliationParams, `account_id` to YnabTransaction
- `web/src/components/ReconciliationPanel.tsx`: Pass accountId to API, updated validation

Build System:
- `Makefile`: New build automation system
- `.version-backend`, `.version-web`: Version tracking files
- `.dockerignore`: Exclude build artifacts
- `.gitignore`: Ignore .make-alias helper

### Migration Notes

#### For API Consumers (Frontend)
✅ **Frontend already updated** - No manual migration needed!

The ReconciliationPanel component now automatically:
- Passes `accountId` to the reconciliation API
- Validates that an account is selected before allowing reconciliation
- Disables the "Run Reconciliation" button until account is selected

If you're using the API directly:
```typescript
// Update reconciliation API calls to include accountId
const response = await fetch('/api/reconcile', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    budgetId: selectedBudget,
    accountId: selectedAccount,  // ← REQUIRED
    startDate: '2026-02-01',
    endDate: '2026-02-28',
  })
});
```

#### For Docker Builds
```bash
# Use new Makefile commands
make build-backend   # Build with version increment
make push-backend    # Push to Docker Hub
make release-backend # Build + test + push

# Or build both
make release        # Full release workflow
```

## [0.0.2] - 2025-01-XX

### Added
- Initial YNAB reconciliation support
- Transaction matching with date/amount tolerance
- Reconciliation persistence
- Reconciliation history logs

### Changed
- Database schema for reconciliation tracking

---

## Version History

- **Backend**: Currently at v0.0.2
- **Web**: Currently at v0.0.5
- Images: `sathyabhat/amex-sync-backend`, `sathyabhat/amex-sync-web`
