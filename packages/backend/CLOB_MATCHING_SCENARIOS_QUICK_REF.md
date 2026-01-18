# CLOB Matching Scenarios - Quick Reference

## 4 Core Scenarios at a Glance

### Scenario 1: Complementary Matching (Both BUY)
```
BUY YES @ $0.20 + BUY NO @ $0.80 = $1.00 ✅

Trader A: 50 YES @ $0.20 = $10.00 cost
Trader B: 50 NO  @ $0.80 = $40.00 cost
Total exposure per unit: $1.00 (fully collateralized)
Match result: Both orders FULLY FILLED
```

**When this happens:**
- Two traders both want to buy
- They're betting on opposite outcomes
- Their prices add up to exactly $1.00
- Market is perfectly balanced

---

### Scenario 2: Direct Matching (Opposite Sides, Same Outcome)
```
BUY YES @ $0.30 + SELL YES @ $0.30 = MATCH ✅

Trader A: BUY 60 YES @ $0.30
Trader B: SELL 60 YES @ $0.30
Match result: Both orders FULLY FILLED at $0.30
Implied NO price: $0.70
```

**When this happens:**
- One trader wants to buy, another wants to sell
- Same outcome (both trading YES or both trading NO)
- Their prices match or cross
- Classic bid-ask spread elimination

**Price Improvement:**
```
BUY YES @ $0.35 crosses SELL YES @ $0.30
→ Execution happens at $0.30 (seller's price)
→ Buyer gets better deal ($0.30 instead of $0.35)
```

---

### Scenario 3: Complementary Matching (Both BUY, Different Ratio)
```
BUY YES @ $0.70 + BUY NO @ $0.30 = $1.00 ✅

Trader A: 40 YES @ $0.70 = $28.00 cost
Trader B: 40 NO  @ $0.30 = $12.00 cost
Total exposure per unit: $1.00 (fully collateralized)
Match result: Both orders FULLY FILLED

Market interpretation:
- YES outcome probability: 70%
- NO outcome probability: 30%
- Traders betting on opposite outcomes with different confidence
```

**When this happens:**
- Market consensus shifts
- One outcome becomes more likely than the other
- Prices still must sum to $1.00
- Creates all-or-nothing positions

---

### Scenario 4: Direct Matching (NO Outcome)
```
BUY NO @ $0.30 + SELL NO @ $0.30 = MATCH ✅

Trader A: BUY 75 NO @ $0.30
Trader B: SELL 75 NO @ $0.30
Match result: Both orders FULLY FILLED at $0.30
Implied YES price: $0.70
```

**When this happens:**
- Same as Scenario 2, but for NO outcome
- Demonstrates symmetry in the system
- Works identically to YES outcome matching

---

## Matching Decision Matrix

```
New Order Arrives
│
├─ DIRECT MATCHING CHECK
│  ├─ Is it same outcome as existing orders?
│  │  └─ YES: Check for opposite side
│  │      ├─ Opposite side found?
│  │      │  └─ YES: Do prices cross?
│  │      │      └─ YES: DIRECT MATCH (Scenario 2 or 4)
│  │      │      └─ NO: Add to order book
│  │      └─ NO: Continue to complementary check
│  │
├─ COMPLEMENTARY MATCHING CHECK
│  ├─ Is it opposite outcome as existing orders?
│  │  └─ YES: Both orders BUY or SELL?
│  │      └─ YES: Do prices sum to $1.00 ± 5%?
│  │          └─ YES: COMPLEMENTARY MATCH (Scenario 1 or 3)
│  │          └─ NO: Add to order book (not enough for exact $1.00)
│  │
└─ NO MATCH: Add to order book
```

---

## Price Validation Rules

### For Direct Matches (Scenario 2 & 4)
```
BUY Price ≥ SELL Price → MATCH

Examples:
✅ BUY @ $0.35 ≥ SELL @ $0.30 → MATCH (crossing)
✅ BUY @ $0.30 ≥ SELL @ $0.30 → MATCH (exact)
❌ BUY @ $0.25 ≥ SELL @ $0.30 → NO MATCH
```

### For Complementary Matches (Scenario 1 & 3)
```
ABS(BUY_YES_Price + BUY_NO_Price - $1.00) ≤ $0.05

Examples:
✅ $0.20 + $0.80 = $1.00 → MATCH
✅ $0.70 + $0.30 = $1.00 → MATCH
✅ $0.60 + $0.42 = $1.02 → MATCH (within 5%)
❌ $0.60 + $0.30 = $0.90 → NO MATCH
```

