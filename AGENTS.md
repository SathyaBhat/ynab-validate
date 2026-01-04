# AGENTS.md

## Build, Lint, and Test Commands

### Backend
- **Build**: `npm run build` (TypeScript compilation to dist/)
- **Lint**: `npm run lint` (ESLint check)
- **Test**: `npm test` (run ts-mocha tests from spec/)
- **Single test**: `npx ts-mocha spec/test-file.ts`
- **Clean**: `npm run clean` (remove dist, out, docs directories)
- **Docs**: `npm run docs` (generate TypeDoc documentation)

### Frontend
- **Build**: `npm --prefix web run build` (Vite build to web/dist/)
- **Dev**: `npm --prefix web run dev` (Vite dev server on port 5173)
- **Lint**: `npm run lint` (runs both backend and frontend linting)

### Combined
- **Build All**: `npm run build:all` (build backend and frontend)
- **Dev All**: `npm run dev:all` (run backend + frontend concurrently)
- **Test All**: `npm run test:all` (run backend tests and frontend tests)

### Docker
- **Dev**: `npm run docker:up` (docker-compose up)
- **Prod**: `npm run docker:up:prod` (docker-compose -f docker-compose.prod.yml up)

## Architecture and Structure

**Project**: amex-sync - Full-stack web application for importing American Express credit card statements

**Key modules**:

### Backend (Express API)
- `src/server/index.ts` - Express app initialization and routes
- `src/server/app.ts` - Express app creation and middleware
- `src/server/routes/` - API route handlers
- `src/db.ts` - Database operations (SQLite with better-sqlite3)
- `src/parser.ts` - XLSX parsing and data extraction
- `src/validator.ts` - Transaction data validation
- `src/services/importService.ts` - Import workflow orchestration
- `src/schema.sql` - SQLite database schema

### Frontend (React + Vite)
- `web/src/components/` - React components (FileUpload, TransactionList, ImportHistory, Header)
- `web/src/api/client.ts` - Axios API client
- `web/src/types.ts` - Frontend TypeScript types
- `web/src/App.tsx` - Main React app
- `web/vite.config.ts` - Vite configuration with base path `/amex-sync/`
- `web/Caddyfile` - Caddy web server configuration

### Deployment
- `Dockerfile` - Backend production image
- `web/Dockerfile.prod` - Frontend production image (Node builder + Caddy)
- `docker-compose.yml` - Development environment
- `docker-compose.prod.yml` - Production environment with dokploy-network

### Testing
- `spec/` - Backend test files (50 passing tests)

**Dependencies**: 
- Backend: Express 5, better-sqlite3, xlsx, multer, cors, dotenv, axios
- Frontend: React 18, Vite 5, Axios, React Router (implicit)
- DevDeps: TypeScript, ESLint, @typescript-eslint, ts-node, ts-mocha, Prettier, concurrently

**Database**: SQLite 3 (better-sqlite3)
- File-based: `db/transactions.db`
- Two main tables: `transactions`, `import_logs`
- Auto-created on startup

## Code Style Guidelines

- **Language**: TypeScript (strict mode enabled)
- **Module format**: CommonJS (Node.js native with ESM interop via tsx)
- **Formatting**: Prettier (120 char line width, arrow parens always, LF line endings)
- **Linting**: ESLint with @typescript-eslint
- **Imports**: Named imports from modules; relative imports for local files
- **Naming**: camelCase for functions/variables, PascalCase for classes/types/interfaces
- **Types**: Strict type checking enabled
  - Backend types: `src/types/index.ts` and `src/types.d.ts` (shared)
  - Frontend types: `web/src/types.ts`
  - Database models use snake_case columns, transform to camelCase in client code
- **Error handling**: Use async/await with standardized error responses
- **API Responses**: All endpoints return `{ success, data, timestamp, error?, code? }` format

## Directory Structure

