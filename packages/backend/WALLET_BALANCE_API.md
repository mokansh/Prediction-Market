# Wallet Balance API - User Guide

## Overview

The Wallet Balance API allows you to check user collateral token balances directly from their multisig wallets. This enables order placement validation and balance verification.

## API Endpoints

### 1. Get User Balance

**Endpoint:** `GET /api/wallet/balance/:userAddress`

Get the collateral token balance for a specific user's multisig wallet.

**Parameters:**
- `userAddress` (path, required): User's Ethereum address
- `walletAddress` (query, optional): Specific multisig wallet address

**Example Request:**
```bash
curl http://localhost:3001/api/wallet/balance/0x1111111111111111111111111111111111111111
```

**Example Response:**
```json
{
  "success": true,
  "balance": {
    "userAddress": "0x1111111111111111111111111111111111111111",
    "walletAddress": "0x2222222222222222222222222222222222222222",
    "collateralBalance": "1000000000000000000",
    "collateralBalanceFormatted": "1.00",
    "availableForOrders": "1.00",
    "lockedInOrders": "0",
    "lastUpdated": 1705250000000
  },
  "timestamp": "2026-01-14T12:00:00.000Z"
}
```

**Fields:**
- `collateralBalance`: Raw token balance (in wei/smallest unit)
- `collateralBalanceFormatted`: Formatted balance (in full units, e.g., USDC)
- `availableForOrders`: Balance available for placing new orders
- `lockedInOrders`: Balance locked in active orders

---

### 2. Get Multiple User Balances (Batch)

**Endpoint:** `GET /api/wallet/balance/batch`

Get balances for multiple users in one request.

**Query Parameters:**
- `addresses` (required): Comma-separated list of Ethereum addresses

**Example Request:**
```bash
curl "http://localhost:3001/api/wallet/balance/batch?addresses=0x1111111111111111111111111111111111111111,0x2222222222222222222222222222222222222222"
```

**Example Response:**
```json
{
  "success": true,
  "count": 2,
  "balances": [
    {
      "userAddress": "0x1111111111111111111111111111111111111111",
      "walletAddress": "0x3333333333333333333333333333333333333333",
      "collateralBalance": "1000000000000000000",
      "collateralBalanceFormatted": "1.00",
      "availableForOrders": "1.00",
      "lockedInOrders": "0",
      "lastUpdated": 1705250000000
    },
    {
      "userAddress": "0x2222222222222222222222222222222222222222",
      "walletAddress": "0x4444444444444444444444444444444444444444",
      "collateralBalance": "5000000000000000000",
      "collateralBalanceFormatted": "5.00",
      "availableForOrders": "5.00",
      "lockedInOrders": "0",
      "lastUpdated": 1705250001000
    }
  ],
  "timestamp": "2026-01-14T12:00:00.000Z"
}
```

---

### 3. Check Sufficient Balance for Order

**Endpoint:** `POST /api/wallet/check-sufficient`

Validate if a user has sufficient collateral for placing an order.

**Request Body:**
```json
{
  "userAddress": "0x1111111111111111111111111111111111111111",
  "requiredAmount": "0.50",
  "walletAddress": "0x2222222222222222222222222222222222222222"
}
```

**Parameters:**
- `userAddress` (required): User's Ethereum address
- `requiredAmount` (required): Amount needed (in full units, e.g., USDC)
- `walletAddress` (optional): Specific multisig wallet address

**Example Request:**
```bash
curl -X POST http://localhost:3001/api/wallet/check-sufficient \
  -H "Content-Type: application/json" \
  -d '{
    "userAddress": "0x1111111111111111111111111111111111111111",
    "requiredAmount": "0.50"
  }'
```

**Example Response (Sufficient):**
```json
{
  "success": true,
  "userAddress": "0x1111111111111111111111111111111111111111",
  "requiredAmount": "0.50",
  "availableBalance": "1.00",
  "hasSufficientBalance": true,
  "message": "User has sufficient balance for this order",
  "timestamp": "2026-01-14T12:00:00.000Z"
}
```

**Example Response (Insufficient):**
```json
{
  "success": true,
  "userAddress": "0x1111111111111111111111111111111111111111",
  "requiredAmount": "2.00",
  "availableBalance": "1.00",
  "hasSufficientBalance": false,
  "message": "Insufficient balance for this order",
  "timestamp": "2026-01-14T12:00:00.000Z"
}
```

---

### 4. Update Wallet Address Mapping

**Endpoint:** `POST /api/wallet/update-mapping`

Link a user address to their multisig wallet address.

**Request Body:**
```json
{
  "userAddress": "0x1111111111111111111111111111111111111111",
  "walletAddress": "0x2222222222222222222222222222222222222222"
}
```

**Example Request:**
```bash
curl -X POST http://localhost:3001/api/wallet/update-mapping \
  -H "Content-Type: application/json" \
  -d '{
    "userAddress": "0x1111111111111111111111111111111111111111",
    "walletAddress": "0x2222222222222222222222222222222222222222"
  }'
```

