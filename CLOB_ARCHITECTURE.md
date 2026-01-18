# CLOB Architecture Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Order Form   │  │ Orderbook    │  │ Market Prices│      │
│  │ (BUY/SELL)   │  │ Display      │  │ Display      │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
└─────────┼──────────────────┼──────────────────┼──────────────┘
          │ REST API         │ WebSocket        │
          │ POST /orders     │ subscribe        │
          │ GET /orders      │ unsubscribe      │
          │ DELETE /orders   │                  │
          ↓                  ↓                  ↓
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND (Express)                          │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              API Routes (src/routes/orders.ts)      │   │
│  │  • POST /orders/place      → Create order           │   │
│  │  • GET /orders/:id         → Order details          │   │
│  │  • GET /orders/user/:addr  → User orders            │   │
│  │  • GET /orders/market/:id  → Orderbook              │   │
│  │  • GET /orders/.../prices  → Market prices          │   │
│  │  • DELETE /orders/:id      → Cancel order           │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↓                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │          Order Matching Engine (Service)            │   │
│  │                                                       │   │
│  │  1. Receive order                                   │   │
│  │  2. Validate (price, address, collateral)           │   │
│  │  3. Add to order book                               │   │
│  │  4. Find compatible orders (opposite side, same out)│   │
│  │  5. Check collateralization (YES + NO = 1.0)        │   │
│  │  6. Calculate fills with price improvement          │   │
│  │  7. Update order status                             │   │
│  │  8. Return matches                                  │   │
│  │                                                       │   │
│  │  Key Methods:                                       │   │
│  │  • matchOrder()                                     │   │
│  │  • validateCollateralization()                      │   │
│  │  • calculateExecutionPrice()                        │   │
│  │  • calculatePayoff()                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↓                                    │
│  ┌──────────────────────────┬──────────────────────────┐   │
│  │   Order Book Service     │ Collateralization        │   │
│  │   (Persistence)          │ Validator                │   │
│  │                          │                          │   │
│  │ • Store orders by market │ • Check YES + NO = 1.0   │   │
│  │ • Separate BUY/SELL sides│ • Detect arbitrage       │   │
│  │ • Calculate prices       │ • Simulate order impact  │   │
│  │ • Track user positions   │ • Market balance check   │   │
│  │ • Cancel orders          │ • Fair price calc        │   │
│  │                          │                          │   │
│  │ Methods:                 │ Methods:                 │   │
│  │ • addOrder()             │ • validateOrder()        │   │
│  │ • getOrderBook()         │ • checkArbitrage()       │   │
│  │ • getMarketPrices()      │ • calculateFairPrice()   │   │
│  │ • cancelOrder()          │ • getStatus()            │   │
│  │ • getUserOrders()        │ • simulateImpact()       │   │
│  │                          │                          │   │
│  └──────────────────────────┴──────────────────────────┘   │
│                          ↓                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Persistent Storage (.data/)               │   │
│  │                                                       │   │
│  │  orders.json:                                       │   │
│  │  {                                                  │   │
│  │    "orders": [ /* All orders */ ],                  │   │
│  │    "orderBooks": [ /* By market/outcome */ ],       │   │
│  │    "userOrders": { /* User -> Order IDs */ }        │   │
│  │  }                                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         WebSocket Handler (Real-time Updates)       │   │
│  │                                                       │   │
│  │  Subscriptions:                                     │   │
│  │  • market:marketId        → All outcomes            │   │
│  │  • market:marketId:YES    → YES outcome             │   │
│  │  • market:marketId:NO     → NO outcome              │   │
│  │                                                       │   │
│  │  Broadcasts:                                        │   │
│  │  • orderbook_update                                 │   │
│  │  • price_update                                     │   │
│  │  • order_status_change                              │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Order Matching Flow Diagram

