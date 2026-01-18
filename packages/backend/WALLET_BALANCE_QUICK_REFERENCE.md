# Wallet Balance Feature - Quick Reference

## Feature Overview
Display user's available collateral balance from their multisig wallet to enable order placement validation.

## What Was Built

### 1. WalletBalanceService (`src/services/walletBalanceService.ts`)
- **Purpose:** Query and manage user collateral balances from ERC20 tokens
- **Key Methods:**
  - `getUserBalance(userAddress)` → Returns `UserBalance` object
  - `hasSufficientBalance(userAddress, requiredAmount)` → Boolean
  - `updateWalletMapping(userAddress, walletAddress)` → Links user to wallet
  - `getBatchBalances(userAddresses)` → Bulk query multiple users

### 2. API Endpoints (in `src/routes/wallet.ts`)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/wallet/balance/:userAddress` | Get user's collateral balance |
| GET | `/api/wallet/balance/batch?addresses=...` | Batch get multiple balances |
| POST | `/api/wallet/check-sufficient` | Validate order can be placed |
| POST | `/api/wallet/update-mapping` | Link user address to wallet |

## Quick Start: Fetch User Balance

**JavaScript:**
```javascript
const response = await fetch('/api/wallet/balance/0x1234...');
const { balance } = await response.json();
console.log(`Available: ${balance.collateralBalanceFormatted} USDC`);
```

**React Hook:**
```typescript
const [balance, setBalance] = useState(null);
useEffect(() => {
  fetch(`/api/wallet/balance/${userAddress}`)
    .then(r => r.json())
    .then(d => setBalance(d.balance.collateralBalanceFormatted));
}, [userAddress]);
```

## Validation Before Order Placement

**Backend Route Example:**
```typescript
// Validate balance before accepting order
const balanceService = WalletBalanceService.getInstance();
const hasBalance = await balanceService.hasSufficientBalance(
  userAddress,
  orderSize.toString()
);

if (!hasBalance) {
  return res.status(400).json({
    success: false,
    error: 'Insufficient collateral balance'
  });
}

// Proceed with order matching...
```

## Data Structure: UserBalance

```typescript
interface UserBalance {
  userAddress: string;              // User's EOA address
  walletAddress: string;            // Their multisig wallet
  collateralBalance: string;        // Raw balance (wei)
  collateralBalanceFormatted: string;  // Human-readable (e.g., "1.50")
  availableForOrders: string;       // Balance - locked amount
  lockedInOrders: string;           // Balance in active orders
  lastUpdated: number;              // Timestamp (ms)
}
```

## File Locations

| File | Purpose |
|------|---------|
| `src/services/walletBalanceService.ts` | Core balance service with ERC20 integration |
| `src/routes/wallet.ts` | REST API endpoints for balance queries |
| `.data/balances.json` | Persistent storage of wallet mappings |
| `packages/backend/WALLET_BALANCE_API.md` | Full API documentation |
| `packages/backend/ORDER_PLACEMENT_INTEGRATION.md` | Integration examples and patterns |

## Configuration

**Environment Variable:**
```env
COLLATERAL_TOKEN=0x41E94cB5eB3092Bc577881a08e21A7ff090DcAa7
RPC_URL=https://amoy.polygonscan.com
```

## Common Use Cases

### 1. Display Balance in UI
```typescript
<p>Balance: {balance.collateralBalanceFormatted} USDC</p>
<p>Available: {balance.availableForOrders} USDC</p>
<p>Locked: {balance.lockedInOrders} USDC</p>
```

### 2. Prevent Order if Insufficient
```typescript
const canOrder = await fetch('/api/wallet/check-sufficient', {
  method: 'POST',
  body: JSON.stringify({
    userAddress: '0x...',
    requiredAmount: '1.00'
  })
}).then(r => r.json());

if (!canOrder.hasSufficientBalance) {
  showError('Not enough USDC to place order');
  return;
}
```

### 3. Link User to Wallet After Deployment
```typescript
await fetch('/api/wallet/update-mapping', {
  method: 'POST',
  body: JSON.stringify({
    userAddress: userEOA,
    walletAddress: deployedMultisig
  })
});
```

### 4. Get Multiple Users' Balances
```typescript
const addresses = ['0x111...', '0x222...', '0x333...'];
const response = await fetch(
  `/api/wallet/balance/batch?addresses=${addresses.join(',')}`
);
const { balances } = await response.json();
```

## Error Handling

```typescript
// User has no wallet
{ success: false, error: "Invalid user address format" }

// Insufficient balance
{ 
  success: true, 
  hasSufficientBalance: false,
  availableBalance: "0.50",
  message: "Insufficient balance for this order"
}

// Success
{
  success: true,
  balance: {
    userAddress: "0x123...",
    collateralBalanceFormatted: "5.00",
    availableForOrders: "4.50",
    lockedInOrders: "0.50"
  }
}
```

## Integration Checklist

- [ ] **Frontend**: Import/use balance checking before order submission
- [ ] **Backend**: Call `hasSufficientBalance()` in order placement route
- [ ] **Wallet**: User must deploy multisig wallet first
- [ ] **Mapping**: Call `update-mapping` after wallet deployment
- [ ] **Token**: ERC20 collateral token address configured
- [ ] **Testing**: Verify balance queries work with test ERC20 contract

## Testing

**Run Balance Service Tests:**
```bash
# Check individual balance
curl http://localhost:3001/api/wallet/balance/0x1234567890123456789012345678901234567890

# Check batch balances
curl "http://localhost:3001/api/wallet/balance/batch?addresses=0x111...,0x222..."

# Check sufficient balance
curl -X POST http://localhost:3001/api/wallet/check-sufficient \
  -H "Content-Type: application/json" \
  -d '{"userAddress":"0x...","requiredAmount":"1.00"}'

# Update wallet mapping
curl -X POST http://localhost:3001/api/wallet/update-mapping \
  -H "Content-Type: application/json" \
  -d '{"userAddress":"0x...","walletAddress":"0x..."}'
```

## Performance Notes

- **Balance Queries:** ~500ms per user (blockchain RPC call)
- **Batch Queries:** ~1s for 5-10 users (parallelized)
- **Caching:** Results cached in memory, persist to `.data/balances.json`
- **Refresh:** Call endpoint again to get fresh balance from blockchain

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "No wallet found" | Call `/api/wallet/update-mapping` first |
| "Insufficient balance" | Check balance with `/api/wallet/balance/:address` |
| "Invalid address" | Ensure address is 0x-prefixed and 40 hex chars |
| "Network error" | Verify RPC_URL is correct and reachable |

## Next Steps

1. **Frontend Integration:** Display balance widget in trading UI
2. **Order Validation:** Add balance check to order placement form
3. **Real-time Updates:** Use WebSocket to notify balance changes
4. **Database Migration:** Move `.data/balances.json` to PostgreSQL for production

## Support

- **Full API Docs:** `WALLET_BALANCE_API.md`
- **Integration Guide:** `ORDER_PLACEMENT_INTEGRATION.md`
- **Service Code:** `src/services/walletBalanceService.ts`
- **Routes Code:** `src/routes/wallet.ts`
