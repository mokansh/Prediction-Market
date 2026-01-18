# CLOB Matching Scenarios Guide

This document explains the 4 core matching scenarios in the Central Limit Order Book system, with mathematical validation and real-world examples.

## Overview

The Polymarket CLOB uses two primary matching types:

1. **Direct Matching** - Opposite sides of same outcome at compatible prices
2. **Complementary Matching** - Both same side (BUY/SELL) with outcomes summing to $1.00

Both enforce the core rule: **YES Price + NO Price = $1.00 USD**

---

## Scenario 1: Complementary Matching (Low YES Price)

**Setup:** Buy YES @ $0.20 + Buy NO @ $0.80 = $1.00

### Mechanics

```
Order A (TRADER_A):  BUY 50 YES @ $0.20
Order B (TRADER_B):  BUY 50 NO  @ $0.80
                     ─────────────────
                     Sum = $1.00 ✅
```

### Why This Matches

- Both are **BUY orders** (same side)
- **Complementary outcomes**: YES and NO
- **Prices sum to $1.00**: Full collateralization
- These orders can be matched because they create a complete market position

### Execution Flow

```
1. TRADER_A buys 50 YES tokens for $10 (50 × $0.20)
   → Receives 50 YES tokens
   → Expects NO tokens to rise (opposite position)

2. TRADER_B buys 50 NO tokens for $40 (50 × $0.80)
   → Receives 50 NO tokens
   → Expects YES tokens to fall (opposite position)

3. Market Result:
   - If outcome = YES: TRADER_A profits, TRADER_B loses
   - If outcome = NO: TRADER_B profits, TRADER_A loses
   - Total exposure = $1.00 per unit (fully collateralized)
```

### Collateralization Check

$$\text{YES Price} + \text{NO Price} = \$0.20 + \$0.80 = \$1.00$$ ✅

---

## Scenario 2: Direct Matching (Same Outcome, Opposite Sides)

**Setup:** Buy YES @ $0.30 + Sell YES @ $0.30

### Mechanics

```
Order A (TRADER_A):  BUY  60 YES @ $0.30
Order B (TRADER_B):  SELL 60 YES @ $0.30
                     ──────────────────
                     Same outcome, opposite sides
                     Prices match exactly ✅
```

### Why This Matches

- **Same outcome**: Both trading YES tokens
- **Opposite sides**: BUY vs SELL
- **Price overlap**: Buyer willing to pay $0.30, seller willing to accept $0.30
- This is the simplest, most common match type

### Execution Flow

```
1. TRADER_A buys 60 YES @ $0.30
   → Pays $18 (60 × $0.30)
   → Receives 60 YES tokens

2. TRADER_B sells 60 YES @ $0.30
   → Receives $18 (60 × $0.30)
   → Delivers 60 YES tokens

3. Order Book Result:
   - Both orders FULLY FILLED
   - Order book for YES cleared at $0.30
```

### Market Implications

- This match reveals market consensus at $0.30 for YES
- Implies NO tokens worth $0.70 (to maintain $1.00 rule)
- Creates price discovery through direct matching

---

## Scenario 3: Complementary Matching (Higher YES Price)

**Setup:** Buy YES @ $0.70 + Buy NO @ $0.30 = $1.00

### Mechanics

```
Order A (TRADER_A):  BUY 40 YES @ $0.70
Order B (TRADER_B):  BUY 40 NO  @ $0.30
                     ─────────────────
                     Sum = $1.00 ✅
```

### Why This Matches

- Both are **BUY orders** (same side)
- **Complementary outcomes**: YES and NO
- **Prices sum to $1.00**: Full collateralization
- Indicates market confidence in YES outcome

### Execution Flow

```
1. TRADER_A buys 40 YES @ $0.70
   → Pays $28 (40 × $0.70)
   → Receives 40 YES tokens
   → Bullish on YES outcome

2. TRADER_B buys 40 NO @ $0.30
   → Pays $12 (40 × $0.30)
   → Receives 40 NO tokens
   → Bullish on NO outcome (but lower confidence)

3. Market Interpretation:
   - YES outcome probability ≈ 70%
   - NO outcome probability ≈ 30%
   - 70% + 30% = 100% (valid probability distribution)
```

### Collateralization Check

$$\text{YES Price} + \text{NO Price} = \$0.70 + \$0.30 = \$1.00$$ ✅

---

## Scenario 4: Direct Matching (NO Outcome)

**Setup:** Buy NO @ $0.30 + Sell NO @ $0.30

### Mechanics

```
Order A (TRADER_A):  BUY  75 NO @ $0.30
Order B (TRADER_B):  SELL 75 NO @ $0.30
                     ─────────────────
                     Same outcome, opposite sides
```

### Why This Matches

- **Same outcome**: Both trading NO tokens
- **Opposite sides**: BUY vs SELL
- **Price match**: Both at $0.30
- Demonstrates parity between YES and NO matching

### Execution Flow

```
1. TRADER_A buys 75 NO @ $0.30
   → Pays $22.50 (75 × $0.30)
   → Receives 75 NO tokens

2. TRADER_B sells 75 NO @ $0.30
   → Receives $22.50 (75 × $0.30)
   → Delivers 75 NO tokens

3. Order Book Result:
   - Both orders FULLY FILLED
   - NO market discovers price at $0.30
   - Implies YES market at $0.70 (inverse pricing)
```

---

## Matching Algorithm Decision Tree

