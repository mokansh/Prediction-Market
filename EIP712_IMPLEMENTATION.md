# EIP712 Signature Implementation Guide

## Overview

This document describes the EIP712 signature implementation for Polymarket CTF Exchange order placement. The system now uses cryptographic signatures to validate orders, matching Polymarket's real implementation.

## Key Changes

### 1. Backend Changes

#### New File: `src/utils/eip712.ts`
- **Purpose**: Server-side EIP712 verification utilities
- **Key Functions**:
  - `createOrderHash()`: Creates EIP712 hash for an order
  - `verifyOrderSignature()`: Verifies signature was created for the given order
  - `validateOrderMessage()`: Validates order message structure
  - `convertEIP712ToOrderData()`: Converts EIP712 message to internal format

#### Updated: `src/routes/orders.ts`
- **Changes**: 
  - Changed `POST /api/orders/place` to require EIP712 signed orders
  - Old format: `{ marketId, makerAddress, side, outcome, amount, price }`
  - New format: `{ marketId, orderData, signature, outcome }`
  - Signature verification added before order processing

#### Updated: `src/types/orders.ts`
- **Changes**: Added signature fields to Order interface:
  ```typescript
  signature?: string;           // EIP712 signature
  signingHash?: string;         // Hash that was signed
  signerAddress?: string;       // Address that signed the order
  tokenId?: string;             // Conditional token ID
  ```

### 2. Frontend Changes

#### New File: `src/utils/eip712Signing.ts`
- **Purpose**: Client-side EIP712 signing utilities
- **Key Functions**:
  - `createOrderMessage()`: Creates unsigned order message
  - `signOrderMessage()`: Signs message with wallet (MetaMask, etc.)
  - `getSignerFromProvider()`: Gets signer from Web3 provider
  - `getSignerAddress()`: Gets address from signer
  - `createAndSignOrder()`: Complete flow (create + sign)

#### Updated: `src/components/MarketModal.tsx`
- **Changes**:
  - Modified `handleTrade()` to use EIP712 signing
  - Prompts wallet for signature before order submission
  - Sends signed order data instead of raw order parameters
  - Better error handling for wallet rejections

#### Updated: `src/context/WalletContext.tsx`
- **Changes**: Fixed TypeScript error for `window.ethereum` check

## Order Format

### EIP712 Domain (Polymarket)
```javascript
{
  name: 'Polymarket CTF Exchange',
  version: '1',
  chainId: 137,  // Polygon mainnet
  verifyingContract: '0x4bfb41d5b3570defd03c39a9a4d8de6bd8b8982e'
}
```

### Order Message Structure
```typescript
{
  salt: string;              // Random value for uniqueness
  maker: string;             // Address of order creator
  signer: string;            // Address that signed (usually same as maker)
  taker: string;             // Address allowed to fill (0x00...00 = anyone)
  tokenId: string;           // Conditional token ID
  makerAmount: string;       // Amount offered (in wei)
  takerAmount: string;       // Amount required (in wei)
  expiration: string;        // Unix timestamp or "0" for no expiry
  nonce: string;             // Replay protection
  feeRateBps: string;        // Fee percentage in basis points
  side: number;              // 0 = BUY, 1 = SELL
  signatureType: number;     // 2 = EIP712
}
```

## API Endpoints

### POST /api/orders/place

**Request Body:**
```javascript
{
  marketId: "market-uuid",
  outcome: "YES" | "NO",
  orderData: {
    salt: "123456789",
    maker: "0x...",
    signer: "0x...",
    taker: "0x0000000000000000000000000000000000000000",
    tokenId: "12345678901234567890",
    makerAmount: "1000000",    // Amount in smallest unit
    takerAmount: "2000000",
    expiration: "0",
    nonce: "0",
    feeRateBps: "0",
    side: 0,                   // 0 = BUY, 1 = SELL
    signatureType: 2
  },
  signature: "0x..."           // EIP712 signature from wallet
}
```

**Response:**
```javascript
{
  success: true,
  order: { /* created order object */ },
  matches: 0                  // Number of matches found
}
```

**Error Responses:**
- 400: Invalid signature, missing fields, validation failed
- 500: Internal server error

## Testing the Implementation

