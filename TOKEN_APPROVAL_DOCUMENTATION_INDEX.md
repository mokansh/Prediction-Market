# Token Approval Feature - Documentation Index

## Quick Navigation

### 📋 Quick Start
- **[TOKEN_APPROVAL_QUICK_REFERENCE.md](TOKEN_APPROVAL_QUICK_REFERENCE.md)** - Start here for quick lookups
  - API endpoints
  - Contract addresses
  - EIP712 structures
  - Environment variables
  - Debugging tips

### 🔧 Implementation Details
- **[TOKEN_APPROVAL_IMPLEMENTATION.md](TOKEN_APPROVAL_IMPLEMENTATION.md)** - Complete technical documentation
  - Frontend implementation
  - Backend implementation
  - Service methods
  - ABI files
  - Security considerations

### 📊 Architecture & Flows
- **[TOKEN_APPROVAL_FLOW_DIAGRAMS.md](TOKEN_APPROVAL_FLOW_DIAGRAMS.md)** - Visual representations
  - Complete user journey
  - Frontend architecture
  - Backend API flow
  - Data structures
  - Error handling tree
  - State diagrams
  - Signature validation

### 🚀 Deployment & Testing
- **[TOKEN_APPROVAL_DEPLOYMENT_GUIDE.md](TOKEN_APPROVAL_DEPLOYMENT_GUIDE.md)** - Setup and testing guide
  - Pre-deployment checklist
  - Deployment steps
  - Testing procedures
  - Debugging guide
  - Performance monitoring
  - Maintenance plan

### 📝 Change Summary
- **[TOKEN_APPROVAL_CHANGES_SUMMARY.md](TOKEN_APPROVAL_CHANGES_SUMMARY.md)** - What was changed
  - Files modified
  - New features added
  - State variables
  - Utility functions
  - Testing checklist

---

## Document Purposes

| Document | Purpose | Audience |
|----------|---------|----------|
| Quick Reference | Fast lookup of APIs, addresses, structs | Developers |
| Implementation | Complete technical details | Architects, Senior Devs |
| Flow Diagrams | Visual understanding of system | All |
| Deployment Guide | Setup, test, deploy, maintain | DevOps, QA |
| Changes Summary | What was added/modified | Project Managers, Reviewers |

---

## Code Files Modified

### Frontend
- **[packages/frontend/src/components/DepositModal.tsx](../packages/frontend/src/components/DepositModal.tsx)**
  - Added token approval section
  - Added EIP712 signing
  - Added approval handlers
  - Enhanced UI states

### Backend Routes
- **[packages/backend/src/routes/wallet.ts](../packages/backend/src/routes/wallet.ts)**
  - Added `/api/wallet/nonce/:proxyAddress` endpoint
  - Added `/api/wallet/approve-tokens` endpoint

### Backend Services
- **[packages/backend/src/services/walletDeploymentService.ts](../packages/backend/src/services/walletDeploymentService.ts)**
  - Added `getProxyNonce()` method
  - Added `executeTokenApprovals()` method
  - Added new interfaces

### Backend ABIs
- **[packages/backend/src/abis/Safe.json](../packages/backend/src/abis/Safe.json)** (NEW)
  - Safe contract ABI
  - `nonce()` function
  - `execTransaction()` function

---

## Feature Overview

### What It Does
Users can approve tokens for trading on various contracts with a single signature, executed as a batch transaction via MultiSend.

### 7 Approvals Included
1. USDC → CTF (max approval)
2. USDC → CTF Exchange (max approval)
3. CTF → CTF Exchange (operator approval)
4. USDC → Neg Risk Exchange (max approval)
5. USDC → Neg Risk Adapter (max approval)
6. CTF → Neg Risk Exchange (operator approval)
7. CTF → Neg Risk Adapter (operator approval)

### User Flow
1. User deploys multisig wallet
2. Clicks "Approve Tokens"
3. Signs EIP712 message
4. Backend executes via admin wallet
5. All 7 approvals completed in one transaction
6. User can now trade/deposit

---

## Key Concepts

