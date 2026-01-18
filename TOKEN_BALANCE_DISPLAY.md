# Market Outcome Token Balance Display Feature

## Overview
Added the ability for users to see their YES/NO outcome token holdings for a specific market when they click into the market modal.

## Changes Made

### Backend Changes

#### 1. New API Endpoint: `GET /api/wallet/market-balances/:userAddress/:marketId`
**File**: `/packages/backend/src/routes/wallet.ts`

**Purpose**: Fetch YES/NO token balances for a user in a specific market

**Query Parameters**:
- `walletAddress` (optional): Specific wallet address to check. If not provided, uses user's deployed multisig or tries to fetch from balance service.

**Response**:
```json
{
  "success": true,
  "yesBalance": "1000000000000000000",      // Raw balance in Wei
  "noBalance": "500000000000000000",        // Raw balance in Wei
  "yesBalanceFormatted": "1000000000",      // Formatted balance (outcome tokens)
  "noBalanceFormatted": "500000000",        // Formatted balance (outcome tokens)
  "yesTokenId": "...",                      // Token ID for YES outcome
  "noTokenId": "...",                       // Token ID for NO outcome
  "walletAddress": "0x...",                 // Wallet address checked
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Error Cases**:
- Invalid user address format: 400 Bad Request
- Market not found: 404 Not Found
- Conditional tokens contract not configured: 500 Internal Server Error

**Implementation Details**:
- Uses MarketsStore to fetch market and get tokenIds
- Queries ConditionalTokens ERC1155 contract directly for balances
- Supports both user's direct address and multisig wallet address
- Returns zero balances if no wallet found for user
- Outcome tokens have 0 decimals (whole units)

### Frontend Changes

#### 1. Market Outcome Balance Display in MarketModal
**File**: `/packages/frontend/src/components/MarketModal.tsx`

**New State Variables**:
- `marketOutcomeBalances`: Stores YES/NO token balances for current market
- `outcomeBalancesLoading`: Loading state for balance fetch

**New useEffect Hook**:
- Triggers when: user connects, changes markets, or wallet address changes
- Fetches outcome balances from new backend endpoint
- Logs results for debugging

**UI Updates**:
1. **USDC Balance Label Change**: Changed from "Balance" to "USDC Balance" to clarify it's collateral
2. **New Market Position Card**: Displays in trading panel showing:
   - YES token count in green
   - NO token count in red
   - Loading state while fetching
   - Only visible when user is connected

**Visual Layout**:
```
┌─────────────────────────────────────┐
│ Trade          USDC Balance: 100    │
├─────────────────────────────────────┤
│ Market Position                     │
│ ┌─────────────────┬─────────────────┐
│ │ YES Tokens      │ NO Tokens       │
│ │ 1,000,000       │ 500,000         │
│ └─────────────────┴─────────────────┘
├─────────────────────────────────────┤
│ [Buy] [Sell] Toggle                 │
│ ...
```

## Testing Instructions

### 1. Test Backend Endpoint
```bash
# Get outcome token balances for a user in a market
curl -X GET "http://localhost:3001/api/wallet/market-balances/0xYourAddress/0xMarketId"

# With specific wallet address
curl -X GET "http://localhost:3001/api/wallet/market-balances/0xYourAddress/0xMarketId?walletAddress=0xSpecificWallet"
```

### 2. Test Frontend Display
1. Connect wallet in UI
2. Click on any market to open MarketModal
3. Verify:
   - USDC balance still shows at top right
   - Market Position card appears below USDC balance
   - YES token count displays in green
   - NO token count displays in red
   - Loading animation shows briefly if network is slow

### 3. Test with Different Scenarios
- **No tokens**: Market Position card shows 0 for both YES and NO
- **Only YES tokens**: Market Position shows YES count > 0, NO = 0
- **Mixed holdings**: Market Position shows both counts correctly
- **Switching markets**: Balances update when clicking different markets
- **Disconnecting wallet**: Market Position card disappears when disconnected

## Technical Integration

### Data Flow
1. User clicks market → MarketModal opens
2. Modal component checks if user is connected
3. If connected, fetches outcome balances: `GET /api/wallet/market-balances/:address/:marketId`
4. Backend:
   - Retrieves market from MarketsStore
   - Gets market.tokenIds.yesTokenId and market.tokenIds.noTokenId
   - Queries ConditionalTokens contract: `balanceOf(userWallet, yesTokenId)` and `balanceOf(userWallet, noTokenId)`
5. Frontend displays balances in Market Position card

### Dependencies
- Backend: `ethers`, existing market services, existing balance service
- Frontend: React hooks (useState, useEffect), existing Wallet context

### Contract Interfaces Used
- **ConditionalTokens (ERC1155)**: `balanceOf(address owner, uint256 id) returns (uint256)`
- **MarketsStore**: Retrieves market data including tokenIds

## Future Enhancements
1. Add token value estimation (show USDC equivalent using current prices)
2. Add "Sell Tokens" quick action directly from balance display
3. Add token holding history/chart
4. Cache outcome balances with periodic refresh instead of fetching on every market modal open
5. Show outcomes as "YES @ 0.50" / "NO @ 0.50" instead of just token counts

## Notes
- Outcome tokens are tracked as whole units (0 decimals in ConditionalTokens)
- User can have multiple wallets (EOA or multisig) - endpoint handles both
- Balances update on every market modal open (no caching) for real-time accuracy
- The endpoint gracefully handles missing markets and users without deployed multisigs