### Prerequisites
1. Backend running on `http://localhost:3001`
2. Frontend running on `http://localhost:3000`
3. MetaMask or similar Web3 wallet installed
4. Account with funds on the network

### Testing Steps

1. **Start Services**:
   ```bash
   # Terminal 1: Backend
   cd packages/backend
   npm run dev

   # Terminal 2: Frontend
   cd packages/frontend
   npm run dev
   ```

2. **Connect Wallet**:
   - Click "Connect Wallet" button
   - Approve connection in MetaMask
   - Verify correct network (Polygon Amoy)

3. **Place Order with Signature**:
   - Click on a market
   - Select outcome (YES/NO)
   - Choose market or limit order
   - Enter amount and price
   - Click "Place Order"
   - **MetaMask should pop up asking to sign**
   - Review and approve the signature request
   - Wait for order confirmation

4. **Verify in Network Inspector**:
   - Check browser DevTools Network tab
   - `POST /api/orders/place` should show:
     - Request body with `orderData` and `signature`
     - Response with created order and matches

### Expected Behavior

**Success Case**:
```
1. User clicks "Place Order"
2. MetaMask popup: "Sign Message" request appears
3. User clicks "Sign"
4. Frontend receives signature from wallet
5. POST request sent with signature
6. Backend verifies signature matches signer address
7. Order created and added to order book
8. Success message: "Order placed successfully"
```

**Wallet Rejection**:
```
1. User clicks "Place Order"
2. MetaMask popup appears
3. User clicks "Cancel"
4. Error message: "Signature request was rejected by user"
```

**Invalid Signature**:
```
1. Signature doesn't match order data
2. Error response: "Invalid signature: signature does not match signer"
3. Order not placed
```

## Signature Verification Process

1. **Frontend**:
   - Gets wallet provider (MetaMask)
   - Creates order message with all parameters
   - Calls `signer.signTypedData()` with Polymarket domain and order types
   - Receives 65-byte signature (v,r,s format)

2. **Backend**:
   - Receives order data and signature
   - Validates order message structure
   - Calls `verifyOrderSignature()` with ethers.js
   - Uses `ethers.verifyTypedData()` to recover signer from signature
   - Compares recovered signer with expected signer address
   - Accepts or rejects based on match

## Troubleshooting

### "Web3 wallet provider not found"
- Ensure MetaMask or similar wallet is installed
- Refresh page and try again
- Check browser console for errors

### "Signature does not match signer"
- Wallet disconnected between signature and submission
- Network mismatch (wrong chain)
- Order data changed after signing

### "Wrong network. Please switch to Polygon Amoy testnet"
- Switch network in MetaMask
- Look for "Polygon Amoy" or add if not present

### Order not appearing in order book
- Check backend logs for verification errors
- Verify order data matches signed message
- Confirm tokenId is correctly generated

## Security Considerations

1. **Nonce**: Currently set to "0" - in production should increment per order
2. **Expiration**: Currently set to "0" (never expires) - should use proper timestamps
3. **Fee Rate**: Currently "0" - production should have proper fee structure
4. **Salt**: Random per order for uniqueness
5. **Signature Validation**: Happens on server for all orders

## Migration from Old Format

If migrating from the unsigned format, update client code:

**Old**:
```javascript
await fetch('/api/orders/place', {
  body: JSON.stringify({
    marketId, makerAddress, side, outcome, amount, price
  })
})
```

**New**:
```javascript
const { message, signature } = await createAndSignOrder(
  window.ethereum,
  side === 'BUY' ? 0 : 1,
  amount,
  price,
  tokenId
);

await fetch('/api/orders/place', {
  body: JSON.stringify({
    marketId, outcome, orderData: message, signature
  })
})
```

## Implementation Files

- Backend: `packages/backend/src/utils/eip712.ts`
- Backend Routes: `packages/backend/src/routes/orders.ts`
- Backend Types: `packages/backend/src/types/orders.ts`
- Frontend: `packages/frontend/src/utils/eip712Signing.ts`
- Frontend Component: `packages/frontend/src/components/MarketModal.tsx`
- Frontend Context: `packages/frontend/src/context/WalletContext.tsx`

## References

- [EIP712 Specification](https://eips.ethereum.org/EIPS/eip-712)
- [Polymarket API Documentation](https://docs.polymarket.com)
- [ethers.js Documentation](https://docs.ethers.org)