### EIP712 SafeTx
```typescript
interface SafeTx {
  to: string;                      // MultiSend address
  value: number;                   // 0
  data: string;                    // Encoded transactions
  operation: number;               // 1 (DelegateCall)
  safeTxGas: number;              // 0
  baseGas: number;                // 0
  gasPrice: number;               // 0
  gasToken: string;               // 0x0000...
  refundReceiver: string;         // 0x0000...
  nonce: number;                  // Current wallet nonce
}
```

### MultiSend Batching
All 7 transactions are encoded and sent to MultiSend contract to execute in batch.

### Admin Execution
Admin wallet signs and executes the transaction on behalf of the multisig wallet.

### Domain Separator
```typescript
{
  chainId: 80002,
  verifyingContract: proxyAddress
}
```

---

## API Reference

### Endpoints

#### GET `/api/wallet/nonce/:proxyAddress`
Get current nonce for a proxy wallet.

**Response:**
```json
{
  "success": true,
  "proxyAddress": "0x...",
  "nonce": 0
}
```

#### POST `/api/wallet/approve-tokens`
Execute token approvals.

**Request:**
```json
{
  "proxyAddress": "0x...",
  "safeTx": { /* SafeTx structure */ },
  "signature": { "r": "0x...", "s": "0x...", "v": 27 }
}
```

**Response:**
```json
{
  "success": true,
  "transactionHash": "0x..."
}
```

---

## Environment Variables

### Frontend
```
NEXT_PUBLIC_SAFE_PROXY_FACTORY_ADDRESS
NEXT_PUBLIC_COLLATERAL_TOKEN
NEXT_PUBLIC_CTF_CONTRACT
NEXT_PUBLIC_CTF_EXCHANGE
NEXT_PUBLIC_NEG_RISK_EXCHANGE
NEXT_PUBLIC_NEG_RISK_ADAPTER
NEXT_PUBLIC_MULTI_SEND
NEXT_PUBLIC_BACKEND_URL
```

### Backend
```
SAFE_PROXY_FACTORY_ADDRESS
ADMIN_PRIVATE_KEY
RPC_URL
```

---

## Contract Addresses (Amoy)

| Contract | Address |
|----------|---------|
| USDC | 0x7006b5a13d347dab68b9c2caabee2e6bc11296fd |
| CTF | 0x53dBaF3856166A512dA9A53c470A820b8cD7195c |
| CTF Exchange | 0x605921c2eC6E761945bEEA78D46b81f045dc0399 |
| Neg Risk Exchange | 0x53BBB0b44dd4216AD0e30bc7508F40f66CA7B503 |
| Neg Risk Adapter | 0x19DBBC593c2058A9536b8c46e08cb0aa6180c903 |
| MultiSend | 0x38869bf66a61cF6bDB3095b56e0eb756eCec3d35 |
| Safe Factory | 0x50468d520D77BBA5129C24135A24a3a1d621afca |

---

## Common Tasks