```
┌─ New Order Arrives ─┐
│                     │
├─ Check same outcome?
│  ├─ YES → Check for opposite side at compatible price
│  │         └─ Direct Match (Scenario 2 or 4)
│  │
│  └─ NO → Check if complementary (other outcome)
│           └─ Verify YES + NO = $1.00
│              └─ Complementary Match (Scenario 1 or 3)
│
├─ If no full match → Check for partial fills
├─ If no matches → Add to order book
└─ If matches → Transfer collateral & update order status
```

---

## Price Crossing (Match Conditions)

### For Direct Matches (Same Outcome)

**BUY order crosses SELL order when:**
$$\text{BUY Price} \geq \text{SELL Price}$$

**Example (Scenario 2):**
```
BUY YES @ $0.30 ≥ SELL YES @ $0.30 ✅ CROSSES → MATCH
BUY YES @ $0.35 ≥ SELL YES @ $0.30 ✅ CROSSES → MATCH (improves price)
BUY YES @ $0.25 < SELL YES @ $0.30 ❌ NO CROSS → No match
```

### For Complementary Matches (Opposite Outcomes)

**Both BUY orders match when:**
$$\text{BUY YES Price} + \text{BUY NO Price} = \$1.00 \pm 5\%$$

**Examples:**
```
Scenario 1: $0.20 + $0.80 = $1.00 ✅ VALID
Scenario 3: $0.70 + $0.30 = $1.00 ✅ VALID
Invalid:   $0.60 + $0.50 = $1.10 ❌ NOT 1.00
```

---

## Real-World Trading Sequences

### Sequence A: Market Confidence Shift

```
Time 1: Trader A buys 100 YES @ $0.60
        → Expects YES to happen (60% confidence)

Time 2: Trader B buys 100 NO @ $0.40
        → Expects NO to happen (40% confidence)
        → Market matches! Both get position

Time 3: Market Event (new information)
        → Traders believe YES more likely now
        → YES orders increase to $0.75
        → NO orders drop to $0.25
        → Scenario 3 pattern creates new matches
```

### Sequence B: Gradual Price Discovery

```
Time 1: Trader A sells 50 YES @ $0.65
        → Willing to sell at this price

Time 2: Trader B buys 50 YES @ $0.67
        → Willing to buy at this price
        → Price improves to $0.66 (average)
        → Direct match at $0.65 (maker price)

Time 3: Market sees YES trading at $0.65
        → NO implied at $0.35
        → Creates Scenario 3 opportunity
```

---

## Execution Examples

### Example 1: Scenario 1 Execution

```javascript
// Place complementary orders that match
const order1 = await placeOrder(
  'market-123',
  '0xTraderA',
  'BUY',
  'YES',
  50,
  0.20  // $0.20 for YES
);

const order2 = await placeOrder(
  'market-123',
  '0xTraderB',
  'BUY',
  'NO',
  50,
  0.80  // $0.80 for NO = $1.00 total
);

// Response:
// {
//   order1: { status: 'FULLY_FILLED', matches: 1 },
//   order2: { status: 'FULLY_FILLED', matches: 1 },
//   collateralization: { sum: 1.00, valid: true }
// }
```

### Example 2: Scenario 2 Execution with Price Improvement

```javascript
// Place orders that cross
const buyOrder = await placeOrder(
  'market-123',
  '0xTraderA',
  'BUY',
  'YES',
  60,
  0.35  // Willing to pay up to $0.35
);

const sellOrder = await placeOrder(
  'market-123',
  '0xTraderB',
  'SELL',
  'YES',
  60,
  0.30  // Willing to sell at $0.30
);

// Execution: $0.30 (seller's price - favors buyer)
// TraderA buys at better price ($0.30 vs $0.35 limit)
// TraderB sells at acceptable price ($0.30 as requested)
```

---

## Key Validation Rules

| Aspect | Rule | Example |
|--------|------|---------|
| **Direct Match** | Same outcome, opposite sides, prices cross | BUY YES $0.30 ↔ SELL YES $0.30 |
| **Complementary** | Both same side, outcomes complement, sum ≈ $1.00 | BUY YES $0.60 + BUY NO $0.40 |
| **Price Tolerance** | ±5% tolerance on collateralization sum | $0.95 to $1.05 acceptable |
| **Amount Match** | Quantities must align for full/partial fill | 60 × 60 = full fill, 60 × 40 = partial |
| **Trader Validation** | Addresses must be valid Ethereum addresses | Must be checksummed and non-zero |

---

## Testing the Scenarios

Run all scenarios with:

```bash
npx ts-node examples/clobMatchingScenarios.ts
```

Expected output:
```
✅ Scenario 1: Complementary buy orders matched
✅ Scenario 2: Direct matching with same outcome
✅ Scenario 3: Complementary buy with different ratios
✅ Scenario 4: Direct matching for NO outcome
✅ Bonus: Complex multi-order matching
```

---

## Summary

| Scenario | Type | Pattern | Rule Applied |
|----------|------|---------|---------------|
| **1** | Complementary | BUY YES + BUY NO | YES(0.2) + NO(0.8) = $1.00 |
| **2** | Direct | BUY YES + SELL YES | Direct crossing at $0.30 |
| **3** | Complementary | BUY YES + BUY NO | YES(0.7) + NO(0.3) = $1.00 |
| **4** | Direct | BUY NO + SELL NO | Direct crossing at $0.30 |

All scenarios maintain the fundamental property: **Total collateral per unit = $1.00 USD**