```
┌─────────────────────┐
│  User Places Order  │
│  BUY 100 YES @ 0.65 │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────────────────────┐
│  1. Validate Order                  │
│  ✓ Address is valid (EthERS check)  │
│  ✓ Price in range (0 ≤ 0.65 ≤ 1)   │
│  ✓ Amount > 0 (100 > 0)             │
│  ✓ Collateral check (100 * 0.65)    │
└──────────┬──────────────────────────┘
           │
           ↓
┌─────────────────────────────────────┐
│  2. Add to Order Book               │
│  YES outcome:                       │
│  ├─ BUY side: [order@0.65, ...]    │
│  └─ SELL side: [...]               │
└──────────┬──────────────────────────┘
           │
           ↓
┌─────────────────────────────────────┐
│  3. Find Compatible Orders          │
│  Criteria:                          │
│  • Opposite side (SELL YES)         │
│  • Same outcome (YES)               │
│  • Price compatible (0.65 ≤ 0.65)   │
│                                     │
│  Found: SELL 100 YES @ 0.60         │
└──────────┬──────────────────────────┘
           │
           ↓
┌─────────────────────────────────────┐
│  4. Collateralization Check         │
│  If matching YES @ 0.65:            │
│  ✓ NO must be ~0.35                 │
│  ✓ Sum: 0.65 + 0.35 = 1.00         │
│  ✓ Tolerance: 0.95-1.05             │
└──────────┬──────────────────────────┘
           │
           ↓
┌─────────────────────────────────────┐
│  5. Calculate Execution             │
│  Maker:  SELL @ 0.60                │
│  Taker:  BUY @ 0.65                 │
│  Exec:   0.60 (best for taker!)    │
│  Amount: min(100, 100) = 100        │
└──────────┬──────────────────────────┘
           │
           ↓
┌─────────────────────────────────────┐
│  6. Update Orders                   │
│  Maker:  FULLY_FILLED (100/100)    │
│  Taker:  FULLY_FILLED (100/100)    │
│  Status: FILLED                     │
└──────────┬──────────────────────────┘
           │
           ↓
┌─────────────────────────────────────┐
│  7. Broadcast Update                │
│  WebSocket:                         │
│  • orderbook_update (YES)           │
│  • orderbook_update (NO)            │
│  • price_update                     │
│  Clients:                           │
│  ├─ Refresh orderbook               │
│  ├─ Update prices                   │
│  └─ Show execution                  │
└──────────┬──────────────────────────┘
           │
           ↓
┌─────────────────────────────────────┐
│  8. Return Result to User           │
│  {                                  │
│    "success": true,                 │
│    "matches": 1,                    │
│    "executionPrice": 0.60,          │
│    "executedAmount": 100            │
│  }                                  │
└─────────────────────────────────────┘
```

## Collateralization Rule

```
┌──────────────────────────────────────────────────────────┐
│  Core Principle: YES Price + NO Price = $1.00            │
├──────────────────────────────────────────────────────────┤
│                                                            │
│  Example: Market resolves to YES                         │
│                                                            │
│  Outcome 1: YES                 Outcome 2: NO            │
│  Price: $0.65 ──────┐      ┌────── Price: $0.35        │
│         ✓ Get $1    │      │  ✗ Get $0                │
│                     │      │                             │
│  Buyer Profile:     └──┬───┘                            │
│  • Risk: $0.65          │      • If YES wins:          │
│  • Reward: $0.35        │        Profit = $0.35        │
│  • Total: $1.00         │      • If NO wins:           │
│                         │        Loss = $0.65          │
│                         │                              │
├──────────────────────────────────────────────────────────┤
│  Validation Examples:                                    │
│                                                            │
│  ✅ VALID                                                │
│  YES: 0.60  NO: 0.40  Sum: 1.00                         │
│  YES: 0.70  NO: 0.30  Sum: 1.00                         │
│  YES: 0.65  NO: 0.35  Sum: 1.00                         │
│                                                            │
│  ⚠️  TOLERANCE (±5%)                                     │
│  YES: 0.65  NO: 0.34  Sum: 0.99  ← Acceptable          │
│  YES: 0.68  NO: 0.32  Sum: 1.00  ← Acceptable          │
│  YES: 0.70  NO: 0.31  Sum: 1.01  ← Acceptable          │
│                                                            │
│  ❌ INVALID                                               │
│  YES: 0.80  NO: 0.80  Sum: 1.60  ← Extreme imbalance   │
│  YES: 0.40  NO: 0.80  Sum: 1.20  ← Unbalanced          │
│  YES: 0.90  NO: 0.05  Sum: 0.95  ← Outside tolerance   │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

## Order Book Structure

```
Market: "Will ETH hit $3000 by Jan 31?"
├─ YES Outcome
│  ├─ BUY Side (sorted by price DESC)
│  │  ├─ Order 1: Price 0.68, Amount 50 ← Best bid
│  │  ├─ Order 2: Price 0.65, Amount 100
│  │  └─ Order 3: Price 0.60, Amount 75
│  │
│  └─ SELL Side (sorted by price ASC)
│     ├─ Order 4: Price 0.70, Amount 30 ← Best ask
│     ├─ Order 5: Price 0.72, Amount 50
│     └─ Order 6: Price 0.75, Amount 25
│
└─ NO Outcome
   ├─ BUY Side (sorted by price DESC)
   │  ├─ Order 7: Price 0.32, Amount 100
   │  └─ Order 8: Price 0.30, Amount 50
   │
   └─ SELL Side (sorted by price ASC)
      ├─ Order 9: Price 0.35, Amount 75
      └─ Order 10: Price 0.38, Amount 40

