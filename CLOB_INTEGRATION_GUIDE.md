# CLOB Developer Integration Guide

## Quick Start

### 1. Install Dependencies
```bash
cd packages/backend
npm install
```

This will install the new `uuid` dependency needed for order IDs.

### 2. Start Backend
```bash
npm run dev
```

Server runs on `http://localhost:3001`

### 3. Test CLOB
```bash
# In another terminal
npx ts-node examples/clobExample.ts
```

You should see:
- ✅ Order placement
- ✅ Order matching
- ✅ Price collateralization
- ✅ Price improvement

---

## Integration Points

### For Frontend Developers

#### 1. Place an Order
```javascript
// src/services/api.ts or similar

export async function placeOrder(orderData: {
  marketId: string;
  makerAddress: string;
  side: 'BUY' | 'SELL';
  outcome: 'YES' | 'NO';
  amount: number;
  price: number;
}) {
  const response = await fetch('/api/orders/place', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData)
  });
  
  if (!response.ok) {
    throw new Error('Failed to place order');
  }
  
  return response.json();
}
```

#### 2. Get Market Prices
```javascript
export async function getMarketPrices(marketId: string) {
  const response = await fetch(`/api/orders/market/${marketId}/prices`);
  const data = await response.json();
  
  return {
    yes: {
      price: data.prices.yes.midPrice,
      bid: data.prices.yes.bestBid,
      ask: data.prices.yes.bestAsk
    },
    no: {
      price: data.prices.no.midPrice,
      bid: data.prices.no.bestBid,
      ask: data.prices.no.bestAsk
    },
    isValid: data.collateralizationCheck.isValid
  };
}
```

#### 3. Get Orderbook
```javascript
export async function getOrderbook(marketId: string, outcome?: 'YES' | 'NO') {
  const url = outcome 
    ? `/api/orders/market/${marketId}?outcome=${outcome}`
    : `/api/orders/market/${marketId}`;
  
  const response = await fetch(url);
  return response.json();
}
```

#### 4. Subscribe to Live Updates
```javascript
// src/hooks/useOrderbookSubscription.ts or similar

import { useEffect, useState } from 'react';

export function useOrderbookSubscription(marketId: string, outcome: 'YES' | 'NO') {
  const [orderbook, setOrderbook] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3001');

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({
        type: 'subscribe',
        marketId,
        outcome
      }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      
      if (msg.type === 'orderbook_update') {
        setOrderbook(msg.update);
      }
    };

    ws.onclose = () => {
      setConnected(false);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [marketId, outcome]);

  return { orderbook, connected };
}
```

#### 5. Create Order Form Component
```typescript
// src/components/OrderForm.tsx

import React, { useState } from 'react';
import { placeOrder } from '@/services/api';

interface OrderFormProps {
  marketId: string;
  userAddress: string;
}

export function OrderForm({ marketId, userAddress }: OrderFormProps) {
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [outcome, setOutcome] = useState<'YES' | 'NO'>('YES');
  const [amount, setAmount] = useState(100);
  const [price, setPrice] = useState(0.5);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await placeOrder({
        marketId,
        makerAddress: userAddress,
        side,
        outcome,
        amount: parseFloat(amount as any),
        price: parseFloat(price as any)
      });

      if (result.success) {
        console.log('Order placed successfully!', result);
        // Show success message
        // Reset form
      } else {
        console.error('Order failed:', result.error);
      }
    } catch (error) {
      console.error('Error placing order:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>Side</label>
        <select value={side} onChange={(e) => setSide(e.target.value as any)}>
          <option>BUY</option>
          <option>SELL</option>
        </select>
      </div>

      <div>
        <label>Outcome</label>
        <select value={outcome} onChange={(e) => setOutcome(e.target.value as any)}>
          <option>YES</option>
          <option>NO</option>
        </select>
      </div>

      <div>
        <label>Amount</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          step="1"
          min="1"
        />
      </div>

      <div>
        <label>Price ($)</label>
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          step="0.01"
          min="0"
          max="1"
        />
      </div>

      <button type="submit" disabled={loading}>
        {loading ? 'Placing...' : 'Place Order'}
      </button>
    </form>
  );
}
```

