# CLOB Matching Scenarios - Complete Implementation Guide

## Overview

This guide provides a complete implementation of 4 essential CLOB matching scenarios that form the foundation of Polymarket's order matching engine. Each scenario demonstrates a core matching pattern with full collateralization enforcement.

---

## Files Created

### 1. **clobMatchingScenarios.ts** (Executable Test Suite)
- **Location:** `packages/backend/examples/clobMatchingScenarios.ts`
- **Purpose:** Runnable test file with 5 test scenarios
- **Features:**
  - Scenario 1: Complementary matching (Buy YES @ 0.2 + Buy NO @ 0.8)
  - Scenario 2: Direct matching (Buy YES @ 0.3 + Sell YES @ 0.3)
  - Scenario 3: Complementary matching (Buy YES @ 0.7 + Buy NO @ 0.3)
  - Scenario 4: Direct matching (Buy NO @ 0.3 + Sell NO @ 0.3)
  - Bonus Scenario 5: Complex multi-order matching
- **Run Command:** `npx ts-node examples/clobMatchingScenarios.ts`

### 2. **CLOB_MATCHING_SCENARIOS.md** (Detailed Documentation)
- **Location:** `packages/backend/CLOB_MATCHING_SCENARIOS.md`
- **Purpose:** In-depth technical explanation of each scenario
- **Contains:**
  - Complete mechanics of each scenario
  - Mathematical validation
  - Execution flow diagrams
  - Real-world trading sequences
  - Code examples
  - Validation rules

### 3. **CLOB_MATCHING_SCENARIOS_QUICK_REF.md** (Quick Reference)
- **Location:** `packages/backend/CLOB_MATCHING_SCENARIOS_QUICK_REF.md`
- **Purpose:** Fast lookup guide for matching scenarios
- **Contains:**
  - Scenario summaries
  - Matching decision matrix
  - Price validation rules
  - Code snippets
  - Common issues & solutions
  - Summary tables

---

## The 4 Core Scenarios

### Scenario 1: Complementary Matching (Low YES)
```
Buy YES @ $0.20 + Buy NO @ $0.80 = $1.00

✅ Type: Complementary (both buy, opposite outcomes)
✅ Rule: YES Price + NO Price = $1.00
✅ Result: Both orders fully matched
✅ Market Interpretation: YES outcome less likely (20% implied probability)
```

**Matching Logic:**
- Both orders are BUY orders (same side)
- Outcomes are complementary (YES vs NO)
- Prices sum exactly to $1.00 (or within 5% tolerance)
- Indicates market equilibrium with YES undervalued

---

### Scenario 2: Direct Matching (Same Outcome)
```
Buy YES @ $0.30 + Sell YES @ $0.30

✅ Type: Direct (opposite sides, same outcome)
✅ Rule: BUY Price ≥ SELL Price
✅ Result: Both orders fully matched at $0.30
✅ Market Interpretation: Price discovery at $0.30 level
```

**Matching Logic:**
- Opposite sides (BUY vs SELL)
- Same outcome (both YES)
- Prices match or cross
- Execution at maker price (improves taker price)
- Implied NO price: $0.70

---

### Scenario 3: Complementary Matching (High YES)
```
Buy YES @ $0.70 + Buy NO @ $0.30 = $1.00

✅ Type: Complementary (both buy, opposite outcomes)
✅ Rule: YES Price + NO Price = $1.00
✅ Result: Both orders fully matched
✅ Market Interpretation: YES outcome more likely (70% implied probability)
```

**Matching Logic:**
- Both orders are BUY orders (same side)
- Outcomes are complementary (YES vs NO)
- Prices sum exactly to $1.00
- Indicates market consensus shifted toward YES

---

