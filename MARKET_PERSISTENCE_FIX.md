# Market Persistence Fix

## Problem
Admin-created markets were not persisting after backend restart. This was because markets were stored in an in-memory `Map` that gets destroyed every time the backend server restarts.

## Root Cause
- **File**: `packages/backend/src/services/marketsStore.ts`
- **Issue**: The `MarketsStore` class used only an in-memory `Map<string, Market>` with no persistence mechanism
- **Result**: All created markets were lost when the backend was restarted

## Solution Implemented
Added **file-based persistence** using JSON storage:

### Changes Made

1. **Updated `packages/backend/src/services/marketsStore.ts`**:
   - Added imports for `fs` and `path` modules
   - Added `storePath` property pointing to `.data/markets.json`
   - Implemented `loadFromFile()` - loads markets from JSON file on startup
   - Implemented `saveToFile()` - persists markets to JSON file after any modification
   - Modified all methods to call `loadFromFile()` before operations (lazy loading)
   - Markets are now saved to disk after every add/update/delete operation

2. **Updated `.gitignore`**:
   - Added `.data/` to prevent checking in local market data files

### How It Works

1. **On Startup**: When `getMarketsStore()` is called, the store checks if a `markets.json` file exists in `.data/` directory
2. **On Add/Update/Delete**: After any modification, markets are immediately written to `markets.json`
3. **On Server Restart**: The store automatically loads all previously created markets from the JSON file

### Data Location
- Storage file: `.data/markets.json`
- Directory is created automatically if it doesn't exist
- File is in `.gitignore` so local market data won't be committed

### Testing
To verify the fix works:

1. **Start the backend**:
   ```bash
   cd packages/backend
   npm run dev
   ```

2. **Create a market** (via admin endpoint or example script):
   ```bash
   npx ts-node examples/createMarket.ts
   ```

3. **Check that market appears in UI**:
   - Frontend fetches from `GET /api/markets`
   - Market should be displayed

4. **Verify persistence**:
   - Stop the backend (Ctrl+C)
   - Check `.data/markets.json` exists with the market data
   - Restart backend
   - Fetch `/api/markets` again
   - Market should still be there ✓

### Future Improvements
- Replace JSON file storage with a proper database (PostgreSQL, MongoDB, etc.)
- Add backup/export functionality for markets
- Implement market versioning/audit trail
- Add data validation on load

## Files Modified
- [packages/backend/src/services/marketsStore.ts](packages/backend/src/services/marketsStore.ts)
- [.gitignore](.gitignore)