#### 6. Create Orderbook Display
```typescript
// src/components/Orderbook.tsx

import React from 'react';
import { useOrderbookSubscription } from '@/hooks/useOrderbookSubscription';

interface OrderbookProps {
  marketId: string;
  outcome: 'YES' | 'NO';
}

export function Orderbook({ marketId, outcome }: OrderbookProps) {
  const { orderbook, connected } = useOrderbookSubscription(marketId, outcome);

  if (!orderbook) {
    return <div>Loading orderbook...</div>;
  }

  return (
    <div className="orderbook">
      <h3>Orderbook - {outcome}</h3>
      <p>Status: {connected ? '🟢 Connected' : '🔴 Disconnected'}</p>

      <div className="asks">
        <h4>Sell Orders (Asks)</h4>
        <table>
          <thead>
            <tr>
              <th>Price</th>
              <th>Amount</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {orderbook.sellSide?.map((order, idx) => (
              <tr key={idx}>
                <td>${order.price.toFixed(3)}</td>
                <td>{order.remainingAmount}</td>
                <td>${(order.remainingAmount * order.price).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bids">
        <h4>Buy Orders (Bids)</h4>
        <table>
          <thead>
            <tr>
              <th>Price</th>
              <th>Amount</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {orderbook.buySide?.map((order, idx) => (
              <tr key={idx}>
                <td>${order.price.toFixed(3)}</td>
                <td>{order.remainingAmount}</td>
                <td>${(order.remainingAmount * order.price).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

### For Smart Contract Developers

#### 1. Add Settlement Integration

Future integration point in `orderMatchingService.ts`:

```typescript
// After order match:
async function settleOrder(match: MatchedOrders) {
  try {
    // Sign order on-chain
    const sig = await signOrder(match.maker);
    
    // Submit to Exchange contract
    const tx = await exchangeContract.settleOrders({
      makerOrder: match.maker,
      takerOrder: match.takers[0],
      signature: sig,
      executionPrice: match.executionPrice
    });
    
    // Wait for confirmation
    await tx.wait();
    
    // Update order status
    updateOrderStatus(match.maker.id, OrderStatus.FULLY_FILLED);
    
  } catch (error) {
    console.error('Settlement failed:', error);
  }
}
```

#### 2. EIP-712 Order Signing

```typescript
// Future: Add signature verification

const orderTypes = {
  Order: [
    { name: 'id', type: 'string' },
    { name: 'marketId', type: 'string' },
    { name: 'side', type: 'uint8' }, // 0=BUY, 1=SELL
    { name: 'outcome', type: 'uint8' }, // 0=YES, 1=NO
    { name: 'amount', type: 'uint256' },
    { name: 'price', type: 'uint256' },
    { name: 'createdAt', type: 'uint256' },
    { name: 'expiresAt', type: 'uint256' }
  ]
};

const signature = await signer._signTypedData(
  domain,
  orderTypes,
  order
);
```

---

## Backend Service Usage

### Import and Use Matching Engine

```typescript
import { OrderMatchingEngine } from './services/orderMatchingService';

const newOrder = { /* ... */ };
const existingOrders = orderBook.getOrders();

const matches = OrderMatchingEngine.matchOrder(
  newOrder,
  existingOrders
);

matches.forEach(match => {
  console.log(`Matched at $${match.executionPrice}`);
});
```

### Use Order Book Service

```typescript
import { getOrderBookService } from './services/orderBookService';

const orderBook = getOrderBookService();

// Add order
orderBook.addOrder(newOrder);

// Get prices
const prices = orderBook.getMarketPrices(marketId);
console.log(`YES: $${prices.yes.midPrice}`);
console.log(`NO: $${prices.no.midPrice}`);