### Scenario 4: Direct Matching (NO Outcome)
```
Buy NO @ $0.30 + Sell NO @ $0.30

✅ Type: Direct (opposite sides, same outcome)
✅ Rule: BUY Price ≥ SELL Price
✅ Result: Both orders fully matched at $0.30
✅ Market Interpretation: NO outcome price discovery at $0.30
```

**Matching Logic:**
- Opposite sides (BUY vs SELL)
- Same outcome (both NO)
- Prices match exactly
- Execution at maker price
- Implied YES price: $0.70 (maintains collateralization)

---

## Implementation Details

### Matching Algorithm

The CLOB matcher checks orders in this priority order:

```typescript
// 1. Check for Direct Matches (same outcome, opposite sides)
if (newOrder.outcome === existingOrder.outcome) {
  if (pricesCross(newOrder, existingOrder)) {
    return directMatch(newOrder, existingOrder);
  }
}

// 2. Check for Complementary Matches (opposite outcomes, both same side)
const complementaryOrder = findComplementaryOrder(newOrder);
if (complementaryOrder) {
  if (collateralizationValid(newOrder, complementaryOrder)) {
    return complementaryMatch(newOrder, complementaryOrder);
  }
}

// 3. No match - add to order book
return addToOrderBook(newOrder);
```

### Price Validation

**Direct Matches:**
```
BUY Order Price ≥ SELL Order Price
$0.30 ≥ $0.30 ✅ Match
$0.35 ≥ $0.30 ✅ Match (better for buyer)
$0.25 ≥ $0.30 ❌ No match
```

**Complementary Matches:**
```
ABS(YES_Price + NO_Price - $1.00) ≤ $0.05
$0.20 + $0.80 = $1.00 ✅ Match
$0.70 + $0.30 = $1.00 ✅ Match
$0.60 + $0.50 = $1.10 ❌ No match (outside tolerance)
```

### Collateralization Enforcement

Every matched order pair must satisfy:

$$\text{YES Price} + \text{NO Price} = \$1.00 \pm 5\%$$

This ensures:
- Full collateralization of positions
- No arbitrage opportunities
- Market-implied probability sums to 100%
- Fair pricing across outcomes

---

## API Reference

### Place Order Endpoint

```http
POST /api/orders/place

Request Body:
{
  "marketId": "string",           // Market identifier
  "makerAddress": "0x...",        // Trader Ethereum address
  "side": "BUY" | "SELL",         // Order side
  "outcome": "YES" | "NO",        // Outcome being traded
  "amount": number,               // Order quantity
  "price": number,                // Price per token ($0.00-$1.00)
  "expiresIn": number             // Expiration in milliseconds
}

Response:
{
  "success": true,
  "order": {
    "id": "string",               // Order ID
    "status": "PENDING" | "FULLY_FILLED" | "PARTIAL_FILLED",
    "filledAmount": number,
    "remainingAmount": number
  },
  "matches": number,              // Number of orders matched
  "executionPrice": number        // Price of execution (if matched)
}
```

### Get Market Prices

```http
GET /api/orders/market/{marketId}/prices

Response:
{
  "success": true,
  "prices": {
    "yes": {
      "midPrice": 0.30,           // Mid-point between bid and ask
      "bestBid": 0.25,            // Highest buy price
      "bestAsk": 0.35             // Lowest sell price
    },
    "no": {
      "midPrice": 0.70,           // Complement of YES
      "bestBid": 0.65,
      "bestAsk": 0.75
    }
  },
  "collateralizationCheck": {
    "sum": 1.00,                  // YES + NO prices
    "isValid": true,              // Within tolerance
    "deviation": 0.00             // Deviation from $1.00
  }
}
```

### Get Order Book

```http
GET /api/orders/market/{marketId}?outcome=YES

Response:
{
  "success": true,
  "marketId": "string",
  "buySide": [                    // Buy orders sorted by price (descending)
    {
      "id": "string",
      "side": "BUY",
      "outcome": "YES",
      "amount": 50,
      "price": 0.30,
      "status": "PENDING"
    }
  ],
  "sellSide": [                   // Sell orders sorted by price (ascending)
    {
      "id": "string",
      "side": "SELL",
      "outcome": "YES",
      "amount": 60,
      "price": 0.32,
      "status": "PENDING"
    }
  ]
}
```