**Example Response:**
```json
{
  "success": true,
  "message": "Wallet mapping updated successfully",
  "userAddress": "0x1111111111111111111111111111111111111111",
  "walletAddress": "0x2222222222222222222222222222222222222222",
  "balance": {
    "userAddress": "0x1111111111111111111111111111111111111111",
    "walletAddress": "0x2222222222222222222222222222222222222222",
    "collateralBalance": "1000000000000000000",
    "collateralBalanceFormatted": "1.00",
    "availableForOrders": "1.00",
    "lockedInOrders": "0",
    "lastUpdated": 1705250000000
  },
  "timestamp": "2026-01-14T12:00:00.000Z"
}
```

---

## Integration Examples

### JavaScript/TypeScript

```typescript
// Get user balance
async function getUserBalance(userAddress: string) {
  const response = await fetch(`/api/wallet/balance/${userAddress}`);
  const data = await response.json();
  
  if (data.success) {
    console.log(`User balance: ${data.balance.collateralBalanceFormatted}`);
    return data.balance;
  }
}

// Check if user can place order
async function canPlaceOrder(userAddress: string, orderSize: number) {
  const response = await fetch('/api/wallet/check-sufficient', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userAddress,
      requiredAmount: orderSize.toString()
    })
  });
  
  const data = await response.json();
  return data.hasSufficientBalance;
}

// Update wallet mapping after deployment
async function linkWallet(userAddress: string, walletAddress: string) {
  const response = await fetch('/api/wallet/update-mapping', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userAddress, walletAddress })
  });
  
  const data = await response.json();
  console.log(data.message);
}
```

### React Hook

```typescript
import { useState, useEffect } from 'react';

export function useUserBalance(userAddress?: string) {
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userAddress) return;

    setLoading(true);
    fetch(`/api/wallet/balance/${userAddress}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setBalance(data.balance.collateralBalanceFormatted);
        } else {
          setError(data.error);
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [userAddress]);

  return { balance, loading, error };
}

// Usage in component
function WalletDisplay({ userAddress }: { userAddress: string }) {
  const { balance, loading, error } = useUserBalance(userAddress);

  return (
    <div>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {balance && <p>Balance: {balance} USDC</p>}
    </div>
  );
}
```

---

## Error Responses

### Invalid Address Format
```json
{
  "success": false,
  "error": "Invalid user address format"
}
```

### Insufficient Balance
```json
{
  "success": true,
  "userAddress": "0x1111111111111111111111111111111111111111",
  "requiredAmount": "10.00",
  "availableBalance": "5.00",
  "hasSufficientBalance": false,
  "message": "Insufficient balance for this order"
}
```

### Server Error
```json
{
  "success": false,
  "error": "Failed to get balance"
}
```

---

## Best Practices

1. **Cache Balances:** Balance data changes frequently. Cache in frontend and refresh periodically.

```typescript
// Refresh balance every 30 seconds
useEffect(() => {
  const interval = setInterval(() => {
    getUserBalance(userAddress);
  }, 30000);
  return () => clearInterval(interval);
}, [userAddress]);
```

2. **Validate Before Order:** Always check sufficient balance before sending order requests.

```typescript
async function submitOrder(userAddress: string, orderSize: number) {
  const hasBalance = await canPlaceOrder(userAddress, orderSize);
  if (!hasBalance) {
    alert('Insufficient balance');
    return;
  }
  // Proceed with order placement
}
```

3. **Batch Updates:** Use batch endpoint when checking multiple users.

```typescript
// Instead of multiple individual calls
const balances = await Promise.all(
  addresses.map(addr => getUserBalance(addr))
);

// Use batch endpoint
const response = await fetch(
  `/api/wallet/balance/batch?addresses=${addresses.join(',')}`
);
const data = await response.json();
```

4. **Handle Network Delays:** Add loading states and error handling.

```typescript
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

async function checkBalance() {
  setLoading(true);
  setError(null);
  try {
    const response = await fetch(`/api/wallet/balance/${userAddress}`);
    const data = await response.json();
    if (!data.success) {
      setError(data.error);
    }
  } catch (err) {
    setError('Network error');
  } finally {
    setLoading(false);
  }
}
```

---

## Collateral Token Configuration

The service uses the `COLLATERAL_TOKEN` environment variable to determine which token to check balances for.

**Default:** USDC contract address on Polygon Amoy

**Environment Setup:**
```env
COLLATERAL_TOKEN=0x41E94cB5eB3092Bc577881a08e21A7ff090DcAa7  # USDC on Amoy
```

---

## FAQ

**Q: How often are balances updated?**  
A: Balances are fetched on-demand from the blockchain. Cache is updated each time you call the API.

**Q: What if a user has no wallet deployed?**  
A: The API returns zero balance. Update the wallet mapping after deployment.

**Q: Can I check balance without knowing the wallet address?**  
A: Yes, if you've previously called `update-mapping`, the system remembers the wallet address.

**Q: How is "available" balance different from "locked"?**  
A: Available = Total - Locked in active orders. Locked amounts are reserved for open orders.

---

## Summary

The Wallet Balance API provides:

✅ Real-time collateral balance checking  
✅ Multi-user batch queries  
✅ Balance validation for order placement  
✅ Wallet address mapping management  
✅ Persistent balance caching  

Use these endpoints to ensure users have sufficient collateral before placing orders.
