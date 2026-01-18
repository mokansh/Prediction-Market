# Multisig Wallet Deployment Feature

This document explains the multisig wallet deployment feature that enables users to trade on the Polymarket platform.

## Overview

When users want to deposit funds, they must first deploy a multisig wallet (Safe/Gnosis Safe). This is a one-time setup that allows secure trading on the platform. The deployment process uses EIP-712 signatures for gasless onboarding - users sign a message, and the backend deploys the wallet using an admin account.

## Architecture

### Frontend Flow

1. User clicks "Deposit" button
2. `DepositModal` component opens
3. Frontend checks if user's multisig wallet is already deployed
4. If not deployed:
   - Shows "Enable Trading" button
   - User clicks and signs an EIP-712 message
   - Signature is sent to backend
   - Backend deploys the wallet
5. If deployed:
   - Shows deposit interface

### Backend Flow

1. Receives signature from frontend
2. Validates the signature and parameters
3. Calls `createProxy()` on SafeProxyFactory contract
4. Uses admin wallet to pay gas fees
5. Returns deployed wallet address to frontend

## Components

### Frontend Components

**`/packages/frontend/src/components/DepositModal.tsx`**
- Main deposit modal component
- Checks wallet deployment status
- Handles EIP-712 signature creation
- Communicates with backend API

### Backend Services

**`/packages/backend/src/services/walletDeploymentService.ts`**
- Service for deploying multisig wallets
- Interacts with SafeProxyFactory contract
- Checks deployment status

**`/packages/backend/src/routes/wallet.ts`**
- API endpoints for wallet operations
- `/api/wallet/check-deployment/:address` - Check if wallet is deployed
- `/api/wallet/deploy` - Deploy a new wallet
- `/api/wallet/admin-address` - Get admin address

### Smart Contract

**SafeProxyFactory** (`/packages/contracts/proxy-factories/packages/safe-factory/contracts/SafeProxyFactory.sol`)
- Factory contract for deploying Safe wallets
- Uses EIP-712 for signature verification
- Deploys wallets deterministically (same address for same user)

## EIP-712 Signature

The signature uses the following structure:

```typescript
Domain: {
  name: 'Polymarket Contract Proxy Factory',
  chainId: 80002, // Amoy testnet
  verifyingContract: SAFE_PROXY_FACTORY_ADDRESS
}

Types: {
  CreateProxy: [
    { name: 'paymentToken', type: 'address' },
    { name: 'payment', type: 'uint256' },
    { name: 'paymentReceiver', type: 'address' }
  ]
}

Message: {
  paymentToken: '0x0000000000000000000000000000000000000000', // Zero address for no payment
  payment: 0,
  paymentReceiver: '0x0000000000000000000000000000000000000000'
}
```

## Setup Instructions

### 1. Backend Setup

```bash
cd packages/backend

# Install dependencies (if not already installed)
npm install

# Create .env file from template
cp .env.example .env

# Edit .env and add:
# - SAFE_PROXY_FACTORY_ADDRESS: Address of deployed SafeProxyFactory
# - ADMIN_PRIVATE_KEY: Private key of admin wallet (will pay gas fees)
# - RPC_URL: RPC endpoint for Polygon Amoy testnet

# Run the backend
npm run dev
```

### 2. Frontend Setup

```bash
cd packages/frontend

# Install dependencies (if not already installed)
npm install

# Create .env.local file from template
cp .env.example .env.local

# Edit .env.local and add:
# - NEXT_PUBLIC_BACKEND_URL: Backend API URL (e.g., http://localhost:3001)
# - NEXT_PUBLIC_SAFE_PROXY_FACTORY_ADDRESS: Address of deployed SafeProxyFactory

# Run the frontend
npm run dev
```

### 3. Admin Wallet Funding

The admin wallet (specified in backend .env) needs to have sufficient MATIC tokens on Polygon Amoy testnet to pay for gas fees when deploying wallets.

Get testnet MATIC from: https://faucet.polygon.technology/

## API Reference

### GET `/api/wallet/check-deployment/:address`

Check if a multisig wallet is deployed for a given address.

**Response:**
```json
{
  "success": true,
  "isDeployed": false,
  "proxyAddress": "0x..."
}
```

### POST `/api/wallet/deploy`

Deploy a multisig wallet for a user.

**Request:**
```json
{
  "userAddress": "0x...",
  "signature": {
    "r": "0x...",
    "s": "0x...",
    "v": 27
  },
  "paymentToken": "0x0000000000000000000000000000000000000000",
  "payment": 0,
  "paymentReceiver": "0x0000000000000000000000000000000000000000"
}
```

**Response:**
```json
{
  "success": true,
  "proxyAddress": "0x...",
  "transactionHash": "0x..."
}
```

### GET `/api/wallet/admin-address`

Get the admin wallet address.

**Response:**
```json
{
  "success": true,
  "adminAddress": "0x..."
}
```

## Security Considerations

1. **Admin Private Key**: Store securely, never commit to version control
2. **Signature Verification**: The smart contract verifies the signature on-chain
3. **Deterministic Addresses**: Each user gets the same wallet address (based on their EOA)
4. **Gas Fees**: Admin pays gas fees, consider rate limiting to prevent abuse
5. **Input Validation**: All inputs are validated on backend before contract interaction

## Troubleshooting

### Wallet Not Deploying
- Check that admin wallet has sufficient MATIC
- Verify SAFE_PROXY_FACTORY_ADDRESS is correct
- Check RPC_URL is accessible

### Signature Invalid
- Ensure chainId matches (80002 for Amoy)
- Verify SAFE_PROXY_FACTORY_ADDRESS matches in frontend and backend
- Check that user is on correct network

### Modal Not Opening
- Ensure wallet is connected
- Check browser console for errors
- Verify backend is running and accessible

## Future Enhancements

1. Add rate limiting to prevent deployment spam
2. Implement queue system for deployments
3. Add webhook notifications when wallet is deployed
4. Support batch deployments
5. Add deployment cost tracking and analytics