---

## Testing & Verification

### Run All Scenarios

```bash
# Install dependencies (if not already done)
cd packages/backend
pnpm install

# Run test scenarios
npx ts-node examples/clobMatchingScenarios.ts
```

**Expected Output:**
```
✅ SCENARIO 1: COMPLEMENTARY MATCHING (Both Buy Orders)
  Setup: Buy YES @ 0.2 + Buy NO @ 0.8 = $1.00
  Step 1: TRADER_A places BUY YES order
    ✅ BUY YES 50 @ $0.2 | Order: abc123... | Matched: NO
  Step 2: TRADER_B places BUY NO order
    ✅ BUY NO 50 @ $0.8 | Order: def456... | Matched: YES (1)
  Market State:
    YES: $0.20 bid: 0.20 ask: 0.20
    NO:  $0.80 bid: 0.80 ask: 0.80
    Sum: $1.00 ✅ Valid
✅ SCENARIO 1 COMPLETE

... (Scenarios 2-5) ...

✅ ALL MATCHING SCENARIOS COMPLETED SUCCESSFULLY!
```

### Manual Testing

**Test Scenario 1:**
```bash
# Terminal 1: Start backend
npm run dev

# Terminal 2: Run scenarios
npx ts-node examples/clobMatchingScenarios.ts
```

**Test Scenario 2 (Manual HTTP):**
```bash
# Place buy order
curl -X POST http://localhost:3001/api/orders/place \
  -H "Content-Type: application/json" \
  -d '{
    "marketId": "test-market",
    "makerAddress": "0x1111111111111111111111111111111111111111",
    "side": "BUY",
    "outcome": "YES",
    "amount": 100,
    "price": 0.30,
    "expiresIn": 60000
  }'

# Place matching sell order
curl -X POST http://localhost:3001/api/orders/place \
  -H "Content-Type: application/json" \
  -d '{
    "marketId": "test-market",
    "makerAddress": "0x2222222222222222222222222222222222222222",
    "side": "SELL",
    "outcome": "YES",
    "amount": 100,
    "price": 0.30,
    "expiresIn": 60000
  }'

# Check market prices
curl http://localhost:3001/api/orders/market/test-market/prices
```

---

## Validation Checklist

After implementation, verify:

- [ ] Scenario 1 orders match (complementary YES + NO = $1.00)
- [ ] Scenario 2 orders match (BUY YES × SELL YES same price)
- [ ] Scenario 3 orders match (complementary with different ratio)
- [ ] Scenario 4 orders match (BUY NO × SELL NO same price)
- [ ] Order statuses update correctly (PENDING → FULLY_FILLED)
- [ ] Market prices reflect matched orders
- [ ] Collateralization always = $1.00 ± 5%
- [ ] No arbitrage opportunities exist
- [ ] Price improvement applies (takers get better prices)

---

## Dependencies

Ensure the following are in `package.json`:

```json
{
  "dependencies": {
    "axios": "^1.6.0",          // HTTP client for tests
    "express": "^4.19.2",       // Web server
    "ethers": "^6.10.0",        // Ethereum utilities
    "uuid": "^9.0.1",           // Order ID generation
    "ws": "^8.18.0"             // WebSocket support
  }
}
```

---

## Integration with Frontend

Frontend developers should:

1. **Subscribe to WebSocket updates:**
```typescript
const ws = new WebSocket('ws://localhost:3001');
ws.send(JSON.stringify({
  type: 'subscribe',
  marketId: 'market-123',
  outcome: 'YES'  // Optional, omit for all outcomes
}));

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  // Update order book display
  // Refresh prices
  // Show matches
};
```

