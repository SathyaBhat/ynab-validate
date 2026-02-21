# AmEx Statement Importer

A **production-ready full-stack web application** for importing and managing American Express credit card statements. Ultimately, this will help users sync their American Express credit card statements and reconcile missing transactions with [YNAB](https://www.youneedabudget.com/).

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Installation](#installation)
- [Development](#development)
- [YNAB Reconciliation](#ynab-reconciliation)
- [API Documentation](#api-documentation)

## Features

- 📤 **Upload XLSX Statements** - Drag and drop AmEx statement files
- 🔍 **Smart Parsing** - Automatically detects headers and extracts transactions
- ✅ **Validation** - Comprehensive data validation before import
- 🔄 **Deduplication** - Prevents duplicate imports using Reference field
- 📊 **Transaction Management** - View, search, and delete transactions
- 📋 **Import History** - Complete audit trail of all imports
- 🔗 **YNAB Reconciliation** - Compare card transactions against YNAB budget
  - Identify transactions missing in YNAB
  - Detect unexpected YNAB entries
  - Flexible date and amount matching
- 🌐 **REST API** - Full API for programmatic access (8+ endpoints)
- 🐳 **Docker Ready** - Development and production containers
- 📱 **Responsive UI** - Works on desktop and mobile

## Quick Start

### 5-Minute Setup

```bash
# Clone and install
git clone <repo>
cd ynab-sync
npm install && npm --prefix web install

# Start everything
npm run dev:all
```

Open **http://localhost:5173** in your browser.

### Prerequisites

- Node.js 22+
- npm 10+
- Docker (optional, for containerization)

## Architecture

```
┌─────────────────────────────────────┐
│  React Frontend (Vite)              │
│  - Upload files                     │
│  - View transactions                │
│  - Import history                   │
└────────────────┬────────────────────┘
                 │ HTTP/REST
┌────────────────▼────────────────────┐
│  Express Backend                    │
│  - Parse XLSX                       │
│  - Validate data                    │
│  - 8 REST endpoints                 │
└────────────────┬────────────────────┘
                 │ SQL
┌────────────────▼────────────────────┐
│  SQLite Database                    │
│  - Transactions                     │
│  - Import logs                      │
└─────────────────────────────────────┘
```

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Backend | Express.js 5 + TypeScript 4.9 |
| Frontend | React 18 + Vite 5 |
| Database | SQLite 3 |
| Testing | Mocha + Chai + Supertest |
| Deployment | Docker + Docker Compose |

## Installation

### Clone Repository

```bash
git clone <repo>
cd ynab-sync
```

### Install Dependencies

```bash
# Backend
npm install

# Frontend
npm --prefix web install
```

### Configuration

Create `.env` file in root directory:

```env
PORT=3000
NODE_ENV=development
DATABASE_PATH=db/transactions.db
CORS_ORIGIN=http://localhost:5173
MAX_FILE_SIZE=10485760
```

See [.env.example](.env.example) for all options.

## Development

### Run Everything Together

```bash
npm run dev:all
```

- **Backend API:** http://localhost:3000
- **Frontend UI:** http://localhost:5173

### Run Backend Only

```bash
npm run dev
```

API Server: http://localhost:3000  
Health Check: http://localhost:3000/health

### Run Frontend Only

```bash
npm --prefix web run dev
```

Vite Server: http://localhost:5173  
Requires backend running on port 3000

### Build for Production

```bash
# Build everything
npm run build:all

# Or individually:
npm run build              # Backend
npm --prefix web run build # Frontend
```

### Available Commands

```bash
# Development
npm run dev:all           # Run both backend & frontend
npm run dev               # Backend only
npm --prefix web run dev  # Frontend only

# Building
npm run build:all         # Build both
npm run build             # Backend
npm --prefix web run build # Frontend

# Testing
npm test                  # Backend tests only
npm run test:all          # All tests

# Code Quality
npm run lint              # ESLint check

# Cleanup
npm run clean             # Remove build artifacts

# Docker
npm run docker:up         # Dev containers
npm run docker:up:prod    # Production containers
```

### Home Server Deployment

For deployment behind a reverse proxy (Traefik, Caddy, nginx) at a subpath:

1. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env with production values:
   # PORT=3000
   # NODE_ENV=production
   # DATABASE_PATH=/app/db/transactions.db
   # CORS_ORIGIN=https://your-domain.com
   ```

2. **Build and start:**
   ```bash
   docker-compose -f docker-compose.prod.yml build
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **Configure reverse proxy to route `/amex-sync/*` to frontend container**

**Key considerations:**
- Frontend served on port 80 through Caddy (not nginx)
- Backend exposed internally on port 3000
- Database and uploads use persistent Docker volumes
- All containers on internal Docker network
- HTTPS handled by external reverse proxy

See [HOMESERVER_SETUP.md](HOMESERVER_SETUP.md) for detailed instructions with Traefik/Caddy/nginx examples.

## YNAB Reconciliation

Compare your American Express card statement against your YNAB budget to identify discrepancies:

### Features
- Identify transactions on the card statement but missing in YNAB
- Detect transactions in YNAB but missing from the card statement
- Flexible matching with configurable date/amount tolerance
- Automatic conversion of YNAB "milliunits" to currency

### Quick Setup
1. Get your YNAB personal access token from [Settings > Developer](https://app.ynab.com/settings/developer)
2. Add to `.env`: `YNAB_ACCESS_TOKEN=your_token_here`
3. Use the reconciliation endpoints

### API Example
```bash
curl -X POST http://localhost:3000/api/reconcile \
  -H "Content-Type: application/json" \
  -d '{
    "budgetId": "your-budget-id",
    "startDate": "2024-01-01",
    "endDate": "2024-01-31"
  }'
```

For detailed documentation, see [YNAB_RECONCILIATION.md](YNAB_RECONCILIATION.md).

## Project Structure

```
src/                  # Backend (Express + TypeScript)
├── server/          # Express API routes
├── services/        # Business logic
├── types/           # TypeScript interfaces (shared)
├── db.ts            # Database operations
├── parser.ts        # XLSX parsing
├── validator.ts     # Data validation
└── schema.sql       # Database schema

web/                 # Frontend (React + Vite)
├── src/
│   ├── components/  # React components
│   ├── api/        # API client
│   └── types.ts    # Frontend types
├── Dockerfile      # Dev image
├── Dockerfile.prod # Production image
└── Caddyfile       # Web server config

spec/               # Backend tests (50 tests)
uploads/            # Temporary uploads (auto-created)
db/                 # SQLite database (auto-created)
dist/               # Compiled backend (auto-created)
web/dist/           # Built frontend (auto-created)
```

## API Endpoints

### Import & Transactions
- `POST /api/import` - Upload and import XLSX file
- `POST /api/import/validate` - Validate file without importing
- `GET /api/transactions` - List transactions (paginated)
- `GET /api/transactions/:reference` - Get transaction by reference
- `GET /api/transactions/id/:id` - Get transaction by ID
- `DELETE /api/transactions/:id` - Delete transaction
- `GET /api/import-history` - View import history

### YNAB Reconciliation
- `POST /api/reconcile` - Reconcile card vs YNAB transactions
- `GET /api/reconcile/budgets` - Get available YNAB budgets

### Health
- `GET /health` - Server health check

See [YNAB_RECONCILIATION.md](YNAB_RECONCILIATION.md) for reconciliation API details.

## Roadmap

### Completed ✅
- Phase 1: Database schema & XLSX parser
- Phase 2: Import service with validation
- Phase 3: REST API with 8 endpoints
- Phase 4: React frontend with 4 components
- Phase 5: Docker & deployment config
- Phase 6: YNAB reconciliation with matching algorithm

### Future 🚀
- Advanced filtering & search
- Reconciliation UI component
- Persist reconciliation results
- Kubernetes support

## Contributing

Feel free to:
- Report bugs via GitHub issues
- Suggest features
- Submit pull requests
- Improve documentation

## License

MIT - See [LICENSE](LICENSE) for details

## Author

**Sathyajith Bhat**  
📧 sathya@sathyasays.com  
🔗 https://github.com/SathyaBhat

Made with using Node.js, React, TypeScript, and AmpCode.