### Deploy to Production
See [TOKEN_APPROVAL_DEPLOYMENT_GUIDE.md](TOKEN_APPROVAL_DEPLOYMENT_GUIDE.md#deployment-steps)

### Debug Frontend Issue
1. Check browser console logs
2. Verify environment variables
3. Check [TOKEN_APPROVAL_QUICK_REFERENCE.md](TOKEN_APPROVAL_QUICK_REFERENCE.md#debugging)

### Debug Backend Issue
1. Check server logs
2. Verify service initialization
3. Check nonce reading
4. See [TOKEN_APPROVAL_DEPLOYMENT_GUIDE.md](TOKEN_APPROVAL_DEPLOYMENT_GUIDE.md#backend-debugging)

### Test on Local Network
See [TOKEN_APPROVAL_DEPLOYMENT_GUIDE.md](TOKEN_APPROVAL_DEPLOYMENT_GUIDE.md#testing-procedure)

### Verify On-Chain Approvals
See [TOKEN_APPROVAL_DEPLOYMENT_GUIDE.md](TOKEN_APPROVAL_DEPLOYMENT_GUIDE.md#on-chain-verification)

---

## Testing Checklist

- [ ] Frontend compiles without errors
- [ ] Backend compiles without errors
- [ ] All environment variables set
- [ ] Admin wallet funded
- [ ] Deploy multisig wallet works
- [ ] Approve tokens button appears
- [ ] User can sign EIP712 message
- [ ] Backend executes transaction
- [ ] All 7 approvals executed
- [ ] On-chain verification passes
- [ ] Deposit becomes enabled
- [ ] Error handling tested
- [ ] Performance acceptable

---

## Support Resources

### For Developers
- [TOKEN_APPROVAL_QUICK_REFERENCE.md](TOKEN_APPROVAL_QUICK_REFERENCE.md)
- [TOKEN_APPROVAL_IMPLEMENTATION.md](TOKEN_APPROVAL_IMPLEMENTATION.md)

### For Architects
- [TOKEN_APPROVAL_FLOW_DIAGRAMS.md](TOKEN_APPROVAL_FLOW_DIAGRAMS.md)
- [TOKEN_APPROVAL_IMPLEMENTATION.md](TOKEN_APPROVAL_IMPLEMENTATION.md)

### For DevOps/QA
- [TOKEN_APPROVAL_DEPLOYMENT_GUIDE.md](TOKEN_APPROVAL_DEPLOYMENT_GUIDE.md)
- [TOKEN_APPROVAL_QUICK_REFERENCE.md](TOKEN_APPROVAL_QUICK_REFERENCE.md) (Common Issues)

### For Project Managers
- [TOKEN_APPROVAL_CHANGES_SUMMARY.md](TOKEN_APPROVAL_CHANGES_SUMMARY.md)

---

## Troubleshooting Quick Links

| Issue | See |
|-------|-----|
| Backend not accessible | [Quick Reference](TOKEN_APPROVAL_QUICK_REFERENCE.md#common-issues--solutions) |
| Invalid signature | [Deployment Guide](TOKEN_APPROVAL_DEPLOYMENT_GUIDE.md#common-issues) |
| Transaction reverted | [Deployment Guide](TOKEN_APPROVAL_DEPLOYMENT_GUIDE.md#common-issues) |
| Address invalid | [Deployment Guide](TOKEN_APPROVAL_DEPLOYMENT_GUIDE.md#common-issues) |
| Gas errors | [Quick Reference](TOKEN_APPROVAL_QUICK_REFERENCE.md#common-issues--solutions) |

---

## Performance Targets

- Signature Request: < 5 seconds
- Backend Execution: < 30 seconds
- Transaction Confirmation: < 2 minutes
- Total Flow: < 3 minutes

---

## Security Considerations

1. Admin key stored securely in environment
2. Signature validated before execution
3. Nonce fetched fresh for each transaction
4. DelegateCall used for batch execution
5. All addresses validated before use
6. Transaction confirmation required

---

## Future Enhancements

1. Individual contract approvals
2. Per-contract status display
3. Approval revocation capability
4. Transaction history tracking
5. Gas estimation display
6. Multi-signature support

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Jan 16, 2026 | Initial implementation |

---

## Related Implementations

- Wallet Deployment: [packages/backend/src/services/walletDeploymentService.ts](../packages/backend/src/services/walletDeploymentService.ts)
- Wallet Routes: [packages/backend/src/routes/wallet.ts](../packages/backend/src/routes/wallet.ts)
- Deposit Modal: [packages/frontend/src/components/DepositModal.tsx](../packages/frontend/src/components/DepositModal.tsx)

---

**Last Updated**: January 16, 2026  
**Status**: Complete  
**Author**: AI Assistant  

---

## Quick Links

- 🚀 [Get Started](TOKEN_APPROVAL_QUICK_REFERENCE.md)
- 🔧 [Technical Details](TOKEN_APPROVAL_IMPLEMENTATION.md)
- 📊 [Flows & Architecture](TOKEN_APPROVAL_FLOW_DIAGRAMS.md)
- 🚢 [Deploy & Test](TOKEN_APPROVAL_DEPLOYMENT_GUIDE.md)
- 📝 [Changes Made](TOKEN_APPROVAL_CHANGES_SUMMARY.md)
