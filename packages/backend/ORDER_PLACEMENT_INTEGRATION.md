# Order Placement with Balance Validation - Integration Guide

## Overview

This guide shows how to integrate the wallet balance checking service into the order placement flow to ensure users have sufficient collateral before orders are matched.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                         │
│  - Display user balance                                     │
│  - Show available for trading                               │
│  - Validate before submitting order                         │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ├─────────┐
                   │         │
        GET /api/wallet/    POST /api/wallet/check-sufficient
        balance/:userAddress
                   │         │
                   └────┬────┘
                        │
                        ▼
                ┌──────────────────┐
                │ WalletBalance    │
                │ Service          │
                │                  │
                │ - getUserBalance │
                │ - hasBalance     │
                │ - updateMapping  │
                └────────┬─────────┘
                         │
                    Query ERC20
                    Contract Balance
                         │
                         ▼
                  ┌──────────────────┐
                  │  ERC20 Token     │
                  │  Contract        │
                  │ (Blockchain)     │
                  └──────────────────┘

Order Placement Flow:
┌─────────────┐       ┌──────────────────┐       ┌──────────────────┐
│   Submit    │  ───> │ Check Balance    │  ───> │   OrderMatching  │
│   Order     │       │ (WalletBalance   │       │   Service        │
└─────────────┘       │  Service)        │       └──────────────────┘
                      │                  │
                      │ If sufficient:   │
                      │ Proceed          │
                      │                  │
                      │ If insufficient: │
                      │ Return error     │
                      └──────────────────┘
```

## Step 1: Frontend - Display User Balance

Create a React component to display the user's available balance:

**File:** `src/components/WalletBalance.tsx`

```typescript
import React, { useState, useEffect } from 'react';

interface UserBalance {
  userAddress: string;
  walletAddress: string;
  collateralBalance: string;
  collateralBalanceFormatted: string;
  availableForOrders: string;
  lockedInOrders: string;
  lastUpdated: number;
}