---

## Collateralization Invariant

**The Golden Rule:** In every valid matching scenario:

$$\text{YES Price} + \text{NO Price} = \$1.00$$

This must ALWAYS be true after matching.

```
Scenario 1: $0.20 + $0.80 = $1.00 ✅
Scenario 2: $0.30 + $0.70 = $1.00 ✅
Scenario 3: $0.70 + $0.30 = $1.00 ✅
Scenario 4: $0.70 + $0.30 = $1.00 ✅
```

Every token purchase represents a bet with total cost = $1.00 USD.

---

## Order Statuses

```
PENDING        → Order in book, waiting for match
PARTIAL_FILLED → Partially matched, remainder in book
FULLY_FILLED   → Completely matched, no remainder
CANCELLED      → Cancelled by trader
EXPIRED        → Expired due to time limit
```

---

## Real Trading Example

### Time T0: Initial Orders
```
OrderBook for market-ABC:

BUY Side (YES):           SELL Side (YES):
- Order 1: 50 @ $0.25    - (empty)

BUY Side (NO):            SELL Side (NO):
- (empty)                 - (empty)

No matches yet, order stays in book.
```

### Time T1: Matching Order Arrives
```
New order: BUY NO 50 @ $0.75

Matching check:
- BUY YES 50 @ $0.25 + BUY NO 50 @ $0.75 = $1.00 ✅
- Both BUY orders, opposite outcomes
- Prices sum to $1.00
- COMPLEMENTARY MATCH TRIGGERED!

Result:
- BUY YES order: Status FULLY_FILLED ✅
- BUY NO order: Status FULLY_FILLED ✅
- Both traders get their positions
```

---

## Code Reference

### Placing an Order

```typescript
// Scenario 1: Place complementary orders
await placeOrder(marketId, trader1, 'BUY', 'YES', 50, 0.20);
await placeOrder(marketId, trader2, 'BUY', 'NO', 50, 0.80);
// Result: Both match automatically

// Scenario 2: Place crossing orders
await placeOrder(marketId, trader1, 'BUY', 'YES', 60, 0.30);
await placeOrder(marketId, trader2, 'SELL', 'YES', 60, 0.30);
// Result: Direct match at $0.30
```

### Checking Order Status

```typescript
const response = await placeOrder(...);

if (response.success) {
  console.log(`Matches: ${response.matches}`);
  console.log(`Order Status: ${response.order.status}`);
  // FULLY_FILLED → order completely matched
  // PARTIAL_FILLED → order partially matched
  // PENDING → order in book, waiting
}
```

### Market Prices

```typescript
// After matching, check market prices
GET /api/orders/market/{marketId}/prices

Response:
{
  yes: { midPrice: 0.25, bestBid: 0.20, bestAsk: 0.30 },
  no:  { midPrice: 0.75, bestBid: 0.70, bestAsk: 0.80 },
  collateralizationCheck: {
    sum: 1.00,
    isValid: true
  }
}
```

---

## Testing Commands

```bash
# Run all scenarios with test output
npx ts-node examples/clobMatchingScenarios.ts

# Check specific market prices
curl http://localhost:3001/api/orders/market/market-scenario-1/prices

# View order book
curl http://localhost:3001/api/orders/market/market-scenario-1

# Check trader orders
curl http://localhost:3001/api/orders/user/0xTraderA
```

---

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Orders not matching | Prices don't cross or sum ≠ $1.00 | Check price calculations |
| Partial fill | Order amount smaller than match candidate | Check order amounts match |
| Price seems wrong | YES + NO ≠ $1.00 | Verify collateralization rule |
| Wrong outcome matched | Confused YES/NO in response | Double-check outcome field |

---

## Summary Table

| Scenario | Buy/Sell | YES Price | NO Price | Sum | Type |
|----------|----------|-----------|----------|-----|------|
| **1** | Both BUY | 0.20 | 0.80 | 1.00 ✅ | Complementary |
| **2** | Opposite | 0.30 | 0.70 | 1.00 ✅ | Direct |
| **3** | Both BUY | 0.70 | 0.30 | 1.00 ✅ | Complementary |
| **4** | Opposite | 0.70 | 0.30 | 1.00 ✅ | Direct |

All scenarios satisfy: **BUY YES @ X + BUY NO @ (1-X) = $1.00** ✅
