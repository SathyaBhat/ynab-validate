# AGENTS.md

## Build, Lint, and Test Commands

- **Build**: `npm run build` (TypeScript compilation to dist/)
- **Lint**: `npm run lint` (ESLint check)
- **Test**: `npm test` (run ts-mocha tests from spec/)
- **Single test**: `npx ts-mocha spec/test-file.ts` (replace test-file with specific test)
- **Clean**: `npm run clean` (remove dist, out, docs directories)
- **Docs**: `npm run docs` (generate TypeDoc documentation)

## Architecture and Structure

**Project**: ynab-validate - TypeScript tool that validates credit card transactions against YNAB

**Key modules**:
- `src/index.ts` - Main entry point, transaction comparison logic
- `src/parse.ts` - Parses credit card statement (CSV)
- `src/ynab.ts` - YNAB API wrapper
- `src/types.d.ts` - Type definitions (ExpenseEntry, YnabExpenseEntry)

**Dependencies**: YNAB API client, commander (CLI), csv-parser, chalk (colors), dotenv, moment

**Database**: None (uses YNAB API and local CSV)

## Code Style Guidelines

- **Language**: TypeScript (strict mode enabled)
- **Module format**: CommonJS with ESM interop
- **Formatting**: Prettier (120 char line width, arrow parens always, LF line endings)
- **Linting**: ESLint with @typescript-eslint
- **Imports**: Named imports from modules; relative imports for local files
- **Naming**: camelCase for functions/variables, PascalCase for classes/types
- **Types**: Strict type checking enabled; define interfaces in types.d.ts for shared types
- **Error handling**: Use async/await; no error handling utility specified