```
src/                          # Backend
├── server/                   # Express API
│   ├── index.ts             # Entry point, server startup
│   ├── app.ts               # Express app config
│   └── routes/              # Route handlers
├── services/                # Business logic
│   └── importService.ts     # Import workflow
├── db.ts                    # Database operations
├── parser.ts                # XLSX parsing
├── validator.ts             # Data validation
├── types/                   # Type definitions
│   └── index.ts
├── schema.sql               # Database schema
└── types.d.ts              # Global types

web/                          # Frontend (React + Vite)
├── src/
│   ├── components/          # React components
│   ├── api/                 # Axios client
│   ├── types.ts             # Frontend types
│   ├── App.tsx              # Main component
│   └── main.tsx             # Entry point
├── Dockerfile               # Dev image
├── Dockerfile.prod          # Production image (Caddy)
├── Caddyfile                # Caddy configuration
├── vite.config.ts           # Vite config (base: '/amex-sync/')
├── tsconfig.json
├── package.json
└── index.html               # HTML entry point

spec/                         # Backend tests (50 tests)
db/                          # SQLite database (auto-created)
uploads/                     # Temporary uploads (auto-cleaned)
dist/                        # Compiled backend (auto-created)
web/dist/                    # Built frontend (auto-created)

Docker & Deployment
├── Dockerfile               # Backend production build
├── docker-compose.yml       # Development orchestration
├── docker-compose.prod.yml  # Production with dokploy-network
└── .env.example             # Environment template
```

## Key Endpoints

### Health & Metadata
- `GET /health` - Server health check
- `GET /api/import-history` - View all imports with pagination

### File Operations
- `POST /api/import` - Upload and import XLSX file
- `POST /api/import/validate` - Validate XLSX without importing

### Transactions
- `GET /api/transactions` - List with pagination (limit/offset)
- `GET /api/transactions/:reference` - Get by reference
- `GET /api/transactions/id/:id` - Get by ID
- `DELETE /api/transactions/:id` - Delete transaction

## Frontend Components

- **Header** - Server connection status indicator
- **FileUpload** - XLSX file upload with validation preview
- **TransactionList** - Paginated transaction table with delete
- **ImportHistory** - Import audit log with timestamps

## Environment Variables

```env
# Backend
PORT=3000
NODE_ENV=development|production
DATABASE_PATH=db/transactions.db
CORS_ORIGIN=http://localhost:5173
MAX_FILE_SIZE=10485760

# Frontend (build-time, via VITE_ prefix)
VITE_API_URL=/amex-sync (for production subpath)
```

## Deployment

### Development
```bash
npm run dev:all              # Run backend + frontend
docker-compose up           # Run in Docker
```

### Production
```bash
docker-compose -f docker-compose.prod.yml up -d

# Key setup:
# - Frontend on port 80 (Caddy)
# - Backend on internal port 3000
# - Both on dokploy-network
# - Reverse proxy (Traefik/Caddy/nginx) routes to frontend
# - HTTPS handled externally
```

For home server deployment at `/amex-sync/` subpath:
- Vite built with `base: '/amex-sync/'`
- Caddy strips prefix for API calls
- API baseURL set to `/amex-sync`
- CORS_ORIGIN set to production domain

## Testing

- **Backend**: 50 tests covering database, parsing, validation, import workflow, API endpoints
- **Command**: `npm test` or `npm run test:all`
- **Coverage**: Database ops, XLSX parsing, validation, REST API, error handling

## Notes for Agents

### When Building
- Both backend and frontend must compile without errors
- Frontend requires `VITE_API_URL` build arg for production
- Backend schema.sql must be copied to production image at `./src/`

### When Deploying
- Ensure `docker-compose.prod.yml` targets `dokploy-network` (external network)
- Frontend Caddyfile handles subpath routing and API proxying
- Backend CORS_ORIGIN must match production domain
- Database persists across container restarts via named volume

### Database Transformations
- Database columns use snake_case: `card_member`, `import_timestamp`, `error_count`
- API and frontend expect camelCase: `cardMember`, `importTimestamp`, `errorCount`
- Transformation happens in `src/db.ts` via `transformTransactionRow()` helper

### Frontend Dates
- Use `toLocaleDateString('en-GB')` for DD/MM/YYYY format
- Import timestamps handled by frontend components

### API Response Format
All responses include:
```typescript
{
  success: boolean;
  data?: any;
  error?: string;
  code?: string;
  timestamp: string;
}
```

Error codes: `NO_FILE_UPLOADED`, `INVALID_FILE_FORMAT`, `VALIDATION_ERROR`, `NOT_FOUND`, etc.