2. **Fetch market data:**
```typescript
// Get current prices
const prices = await fetch('/api/orders/market/market-123/prices')
  .then(r => r.json());

// Get order book
const orderbook = await fetch('/api/orders/market/market-123?outcome=YES')
  .then(r => r.json());
```

3. **Place orders:**
```typescript
const response = await fetch('/api/orders/place', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    marketId: 'market-123',
    makerAddress: userAddress,
    side: 'BUY',
    outcome: 'YES',
    amount: 100,
    price: 0.30,
    expiresIn: 60000
  })
});

const result = await response.json();
console.log(`Order ${result.success ? 'placed' : 'failed'}`);
console.log(`Matches: ${result.matches}`);
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│          Frontend (React Components)              │
│  - Order Placement Form                          │
│  - Order Book Display                            │
│  - Real-time Prices (WebSocket)                 │
└────────────────────┬────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
      HTTP REST            WebSocket
      API Calls            Updates
         │                       │
┌────────▼───────────────────────▼────────────────┐
│         Express.js HTTP Server                   │
│  - POST /api/orders/place                       │
│  - GET /api/orders/market/:id/prices            │
│  - GET /api/orders/market/:id                   │
│  - WebSocket: orderbook updates                 │
└────────────┬──────────────────────────────────┬─┘
             │                                  │
             │                                  │
   ┌─────────▼─────────┐            ┌──────────▼──────────┐
   │  Order Matching   │            │  Order Book Service │
   │    Service        │────────────│   (Persistence)     │
   │                   │            │                     │
   │ - Direct Match    │            │ - Save to disk      │
   │ - Complementary   │            │ - Load from disk    │
   │ - Collateral      │            │ - Calculate prices  │
   │   Validation      │            │                     │
   └─────────────────┬─┘            └──────────┬──────────┘
                     │                         │
                     └────────────┬────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │   .data/orders.json       │
                    │  (File-based Persistence) │
                    └───────────────────────────┘
```

---

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| Orders not matching | Prices don't meet crossing criteria | Check price validation rules |
| Collateralization fails | YES + NO ≠ $1.00 | Review collateral check tolerance |
| Partial fills wrong | Amount mismatch | Ensure amounts are compatible |
| Market prices incorrect | Order book not updated | Check persistence layer |
| WebSocket not updating | Connection issue | Verify WebSocket server running |

---

## Next Steps

1. **Run the test suite:** Execute `clobMatchingScenarios.ts` to verify matching works
2. **Check order book:** Query prices API to see market state
3. **Frontend integration:** Subscribe to WebSocket for real-time updates
4. **Smart contract integration:** Link matches to token transfers
5. **Performance testing:** Load test with many orders

---

## Documentation Files

- [CLOB_MATCHING_SCENARIOS.md](./CLOB_MATCHING_SCENARIOS.md) - Detailed technical guide
- [CLOB_MATCHING_SCENARIOS_QUICK_REF.md](./CLOB_MATCHING_SCENARIOS_QUICK_REF.md) - Quick reference
- [CLOB_INTEGRATION_GUIDE.md](./CLOB_INTEGRATION_GUIDE.md) - Frontend integration
- [CLOB_ARCHITECTURE.md](./CLOB_ARCHITECTURE.md) - System architecture

---

## Summary

The CLOB matching system implements 4 essential scenarios:
1. ✅ **Complementary Buy Orders** - Both BUY, opposite outcomes summing to $1.00
2. ✅ **Direct Same Outcome Matching** - Opposite sides (BUY/SELL) trading same outcome
3. ✅ **Complementary Buy Orders (High Probability)** - Both BUY with different price ratios
4. ✅ **Direct NO Outcome Matching** - Opposite sides trading NO outcome

All scenarios maintain the invariant: **YES Price + NO Price = $1.00 USD**

This ensures full collateralization and market integrity in every trade.
