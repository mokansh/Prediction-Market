# CLOB (Central Limit Order Book) Implementation

## Overview

This is a hybrid-decentralized order book system inspired by Polymarket's CLOB, with off-chain order matching and on-chain settlement capabilities. The system enforces strict collateralization rules to ensure market integrity.

**Reference**: https://docs.polymarket.com/developers/CLOB/introduction

## Core Principles

### 1. Collateralization Rule

The fundamental rule of the system:

$$\text{YES Price} + \text{NO Price} = \$1.00$$

This means:
- If YES is trading at $0.65, NO must be priced at $0.35
- Total value of all possible outcomes always equals $1
- Markets are fully collateralized against their underlying asset

### 2. Order Types

All orders are **limit orders** (can be marketable):
- **BUY**: Purchase outcome tokens with collateral (USDC)
- **SELL**: Sell outcome tokens for collateral (USDC)

### 3. Matching Engine

Orders are matched by a centralized operator:
- One maker order can be matched with multiple taker orders
- Takers receive price improvement
- Matching is deterministic and follows price/time priority

## Architecture

### Services

#### 1. **OrderMatchingEngine** (`orderMatchingService.ts`)
Handles order matching logic:
- Matches compatible orders (BUY vs SELL, same outcome)
- Enforces price compatibility
- Validates collateralization
- Calculates execution prices with taker improvement
- Generates order IDs

**Key Methods:**
```typescript
matchOrder() // Match new order against existing orders
calculateCollateralization() // Check YES + NO = 1.0
calculatePayoff() // Calculate PnL from order
calculateRequiredCollateral() // Determine collateral needed
```

#### 2. **OrderBookService** (`orderBookService.ts`)
Manages persistent order book state:
- Stores orders by market and outcome (YES/NO)
- Maintains separate buy and sell sides
- Tracks user positions
- Persists to JSON file (can be replaced with database)
- Handles order cancellation and status updates

**Key Methods:**
```typescript
addOrder() // Add new order to book
getOrderBook() // Retrieve order book snapshot
getMarketPrices() // Get bid/ask/mid prices
cancelOrder() // Cancel an order
getUserOrders() // Get user's orders
```

#### 3. **CollateralizationValidator** (`collateralizationValidator.ts`)
Validates market integrity:
- Ensures YES + NO ≈ 1.0 (±5% tolerance)
- Checks for arbitrage opportunities
- Calculates fair prices for tokens
- Monitors market balance
- Simulates order impact

**Key Methods:**
```typescript
validateOrderCollateralization() // Check if order maintains balance
checkArbitrage() // Detect profit opportunities
calculateFairPrice() // Compute equilibrium price
getCollateralizationStatus() // Market health check
```

### API Endpoints

#### Order Management

```
POST /api/orders/place
```
Place a new limit or market order.

**Request:**
```json
{
  "marketId": "market-uuid",
  "makerAddress": "0x...",
  "side": "BUY|SELL",
  "outcome": "YES|NO",
  "amount": 100,
  "price": 0.65,
  "expiresIn": 3600000
}
```

**Response:**
```json
{
  "success": true,
  "order": {
    "id": "order-id",
    "marketId": "market-uuid",
    "makerAddress": "0x...",
    "side": "BUY",
    "outcome": "YES",
    "amount": 100,
    "price": 0.65,
    "status": "PENDING",
    "filledAmount": 0,
    "remainingAmount": 100,
    "createdAt": 1234567890,
    "expiresAt": 1234571490
  },
  "matches": 0
}
```

---

```
GET /api/orders/:id
```
Get order details.

**Response:**
```json
{
  "success": true,
  "order": { /* Order object */ }
}
```

---

```
GET /api/orders/user/:address
```
Get all orders for a user.

**Response:**
```json
{
  "success": true,
  "orders": [ /* Order array */ ],
  "count": 5
}
```

---

```
GET /api/orders/market/:marketId
GET /api/orders/market/:marketId?outcome=YES
```
Get order book for a market.

**Response:**
```json
{
  "success": true,
  "orderbooks": {
    "yes": {
      "marketId": "market-uuid",
      "outcome": "YES",
      "buySide": [ /* Orders sorted by price desc */ ],
      "sellSide": [ /* Orders sorted by price asc */ ],
      "lastUpdateTime": 1234567890
    },
    "no": { /* NO outcome orderbook */ }
  }
}
```

---

```
GET /api/orders/market/:marketId/prices
```
Get market prices with collateralization check.

**Response:**
```json
{
  "success": true,
  "prices": {
    "yes": {
      "outcome": "YES",
      "midPrice": 0.65,
      "bestBid": 0.64,
      "bestAsk": 0.66,
      "lastUpdate": 1234567890
    },
    "no": {
      "outcome": "NO",
      "midPrice": 0.35,
      "bestBid": 0.34,
      "bestAsk": 0.36,
      "lastUpdate": 1234567890
    }
  },
  "collateralizationCheck": {
    "isValid": true,
    "yesPrice": 0.65,
    "noPrice": 0.35,
    "sum": 1.00
  }
}
```

---

```
DELETE /api/orders/:id
```
Cancel an order.

**Response:**
```json
{
  "success": true,
  "message": "Order cancelled"
}
```

### WebSocket API

Real-time orderbook updates via WebSocket.

