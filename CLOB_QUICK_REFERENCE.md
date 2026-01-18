# CLOB Quick Reference

## Key Rule
$$\text{YES Price} + \text{NO Price} = \$1.00$$

When YES trades at $0.65, NO must trade at $0.35.

## Files Created

### Core Services
- **[src/types/orders.ts](src/types/orders.ts)** - Type definitions
  - `Order`, `OrderBook`, `MarketPrice`, `OrderSide`, `OrderStatus`, `OutcomeType`

- **[src/services/orderMatchingService.ts](src/services/orderMatchingService.ts)** - Matching engine
  - `matchOrder()` - Matches compatible orders
  - `validateCollateralization()` - Checks YES + NO = 1.0
  - `calculatePayoff()` - Computes order payoff
  - `calculateRequiredCollateral()` - Determines collateral needed

- **[src/services/orderBookService.ts](src/services/orderBookService.ts)** - Order persistence
  - `addOrder()` - Add order to book
  - `getOrderBook()` - Retrieve orderbook snapshot
  - `getMarketPrices()` - Get bid/ask/mid prices
  - `cancelOrder()` - Cancel order
  - Persists to `.data/orders.json`

- **[src/services/collateralizationValidator.ts](src/services/collateralizationValidator.ts)** - Market health
  - `validateOrderCollateralization()` - Check if order maintains balance
  - `checkArbitrage()` - Detect profit opportunities
  - `calculateFairPrice()` - Compute equilibrium price
  - `getCollateralizationStatus()` - Market balance check

### API Routes
- **[src/routes/orders.ts](src/routes/orders.ts)** - REST endpoints
  - `POST /api/orders/place` - Place order
  - `GET /api/orders/:id` - Get order
  - `GET /api/orders/user/:address` - User orders
  - `GET /api/orders/market/:marketId` - Orderbook
  - `GET /api/orders/market/:marketId/prices` - Prices
  - `DELETE /api/orders/:id` - Cancel order

### WebSocket
- **[src/server.ts](src/server.ts)** - Real-time updates
  - `subscribe` - Subscribe to orderbook
  - `unsubscribe` - Unsubscribe
  - Broadcasts orderbook updates in real-time

### Documentation
- **[CLOB_IMPLEMENTATION.md](CLOB_IMPLEMENTATION.md)** - Full documentation
- **[examples/clobExample.ts](examples/clobExample.ts)** - Test scenarios

## API Examples

### Place a BUY Order
```bash
curl -X POST http://localhost:3001/api/orders/place \
  -H "Content-Type: application/json" \
  -d '{
    "marketId": "market-uuid",
    "makerAddress": "0x1111...",
    "side": "BUY",
    "outcome": "YES",
    "amount": 100,
    "price": 0.65
  }'
```

**Response:**
- Order is added to book
- Matching engine tries to fill
- Returns order ID and match count

### Place a SELL Order
```bash
curl -X POST http://localhost:3001/api/orders/place \
  -H "Content-Type: application/json" \
  -d '{
    "marketId": "market-uuid",
    "makerAddress": "0x2222...",
    "side": "SELL",
    "outcome": "YES",
    "amount": 100,
    "price": 0.65
  }'
```

### Get Market Prices
```bash
curl http://localhost:3001/api/orders/market/market-uuid/prices
```

**Response:**
```json
{
  "prices": {
    "yes": {
      "midPrice": 0.65,
      "bestBid": 0.64,
      "bestAsk": 0.66
    },
    "no": {
      "midPrice": 0.35,
      "bestBid": 0.34,
      "bestAsk": 0.36
    }
  },
  "collateralizationCheck": {
    "isValid": true,
    "sum": 1.00
  }
}
```

### Get Orderbook
```bash
curl http://localhost:3001/api/orders/market/market-uuid
```

### Get User Orders
```bash
curl http://localhost:3001/api/orders/user/0x1111...
```

### Cancel Order
```bash
curl -X DELETE http://localhost:3001/api/orders/order-id
```

## WebSocket Examples

### Subscribe to Orderbook
```javascript
const ws = new WebSocket('ws://localhost:3001');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    marketId: 'market-uuid',
    outcome: 'YES'
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'orderbook_update') {
    console.log('Updated orderbook:', msg.update);
  }
};
```

## Order Matching Logic

1. **New order arrives** → Added to order book
2. **Find compatible orders**:
   - Opposite side (BUY vs SELL)
   - Same outcome (YES or NO)
   - Price works (buyer ≥ seller)
3. **Check collateralization**: YES + NO ≈ $1.00
4. **Sort by priority**: Best price, then FIFO
5. **Execute fills**: Match maker and taker
6. **Update status**: PENDING → FILLED/PARTIAL
7. **Broadcast**: Send update via WebSocket

## Collateralization Examples

✅ **Valid Market:**
- YES: $0.65, NO: $0.35 → Sum = $1.00 ✓

❌ **Invalid Market:**
- YES: $0.70, NO: $0.40 → Sum = $1.10 ✗

⚠️ **Tolerance:**
- Allows ±5% deviation to accommodate trading
- Range: $0.95 - $1.05

## Testing

Run example scenarios:
```bash
cd packages/backend
npm install
npm run dev

# In another terminal
npx ts-node examples/clobExample.ts
```

Scenarios:
1. **Basic Matching** - BUY meets SELL at same price
2. **Partial Fill** - Order partially matches
3. **Collateralization** - YES + NO = $1.00 verification
4. **Price Improvement** - Taker gets better price

## Status Values

- `PENDING` - Waiting to be filled
- `PARTIAL_FILLED` - Partially matched
- `FULLY_FILLED` - Completely matched
- `CANCELLED` - User cancelled
- `EXPIRED` - Order validity expired

## Order Properties

```typescript
{
  id: string,                    // Unique order ID
  marketId: string,              // Market UUID
  makerAddress: string,          // 0x address
  side: "BUY" | "SELL",
  outcome: "YES" | "NO",
  amount: number,                // Tokens to trade
  price: number,                 // 0 <= price <= 1
  collateral: number,            // USDC or tokens required
  status: OrderStatus,           // PENDING, FILLED, etc.
  filledAmount: number,          // Already matched
  remainingAmount: number,       // Still available
  createdAt: number,             // Unix timestamp (ms)
  expiresAt: number,             // Expiration time
  updatedAt: number              // Last update
}
```

## Key Concepts

### Order Matching
- Orders are stored separately by market and outcome
- BUY orders sorted by price (highest first)
- SELL orders sorted by price (lowest first)
- Compatible orders matched automatically

### Price Improvement
- Takers always get better price than their order
- Example: BUY at $0.70, but SELL at $0.65 → execute at $0.65

### Collateralization
- Ensures market integrity
- YES + NO = $1 prevents arbitrage
- Enforced on every match

### Persistence
- Orders saved to `.data/orders.json`
- Survives server restarts
- Can be migrated to database

## Next Steps

1. **Frontend Integration**:
   - Create order form UI
   - Display orderbook
   - Show market prices
   - WebSocket live updates

2. **Smart Contract Integration**:
   - EIP-712 order signing
   - On-chain settlement
   - Token transfers
   - Position tracking

3. **Advanced Features**:
   - Stop-loss orders
   - Take-profit orders
   - Order history
   - Trade statistics
   - Market maker incentives

## References

- **Polymarket Docs**: https://docs.polymarket.com/developers/CLOB/introduction
- **CTF Exchange**: https://github.com/Polymarket/ctf-exchange
- **Binary Options**: https://en.wikipedia.org/wiki/Binary_option
- **EIP-712**: https://eips.ethereum.org/EIPS/eip-712
