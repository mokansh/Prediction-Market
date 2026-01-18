# Market Resolution Feature Implementation

## Overview
When a market is resolved via the admin resolution page, users will see a resolved market status and can claim their winnings if they hold winning tokens.

## Features Implemented

### 1. Resolution Status Endpoint
**Endpoint**: `GET /api/markets/{id}/resolution-status`

Returns:
- `resolved`: boolean - Whether market is resolved
- `outcome`: 'YES' | 'NO' | null - Which side won
- `market`: Market details

Example:
```bash
curl -s "http://localhost:3001/api/markets/0x123.../resolution-status" | python3 -m json.tool
```

### 2. Redeem Winnings Endpoint
**Endpoint**: `POST /api/wallet/redeem-winnings`

Body:
```json
{
  "userAddress": "0x...",
  "marketId": "0x...",
  "winningOutcome": "YES" or "NO"
}
```

Response:
```json
{
  "success": true,
  "redeemableAmount": "1560000000000000000",
  "redeemableAmountFormatted": "1.560000"
}
```

### 3. Frontend - Resolved Market Display

When a market is resolved, users see:

#### Market Resolution Alert (Large banner)
- ✓ Market Resolved badge
- Shows which outcome won (YES/NO)
- Displays user's winning token balance (if connected)
- **Claim Winnings** button to process redemption

#### Trading Panel Disabled
- Buy/Sell buttons are disabled and faded
- Trade button is disabled
- Yellow warning: "⚠️ This market is resolved. New orders cannot be placed."

### 4. Frontend - User Winnings Flow

If market is resolved and user has winning tokens:
1. Banner shows: "YOUR WINNINGS - [Amount] [Outcome] Tokens"
2. User can click "Claim Winnings" button
3. Button processes redemption via `/api/wallet/redeem-winnings`
4. Success message appears

If user is not connected:
- "Connect Wallet to Claim Winnings" button appears

### 5. Trading Restrictions

When `isMarketResolved === true`:
- Buy/Sell toggle buttons are disabled
- All trading inputs are shown but form is disabled
- Trade submission button is disabled with `isMarketResolved` check
- Market preview section remains visible
- Order book and user's orders remain visible (read-only)

## Technical Changes

### Backend Files Modified:

1. **`src/routes/markets.ts`**
   - Added imports: `ethers`, `UmaCtfAdapterABI`
   - New endpoint: `GET /:id/resolution-status`
   - Fetches resolution status from UmaCtfAdapter contract
   - Falls back to market store if UMA adapter unavailable

2. **`src/routes/wallet.ts`**
   - Added import: `getMarketsStore`
   - New endpoint: `POST /redeem-winnings`
   - Calculates user's winning token balance
   - Returns redeemable amount and formatted display value

### Frontend Files Modified:

1. **`src/app/market/[id]/page.tsx`**
   - Added state:
     - `isMarketResolved`: boolean
     - `resolutionOutcome`: 'YES' | 'NO' | null
     - `userWinnings`: string | null
     - `userWinningsFormatted`: string | null
     - `isRedeemingWinnings`: boolean

   - Added effect: Resolution status check
     - Fetches market resolution status
     - If resolved and user connected, fetches redemption amount
     - Updates UI with resolution info

   - Modified Buy/Sell buttons
     - Disabled when `isMarketResolved === true`
     - Visual feedback (opacity, cursor)

   - Modified Trade button
     - Disabled when `isMarketResolved === true`
     - Added to disable condition

   - Added UI sections:
     - Market Resolution Alert (before trading panel)
     - Winnings display with claim button
     - Connect wallet prompt if not connected

## User Experience Flow

### Scenario 1: Market Resolved, User Has Winning Tokens
1. User navigates to market detail page
2. Page detects market is resolved with YES winning
3. Large banner appears: "✓ Market Resolved - YES Won!"
4. Winnings section shows: "YOUR WINNINGS - 1.56 YES Tokens"
5. User clicks "Claim Winnings"
6. Success message: Winnings calculated and ready to claim
7. Trading is completely disabled

### Scenario 2: Market Resolved, User Has No Tokens
1. User navigates to market detail page
2. Page detects market is resolved with YES winning
3. Market Resolution Alert shows outcome
4. No winnings section (user has no winning tokens)
5. Trading is disabled

### Scenario 3: Market Resolved, User Not Connected
1. User navigates to market detail page (not connected)
2. Page detects market is resolved
3. Market Resolution Alert shows outcome
4. "Connect Wallet to Claim Winnings" button appears
5. User clicks to connect wallet
6. After connecting, winnings amount loads

## Testing Checklist

- [ ] Navigate to resolved market - see resolution alert
- [ ] Market shows correct winning outcome (YES/NO)
- [ ] If have winning tokens, "Claim Winnings" button appears
- [ ] If not connected, "Connect Wallet" button appears
- [ ] Buy/Sell buttons are disabled and faded
- [ ] Cannot submit trade order (button is disabled)
- [ ] Hover effects removed from disabled buttons
- [ ] Order book and user orders still visible (read-only)
- [ ] Can navigate back to markets list
- [ ] Resolution alert appears in correct position
- [ ] Winnings amount formatted correctly (with decimals)

## Future Enhancements

1. **Actual Token Redemption**: 
   - Currently just calculates redeemable amount
   - Next step: Implement CTF `redeemPositions()` call

2. **Redemption Confirmation**:
   - Add confirmation modal before redemption
   - Show gas fees estimate

3. **Redemption History**:
   - Track which users have redeemed
   - Display redemption status per market

4. **Multiple Outcomes**:
   - Handle tie scenarios (50/50 payout)
   - Show split winnings UI
