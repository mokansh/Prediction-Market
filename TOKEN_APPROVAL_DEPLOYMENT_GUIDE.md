# Token Approval Feature - Deployment & Testing Guide

## Pre-Deployment Checklist

### Environment Setup

- [ ] Set all required environment variables
- [ ] Backend .env configured with admin key
- [ ] Frontend .env.local configured with all contract addresses
- [ ] RPC URL pointing to correct network (Amoy testnet)
- [ ] Admin wallet has sufficient gas (native tokens)

### Contract Verification

- [ ] Safe Proxy Factory deployed and address correct
- [ ] MultiSend contract deployed at configured address
- [ ] All contract ABIs available in backend
- [ ] Safe.json ABI exists with required functions

### Backend Setup

- [ ] WalletDeploymentService compiled without errors
- [ ] New endpoints tested for syntax
- [ ] Database/storage for wallet nonces (if needed)
- [ ] Admin wallet funded with gas

### Frontend Setup

- [ ] DepositModal component compiles without errors
- [ ] All contract addresses available in environment
- [ ] ethers.js library updated
- [ ] Backend URL correctly configured

---

## Deployment Steps

### 1. Backend Deployment

```bash
# Install dependencies if needed
cd packages/backend
npm install

# Verify compilation
npm run build

# Start backend
npm run dev
# or
PORT=3001 npm run dev
```

**Verify Backend:**
```bash
# Check health endpoints
curl http://localhost:3001/api/wallet/admin-address

# Should return admin address from config
```

### 2. Frontend Deployment

```bash
# Install dependencies if needed
cd packages/frontend
npm install

# Build frontend
npm run build

# Start frontend dev server
npm run dev
# or
npm start
```

**Verify Frontend:**
- Open http://localhost:3000
- Connect wallet
- Open browser DevTools
- Check console for configuration logs

### 3. Verify Integration

**Test API Connectivity:**
```bash
# From frontend console
await fetch('http://localhost:3001/api/wallet/admin-address')
  .then(r => r.json())
  .then(console.log)
```

**Expected Output:**
```json
{
  "success": true,
  "adminAddress": "0x..."
}
```

---

## Testing Procedure

### Phase 1: Unit Testing

#### Backend Nonce Endpoint

```bash
# Get nonce for deployed proxy
curl http://localhost:3001/api/wallet/nonce/0x<proxy_address>

# Expected response:
# {
#   "success": true,
#   "proxyAddress": "0x...",
#   "nonce": 0
# }
```

#### Frontend Encoding

Open browser console:
```javascript
// Test ERC20 approve encoding
const iface = new ethers.Interface(['function approve(address spender, uint256 amount)']);
const encoded = iface.encodeFunctionData('approve', 
  ['0x605921c2eC6E761945bEEA78D46b81f045dc0399', ethers.MaxUint256]
);
console.log('Encoded:', encoded);
// Should output: 0x095ea7b3...
```

### Phase 2: Integration Testing

#### Test 1: Wallet Deployment
1. Open DepositModal
2. Verify "Enable Trading" button appears
3. Click button
4. Sign deployment transaction
5. Wait for confirmation
6. Verify:
   - No errors displayed
   - Success message appears
   - "Token Approvals" section visible
   - Proxy address displayed

#### Test 2: Token Approvals
1. Click "Approve Tokens" button
2. Monitor browser console for:
   - "Starting token approval for: 0x..."
   - "Current nonce: 0"
   - "MultiSend data encoded"
   - "SafeTx object created"
   - "Requesting signature..."
3. Sign when MetaMask prompts
4. Monitor backend logs for:
   - "Executing token approvals for: 0x..."
   - "Transaction sent: 0x..."
   - "Transaction confirmed: 0x..."
5. Verify:
   - No errors in frontend
   - Button shows "✓ Approvals Complete"
   - Deposit input becomes enabled
   - Success message appears

#### Test 3: On-Chain Verification
1. Get transaction hash from logs
2. Go to block explorer (PolyScan testnet)
3. Search for transaction hash
4. Verify:
   - Transaction is from Safe proxy address
   - MultiSend contract is called
   - 7 internal transactions executed
   - All approvals/operators set correctly

**Check each approval:**
```bash
# Using cast or web3.py
# 1. Check USDC approval to CTF
cast call 0x7006b5a13d347dab68b9c2caabee2e6bc11296fd \
  "allowance(address,address)" \
  0x<proxy_address> 0x53dBaF3856166A512dA9A53c470A820b8cD7195c

# Should return: 115792089237316195423570985008687907853269984665640564039457584007913129639935 (max uint256)

# 2. Check CTF operator approval
cast call 0x53dBaF3856166A512dA9A53c470A820b8cD7195c \
  "isApprovedForAll(address,address)" \
  0x<proxy_address> 0x605921c2eC6E761945bEEA78D46b81f045dc0399

# Should return: 0x0000000000000000000000000000000000000000000000000000000000000001 (true)
```

### Phase 3: Error Testing

#### Test 1: Invalid Proxy Address
- Modify frontend to use invalid proxy address
- Expected: "Invalid proxy address" error

#### Test 2: Rejected Signature
- When prompted to sign, reject signature
- Expected: "Signature request was rejected" error

#### Test 3: Backend Offline
- Stop backend server
- Try to approve tokens
- Expected: "Backend server is not accessible" error

#### Test 4: Insufficient Gas
- Empty admin wallet
- Try to approve tokens
- Expected: Transaction fails with gas error

#### Test 5: Wrong Network
- Change MetaMask to different network
- Try to sign
- Expected: Error or signature mismatch

---

## Debugging Guide

### Frontend Debugging

