# Admin Resolution Debug Guide

## Issue: No Markets Appearing in Resolution Dropdown

If no markets are appearing in the market selection dropdown on `/admin/resolution`, follow these steps to debug:

### Step 1: Check Backend Market Storage
Run this command to see what markets are currently stored:

```bash
curl -s "http://localhost:3001/api/admin/debug/markets" | python3 -m json.tool
```

**Expected Response (if markets exist):**
```json
{
  "success": true,
  "marketCount": 2,
  "markets": [
    {
      "id": "0x...",
      "question": "Will BTC hit $150K?",
      "category": "Crypto",
      "conditionId": "0x...",
      "resolved": false
    }
  ]
}
```

### Step 2: Check Markets API Endpoint
```bash
curl -s "http://localhost:3001/api/markets" | python3 -m json.tool
```

**Expected Response:**
```json
{
  "success": true,
  "markets": [
    {
      "id": "0x...",
      "question": "Will BTC hit $150K?",
      ...
    }
  ]
}
```

### Step 3: Create a Test Market
If no markets exist, create one via the Admin page at `/admin`:

1. Fill in market details:
   - Question: "Will BTC hit $150K by end of July 31, 2026?"
   - Description: "This market will resolve to Yes if..."
   - Category: "Crypto"
   - End Time: Pick a future date
2. Click "Create Market"
3. Wait for confirmation

Then check the debug endpoint again (Step 1).

### Step 4: Check Frontend Console
Open browser DevTools (F12) → Console tab and look for:

```
[AdminResolution] Markets API Response: ...
[AdminResolution] Markets list: ...
[AdminResolution] Transformed markets: ...
```

These logs will show:
- What the API returned
- How many markets were found
- Whether the data was transformed correctly

### Step 5: Verify Backend is Running
Ensure backend server is running on port 3001:

```bash
# From the polymarket root
cd packages/backend
npm run dev
```

You should see log output like:
```
[Express] Server running on port 3001
[MarketsStore] Loaded X markets from storage
```

### Common Issues

1. **Backend not running**: 
   - Solution: Start backend with `npm run dev` in `packages/backend`

2. **No markets created yet**:
   - Solution: Go to `/admin` and create a market first

3. **Markets file corrupted**:
   - Solution: Delete `.data/markets.json` and recreate markets
   ```bash
   rm -rf .data/markets.json
   ```

4. **Permissions issue**:
   - Ensure `.data` directory is writable:
   ```bash
   chmod -R 755 .data
   ```

## Testing the Full Flow

1. **Create a market** via `/admin`
2. **Verify storage** with `/api/admin/debug/markets`
3. **Go to resolution** page at `/admin/resolution`
4. **Check browser console** for fetch logs
5. **Select market** and outcome
6. **Click Resolve** to complete resolution

## Frontend Data Transformation

The frontend transforms backend market data like this:

```javascript
Backend Market (from API):
{
  id: "0x123...",
  question: "Will BTC...",
  category: "Crypto",
  ...
}

Frontend Market (after transform):
{
  id: "0x123...",
  title: "Will BTC...",      // Maps 'question' → 'title'
  category: "Crypto",
  yesPrice: 50,               // Default values if not in response
  noPrice: 50,
  volume: "$0"
}
```

This transformation happens in `fetchMarkets()` function on the resolution page.