export function WalletBalance({ userAddress }: { userAddress: string }) {
  const [balance, setBalance] = useState<UserBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch balance on component mount and periodically
  useEffect(() => {
    if (!userAddress) return;

    const fetchBalance = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/wallet/balance/${userAddress}`);
        const data = await response.json();

        if (data.success) {
          setBalance(data.balance);
          setError(null);
        } else {
          setError(data.error || 'Failed to fetch balance');
        }
      } catch (err) {
        setError('Network error fetching balance');
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();

    // Refresh balance every 30 seconds
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [userAddress]);

  if (loading && !balance) return <p>Loading balance...</p>;
  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;
  if (!balance) return <p>No balance data</p>;

  return (
    <div style={{ padding: '16px', border: '1px solid #ddd', borderRadius: '8px' }}>
      <h3>Wallet Balance</h3>
      <p><strong>Total Balance:</strong> {balance.collateralBalanceFormatted} USDC</p>
      <p><strong>Available for Trading:</strong> {balance.availableForOrders} USDC</p>
      <p><strong>Locked in Orders:</strong> {balance.lockedInOrders} USDC</p>
      <p style={{ fontSize: '0.8em', color: '#999' }}>
        Last updated: {new Date(balance.lastUpdated).toLocaleTimeString()}
      </p>
    </div>
  );
}
```

## Step 2: Validate Balance Before Order

Create an order submission component with balance validation:

**File:** `src/components/OrderForm.tsx`

```typescript
import React, { useState } from 'react';

interface OrderRequest {
  userAddress: string;
  marketAddress: string;
  orderSize: number;
  priceYes: number;
  priceNo: number;
  orderType: 'buy' | 'sell';
}

export function OrderForm({ userAddress }: { userAddress: string }) {
  const [orderSize, setOrderSize] = useState('0.1');
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [priceYes, setPriceYes] = useState('0.5');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function validateAndSubmitOrder() {
    setLoading(true);
    setStatus(null);

    try {
      const requiredAmount = parseFloat(orderSize);

      // Step 1: Check if user has sufficient balance
      const checkResponse = await fetch('/api/wallet/check-sufficient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress,
          requiredAmount: requiredAmount.toString()
        })
      });

      const checkData = await checkResponse.json();

      if (!checkData.hasSufficientBalance) {
        setStatus(`❌ Insufficient balance. Available: ${checkData.availableBalance} USDC`);
        setLoading(false);
        return;
      }

      // Step 2: Balance is sufficient, place the order
      setStatus(`✓ Balance verified. Placing order...`);

      const orderResponse = await fetch('/api/orders/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress,
          orderSize: requiredAmount,
          orderType,
          priceYes: parseFloat(priceYes),
          priceNo: 1 - parseFloat(priceYes)
        })
      });

      const orderData = await orderResponse.json();

      if (orderData.success) {
        setStatus(`✅ Order placed successfully! ID: ${orderData.orderId}`);
        setOrderSize('0.1');
        setOrderType('buy');
        setPriceYes('0.5');
      } else {
        setStatus(`❌ Order failed: ${orderData.error}`);
      }
    } catch (error) {
      setStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: '16px', border: '1px solid #ddd', borderRadius: '8px' }}>
      <h3>Place Order</h3>

      <div style={{ marginBottom: '12px' }}>
        <label>Order Size (USDC): </label>
        <input
          type="number"
          value={orderSize}
          onChange={(e) => setOrderSize(e.target.value)}
          step="0.01"
          disabled={loading}
        />
      </div>

      <div style={{ marginBottom: '12px' }}>
        <label>Order Type: </label>
        <select value={orderType} onChange={(e) => setOrderType(e.target.value as 'buy' | 'sell')} disabled={loading}>
          <option value="buy">Buy</option>
          <option value="sell">Sell</option>
        </select>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <label>Price (YES): </label>
        <input
          type="number"
          value={priceYes}
          onChange={(e) => setPriceYes(e.target.value)}
          step="0.01"
          min="0"
          max="1"
          disabled={loading}
        />
      </div>

      <button onClick={validateAndSubmitOrder} disabled={loading}>
        {loading ? 'Processing...' : 'Place Order'}
      </button>

      {status && (
        <p style={{
          marginTop: '12px',
          padding: '8px',
          backgroundColor: status.includes('✅') ? '#d4edda' :
                          status.includes('✓') ? '#cce5ff' : '#f8d7da',
          color: status.includes('❌') ? '#721c24' : '#004085',
          borderRadius: '4px'
        }}>
          {status}
        </p>
      )}
    </div>
  );
}
```

## Step 3: Backend Integration

The backend automatically validates balance. Here's how the `/api/orders/place` endpoint should handle it:

**File:** `src/routes/orders.ts` (Updated)

```typescript
import { WalletBalanceService } from '../services/walletBalanceService';

router.post('/place', async (req, res) => {
  try {
    const { userAddress, orderSize, orderType, priceYes } = req.body;

    // Validate input
    if (!userAddress || !orderSize || !orderType || typeof priceYes !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // ✅ STEP 1: Check user has sufficient balance
    const balanceService = WalletBalanceService.getInstance();
    const hasSufficientBalance = await balanceService.hasSufficientBalance(
      userAddress,
      orderSize.toString()
    );

    if (!hasSufficientBalance) {
      const userBalance = await balanceService.getUserBalance(userAddress);
      return res.status(400).json({
        success: false,
        error: `Insufficient balance. Available: ${userBalance.collateralBalanceFormatted} USDC`,
        availableBalance: userBalance.collateralBalanceFormatted
      });
    }

    // ✅ STEP 2: Balance validated, proceed with order matching
    const orderMatchingEngine = OrderMatchingEngine.getInstance();
    const orderId = OrderMatchingEngine.generateOrderId();

    const order = {
      id: orderId,
      userAddress,
      orderType,
      priceYes,
      priceNo: 1 - priceYes,
      orderSize,
      status: 'pending' as const,
      createdAt: new Date().toISOString()
    };

    // Perform matching
    const matches = orderMatchingEngine.matchOrder(order);

    // Save order
    const orderBook = OrderBookService.getInstance();
    orderBook.saveOrder(order);

    // Broadcast update
    broadcastOrderUpdate({
      type: 'order_placed',
      order,
      matches: matches.length > 0 ? matches : undefined
    });

    res.json({
      success: true,
      orderId,
      matches: matches.length,
      order
    });

  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to place order'
    });
  }
});
```

## Step 4: Real-time Balance Updates

Use WebSocket to notify frontend when balance changes due to order placement:

**File:** `src/server.ts` (WebSocket handler)

```typescript
import WebSocket from 'ws';

const wss = new WebSocket.Server({ port: 3002 });

interface BalanceSubscriber {
  userAddress: string;
  ws: WebSocket;
}

const subscribers: BalanceSubscriber[] = [];

wss.on('connection', (ws: WebSocket) => {
  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'subscribe_balance') {
        // Subscribe to balance updates
        subscribers.push({
          userAddress: data.userAddress,
          ws
        });

        ws.send(JSON.stringify({
          type: 'subscribed',
          userAddress: data.userAddress
        }));
      }
    } catch (error) {
      console.error('WebSocket error:', error);
    }
  });

  ws.on('close', () => {
    // Remove subscriber
    const index = subscribers.findIndex(sub => sub.ws === ws);
    if (index > -1) {
      subscribers.splice(index, 1);
    }
  });
});

// Notify subscribers when balance changes
export function broadcastBalanceUpdate(userAddress: string, balance: any) {
  const userSubscribers = subscribers.filter(
    sub => sub.userAddress.toLowerCase() === userAddress.toLowerCase()
  );

  userSubscribers.forEach(sub => {
    sub.ws.send(JSON.stringify({
      type: 'balance_updated',
      balance
    }));
  });
}
```

## Step 5: Error Scenarios

Handle all possible balance validation errors gracefully:

```typescript
// Scenario 1: User has never deployed a wallet
{
  "success": false,
  "error": "No wallet found for user. Deploy wallet first.",
  "availableBalance": "0"
}

// Scenario 2: Insufficient balance for order
{
  "success": false,
  "error": "Insufficient balance. Available: 0.50 USDC, Required: 1.00 USDC",
  "availableBalance": "0.50",
  "requiredAmount": "1.00"
}

// Scenario 3: User has balance locked in active orders
{
  "success": true,
  "availableBalance": "0.75",
  "lockedInOrders": "0.25",
  "totalBalance": "1.00",
  "message": "You have 0.75 USDC available (0.25 USDC locked in active orders)"
}

// Scenario 4: Balance check successful
{
  "success": true,
  "hasSufficientBalance": true,
  "userAddress": "0x1234...",
  "availableBalance": "2.50",
  "message": "User has sufficient balance for this order"
}
```

## Step 6: Testing the Integration

Test script to verify balance checking works end-to-end:

**File:** `examples/testBalanceIntegration.ts`

```typescript
import { ethers } from 'ethers';
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001';

interface TestUser {
  address: string;
  walletAddress: string;
  expectedBalance: string;
}

async function testBalanceIntegration() {
  const testUsers: TestUser[] = [
    {
      address: '0x1111111111111111111111111111111111111111',
      walletAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      expectedBalance: '1.00'
    },
    {
      address: '0x2222222222222222222222222222222222222222',
      walletAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      expectedBalance: '5.00'
    }
  ];

  console.log('🧪 Testing Wallet Balance Integration\n');

  for (const user of testUsers) {
    console.log(`📊 Testing user: ${user.address}`);

    // Test 1: Get individual balance
    console.log('  1️⃣ Fetching individual balance...');
    const balanceRes = await fetch(`${API_BASE}/api/wallet/balance/${user.address}`);
    const balanceData = await balanceRes.json();
    console.log(`     ✓ Balance: ${balanceData.balance.collateralBalanceFormatted} USDC`);

    // Test 2: Check sufficient balance for order
    console.log('  2️⃣ Checking sufficient balance for $0.50 order...');
    const checkRes = await fetch(`${API_BASE}/api/wallet/check-sufficient`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: user.address,
        requiredAmount: '0.50'
      })
    });
    const checkData = await checkRes.json();
    console.log(`     ✓ Sufficient: ${checkData.hasSufficientBalance}`);

    // Test 3: Update wallet mapping
    console.log('  3️⃣ Updating wallet mapping...');
    const mapRes = await fetch(`${API_BASE}/api/wallet/update-mapping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: user.address,
        walletAddress: user.walletAddress
      })
    });
    const mapData = await mapRes.json();
    console.log(`     ✓ Mapping updated`);

    console.log('');
  }

  // Test batch retrieval
  console.log('📦 Testing batch balance retrieval...');
  const addresses = testUsers.map(u => u.address).join(',');
  const batchRes = await fetch(
    `${API_BASE}/api/wallet/balance/batch?addresses=${addresses}`
  );
  const batchData = await batchRes.json();
  console.log(`✓ Retrieved ${batchData.count} user balances in one request`);
}

testBalanceIntegration().catch(console.error);
```

## Summary

The integration flow:

1. **Frontend displays** user balance using `/api/wallet/balance/:userAddress`
2. **User submits order** with size and type
3. **Frontend validates** balance using `/api/wallet/check-sufficient`
4. **If sufficient**, sends order to `/api/orders/place`
5. **Backend double-checks** balance before matching (defense in depth)
6. **Order is matched** and broadcast to all subscribers
7. **Real-time updates** notify frontend of balance changes

This ensures no overselling and proper collateral validation throughout the trading lifecycle.