Mid Prices:
• YES: (0.68 + 0.70) / 2 = 0.69
• NO:  (0.32 + 0.35) / 2 = 0.335
• Sum: 0.69 + 0.335 = 1.025 ✓ (within tolerance)
```

## Data Flow Diagram

```
                    Frontend
                       │
          ┌────────────┼────────────┐
          │            │            │
       Order Form   WebSocket   Orderbook
          │            │            │
          └────────────┼────────────┘
                       │
                       ↓
                  /api/orders/
                  (REST API)
                       │
        ┌──────────────┼──────────────┐
        │              │              │
      Place          Query         Cancel
      Order          Status         Order
        │              │              │
        ↓              ↓              ↓
    ┌─────────────────────────────────────┐
    │   Order Matching Engine             │
    │   (orderMatchingService.ts)         │
    ├─────────────────────────────────────┤
    │ 1. Validate order                   │
    │ 2. Find compatible orders           │
    │ 3. Check collateralization          │
    │ 4. Calculate execution price        │
    │ 5. Update order status              │
    └─────────────────────────────────────┘
        │              │
        ↓              ↓
    ┌──────────────────────────────────────┐
    │  Order Book Service                  │
    │  (orderBookService.ts)               │
    │  • Store/retrieve orders             │
    │  • Track market prices               │
    │  • User order history                │
    └──────────────────────────────────────┘
        │
        ↓
    ┌──────────────────────────────────────┐
    │  Persistent Storage                  │
    │  (.data/orders.json)                 │
    └──────────────────────────────────────┘
        │
        ↓
    ┌──────────────────────────────────────┐
    │  WebSocket Broadcast                 │
    │  • orderbook_update                  │
    │  • price_update                      │
    │  • status_change                     │
    └──────────────────────────────────────┘
        │
        ↓
    Frontend Updates:
    • Refresh orderbook
    • Update prices
    • Show matches
    • Update user orders
```

## Service Dependencies

```
routes/orders.ts
    │
    ├─→ orderMatchingService.ts
    │   └─→ types/orders.ts
    │
    ├─→ orderBookService.ts
    │   ├─→ types/orders.ts
    │   └─→ fs (persistence)
    │
    ├─→ collateralizationValidator.ts
    │   ├─→ types/orders.ts
    │   └─→ orderBookService.ts
    │
    └─→ ethers
        └─→ Address validation
```

---

**Note**: This architecture is designed to be:
- ✅ Scalable (can handle high order volume)
- ✅ Maintainable (modular services)
- ✅ Extensible (easy to add features)
- ✅ Persistent (survives restarts)
- ✅ Real-time (WebSocket support)