**Enable detailed logging:**
```javascript
// In DepositModal component
console.log('[DepositModal]', 'All operations logged');
```

**Check stored addresses:**
```javascript
// In browser console
console.log({
  COLLATERAL_TOKEN: '0x7006b5a13d347dab68b9c2caabee2e6bc11296fd',
  CTF_CONTRACT: '0x53dBaF3856166A512dA9A53c470A820b8cD7195c',
  // ... check all loaded
});
```

**Verify signature format:**
```javascript
// When signature received
const sig = ethers.Signature.from(signature);
console.log('Signature components:', {
  r: sig.r,
  s: sig.s,
  v: sig.v,
  serialized: sig.serialized
});
```

### Backend Debugging

**Check service initialization:**
```bash
# Look for these logs on startup
grep "WalletDeploymentService" backend.log
grep "Admin wallet initialized" backend.log
grep "SafeProxyFactory contract initialized" backend.log
```

**Monitor nonce reading:**
```bash
# Enable debug logs
NODE_ENV=development npm run dev

# Should show nonce fetch operations
```

**Trace transaction execution:**
```javascript
// In walletDeploymentService.ts, add:
console.log('[Execute] SafeTx:', safeTx);
console.log('[Execute] Signature:', fullSignature);
console.log('[Execute] Calling execTransaction...');
```

### Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Signature never requested | Wallet not connected | Connect wallet first |
| "Invalid signature" error | Wrong signature format | Ensure r, s, v extracted correctly |
| Transaction reverts | Invalid SafeTx data | Verify nonce and data encoding |
| Nonce error | Stale nonce | Fetch fresh nonce before each attempt |
| Gas error | Admin wallet empty | Fund admin wallet |
| Address invalid | Wrong format | Verify checksum addresses |

---

## Performance Monitoring

### Key Metrics

1. **Signature Request Time**: < 5 seconds
2. **Backend Execution Time**: < 30 seconds
3. **Transaction Confirmation**: < 2 minutes
4. **MultiSend Gas Usage**: Monitor actual usage

### Monitor from Frontend:
```javascript
const start = Date.now();
// ... perform approval ...
const elapsed = Date.now() - start;
console.log(`Approval took ${elapsed}ms`);
```

### Monitor from Backend:
```javascript
console.time('Token Approval Execution');
// ... execute approval ...
console.timeEnd('Token Approval Execution');
```

---

## Post-Deployment Verification

### Checklist

- [ ] User can deploy multisig wallet successfully
- [ ] "Token Approvals" section appears after deployment
- [ ] "Approve Tokens" button is clickable
- [ ] User can sign EIP712 message without errors
- [ ] Backend receives and validates signature
- [ ] All 7 approvals execute via MultiSend
- [ ] Transaction hash returned successfully
- [ ] Button shows "✓ Approvals Complete"
- [ ] Deposit input becomes enabled
- [ ] On-chain verification shows all approvals set
- [ ] No errors in browser console
- [ ] No errors in backend logs
- [ ] All contract addresses correct

### Sign-Off

- [ ] Frontend ready for production
- [ ] Backend ready for production
- [ ] All contract addresses verified
- [ ] Admin wallet funded
- [ ] Error handling tested
- [ ] Performance acceptable

---

## Maintenance & Monitoring

### Daily Checks

1. Monitor backend logs for errors
2. Check admin wallet balance
3. Verify RPC endpoint connectivity
4. Monitor transaction success rate

### Weekly Tasks

1. Check for failed transactions
2. Update contract addresses if needed
3. Review user feedback
4. Monitor gas prices

### Monthly Review

1. Analyze approval statistics
2. Optimize gas usage
3. Update documentation
4. Plan improvements

---

## Rollback Plan

If issues occur post-deployment:

1. **Frontend Issue**: Revert DepositModal.tsx to previous version
2. **Backend Issue**: Revert wallet routes and service
3. **Contract Issue**: Use different contract addresses (if available)
4. **Complete Rollback**: Disable token approval feature, show message

### Disable Feature:
```typescript
// In DepositModal
const FEATURE_ENABLED = false;

if (!FEATURE_ENABLED) {
  // Show message: "Token approvals currently unavailable"
}
```

---

## Next Steps After Deployment

1. **Monitor User Adoption**: Track approval success rate
2. **Gather Feedback**: Collect user feedback on process
3. **Optimize Gas**: Monitor and reduce gas usage
4. **Enhance UX**: Improve status displays and messages
5. **Add Features**: Individual approval controls, status per contract
6. **Document API**: Create API documentation for integrations

---

## Support & Troubleshooting

### Getting Help

1. Check console logs first
2. Review error messages
3. Verify environment variables
4. Check contract addresses
5. Review on-chain transaction

### Escalation Path

1. Frontend issues → Check DepositModal.tsx
2. Backend issues → Check walletDeploymentService.ts
3. Contract issues → Check addresses in .env
4. Network issues → Check RPC connection
5. Signature issues → Check EIP712 types

---

## Related Documentation

- [TOKEN_APPROVAL_IMPLEMENTATION.md](TOKEN_APPROVAL_IMPLEMENTATION.md)
- [TOKEN_APPROVAL_QUICK_REFERENCE.md](TOKEN_APPROVAL_QUICK_REFERENCE.md)
- [TOKEN_APPROVAL_CHANGES_SUMMARY.md](TOKEN_APPROVAL_CHANGES_SUMMARY.md)
- [TOKEN_APPROVAL_FLOW_DIAGRAMS.md](TOKEN_APPROVAL_FLOW_DIAGRAMS.md)

---

**Last Updated**: January 16, 2026
**Version**: 1.0
**Status**: Ready for Deployment