**Connect:**
```javascript
const ws = new WebSocket('ws://localhost:3001');

// Send subscription message
ws.send(JSON.stringify({
  type: 'subscribe',
  marketId: 'market-uuid',
  outcome: 'YES'  // optional
}));

// Receive updates
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  
  if (msg.type === 'orderbook_update') {
    // Update orderbook in UI
  } else if (msg.type === 'subscribed') {
    console.log('Subscribed to', msg.channel);
  }
};
```

## Data Structures

### Order
```typescript
interface Order {
  id: string;
  marketId: string;
  makerAddress: string;
  side: OrderSide;           // BUY or SELL
  outcome: OutcomeType;      // YES or NO
  amount: number;            // Total tokens/USDC
  price: number;             // 0 <= price <= 1
  collateral: number;        // Required USDC or tokens
  status: OrderStatus;       // PENDING, FILLED, CANCELLED, etc.
  filledAmount: number;      // Already filled
  remainingAmount: number;   // Still to fill
  createdAt: number;
  expiresAt: number;
  updatedAt: number;
}
```

### OrderBook
```typescript
interface OrderBook {
  marketId: string;
  outcome: OutcomeType;
  buySide: Order[];          // Sorted by price desc
  sellSide: Order[];         // Sorted by price asc
  lastUpdateTime: number;
}
```

### MarketPrice
```typescript
interface MarketPrice {
  marketId: string;
  outcome: OutcomeType;
  midPrice: number;          // (bid + ask) / 2
  bestBid: number;           // Highest buy
  bestAsk: number;           // Lowest sell
  lastUpdate: number;
}
```

## Order Matching Algorithm

### Matching Process

1. **New order received** → add to order book
2. **Find compatible orders**:
   - Opposite side (BUY vs SELL)
   - Same outcome (YES or NO)
   - Price compatibility (buyer price ≥ seller price)
3. **Check collateralization** → YES + NO ≈ 1.0
4. **Sort by priority**:
   - For buyers: sort sellers by price (ascending)
   - For sellers: sort buyers by price (descending)
5. **Execute fills**:
   - Calculate fill amount
   - Determine execution price (taker improvement)
   - Update order status (FILLED, PARTIAL_FILLED)
6. **Broadcast update** → via WebSocket

### Price Improvement

Takers always get the best price:
- **BUY order**: Pays minimum of (order price, maker price)
- **SELL order**: Receives maximum of (order price, maker price)

### Collateralization Validation

For each match, verify:
$$0.95 \leq P_{\text{YES}} + P_{\text{NO}} \leq 1.05$$

Tolerance range accounts for market dynamics while preventing extreme imbalances.

## State Persistence

Orders are persisted to `.data/orders.json`:
- Survives server restarts
- Supports backup/recovery
- Can be migrated to database

**File Structure:**
```json
{
  "orders": [ /* All orders */ ],
  "orderBooks": [ /* Order books by market */ ],
  "userOrders": { /* user -> order IDs mapping */ }
}
```

## Key Features

### ✅ Implemented

- [x] Order types and interfaces
- [x] Order matching engine with collateralization rules
- [x] Order book management with persistence
- [x] REST API for order operations
- [x] WebSocket support for real-time updates
- [x] Collateralization validation
- [x] Order status tracking
- [x] User order history

### 🚀 Future Enhancements

- [ ] On-chain settlement (smart contract execution)
- [ ] Order signature verification (EIP-712)
- [ ] Advanced order types (stop-loss, take-profit)
- [ ] Market maker incentives/rebates
- [ ] Order history/audit trail
- [ ] Performance metrics dashboard
- [ ] API rate limiting
- [ ] Database migration (PostgreSQL/MongoDB)
- [ ] Liquidation protection
- [ ] Multi-market aggregation

## Example Usage

### Creating an Order

```bash
curl -X POST http://localhost:3001/api/orders/place \
  -H "Content-Type: application/json" \
  -d '{
    "marketId": "market-123",
    "makerAddress": "0x1234567890123456789012345678901234567890",
    "side": "BUY",
    "outcome": "YES",
    "amount": 100,
    "price": 0.65
  }'
```

### Getting Market Prices

```bash
curl http://localhost:3001/api/orders/market/market-123/prices
```

### Subscribing to Updates

```javascript
const ws = new WebSocket('ws://localhost:3001');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    marketId: 'market-123',
    outcome: 'YES'
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'orderbook_update') {
    console.log('New orderbook:', msg.update);
  }
};
```

## Testing

To test the CLOB:

```bash
# Start backend
cd packages/backend
npm run dev

# In another terminal, place an order
curl -X POST http://localhost:3001/api/orders/place \
  -H "Content-Type: application/json" \
  -d '{
    "marketId": "test-market",
    "makerAddress": "0x1111111111111111111111111111111111111111",
    "side": "BUY",
    "outcome": "YES",
    "amount": 100,
    "price": 0.65
  }'

# Check orderbook
curl http://localhost:3001/api/orders/market/test-market

# Check prices
curl http://localhost:3001/api/orders/market/test-market/prices
```

## References

- **Polymarket Docs**: https://docs.polymarket.com/developers/CLOB/introduction
- **CTF Exchange Contract**: https://github.com/Polymarket/ctf-exchange
- **EIP-712 Signing**: https://eips.ethereum.org/EIPS/eip-712
- **Binary Options Pricing**: https://en.wikipedia.org/wiki/Binary_option

## License

This implementation follows the Polymarket model and is subject to the same licensing terms.