// Get user orders
const userOrders = orderBook.getUserOrders(userAddress);
```

### Use Collateralization Validator

```typescript
import { CollateralizationValidator } from './services/collateralizationValidator';

// Validate order
const check = CollateralizationValidator.validateOrderCollateralization(order, marketId);
if (!check.isValid) {
  throw new Error(`Collateralization failed: ${check.error}`);
}

// Check market status
const status = CollateralizationValidator.getCollateralizationStatus(marketId);
console.log(`Market balance: ${status.balance}`);
```

---

## Configuration

### Environment Variables
Add to `.env`:

```env
# Existing
RPC_URL=
ADMIN_PRIVATE_KEY=
UMA_CTF_ADAPTER_ADDRESS=
CONDITIONAL_TOKENS_ADDRESS=
REWARD_TOKEN_ADDRESS=
REWARD_AMOUNT=
PROPOSAL_BOND=
LIVENESS=

# CLOB (optional - uses defaults)
CLOB_ORDER_EXPIRY=86400000        # 24 hours in ms
CLOB_COLLATERAL_TOLERANCE=0.05    # ±5% tolerance
CLOB_BROADCAST_INTERVAL=1000      # ms between broadcasts
```

---

## Error Handling

### Common Error Scenarios

```typescript
// 1. Invalid address
{
  success: false,
  error: 'Invalid maker address'
}

// 2. Price out of range
{
  success: false,
  error: 'Price must be between 0 and 1'
}

// 3. Order already filled
{
  success: false,
  error: 'Order not found'
}

// 4. Collateralization failed
{
  success: false,
  error: 'Collateralization check failed: sum is 1.15, expected ~1.0'
}
```

---

## Performance Tips

### 1. Order Matching
- Limit order book size with pagination
- Archive old orders regularly
- Use indexed queries for large datasets

### 2. WebSocket
- Implement reconnection logic client-side
- Rate limit updates (e.g., max 1 per 100ms)
- Clean up subscriptions on disconnect

### 3. Storage
- Consider database migration for production
- Implement caching for price queries
- Use batch inserts for bulk operations

---

## Testing Checklist

- [ ] Order creation with valid inputs
- [ ] Order matching with compatible orders
- [ ] Price improvement calculation
- [ ] Collateralization validation
- [ ] WebSocket subscriptions
- [ ] Order cancellation
- [ ] User order history
- [ ] Market price calculations
- [ ] Error handling
- [ ] Persistence and restart

---

## Troubleshooting

### Orders Not Matching
1. Check price compatibility (buyer ≥ seller)
2. Verify same outcome (both YES or both NO)
3. Check collateralization tolerance
4. Review server logs

### WebSocket Not Updating
1. Verify connection (ws.readyState === 1)
2. Check subscription format
3. Review console for errors
4. Test with example script

### Persistence Issues
1. Check `.data/` directory exists
2. Verify file permissions
3. Check disk space
4. Review error logs

---

## Next Integration Steps

1. **Frontend**: Add order form and orderbook display
2. **WebSocket**: Set up real-time updates in UI
3. **Smart Contracts**: Implement EIP-712 signing
4. **Settlement**: Add on-chain order execution
5. **Analytics**: Build trading dashboard

---

## Support

For issues or questions:

1. Check [CLOB_IMPLEMENTATION.md](../CLOB_IMPLEMENTATION.md) for detailed docs
2. Review [CLOB_QUICK_REFERENCE.md](../CLOB_QUICK_REFERENCE.md) for API reference
3. Run [examples/clobExample.ts](../examples/clobExample.ts) for test scenarios
4. Check backend logs for error details

---

## Further Reading

- **Order Matching Theory**: https://en.wikipedia.org/wiki/Order_matching_engine
- **Polymarket Docs**: https://docs.polymarket.com/developers/CLOB/introduction
- **Binary Options**: https://en.wikipedia.org/wiki/Binary_option
- **Market Microstructure**: https://en.wikipedia.org/wiki/Market_microstructure

---

**Happy Ordering! 🚀**
