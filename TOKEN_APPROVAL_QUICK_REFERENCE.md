# Token Approval Feature - Quick Reference

## Frontend Usage

### Component: DepositModal
Located at: `packages/frontend/src/components/DepositModal.tsx`

### User Flow
```
1. User clicks Deposit
2. Wallet deployment status checked
3. If not deployed: Show "Enable Trading" → Deploy wallet
4. If deployed: Show "Token Approvals" section
5. User clicks "Approve Tokens"
6. Sign EIP712 SafeTx
7. Backend executes
8. Show "✓ Approvals Complete"
9. Enable deposit input
```

### State Variables
```typescript
const [approvalsCompleted, setApprovalsCompleted] = useState<Set<string>>();
const [isProcessingApproval, setIsProcessingApproval] = useState(false);
const [currentApprovalStep, setCurrentApprovalStep] = useState<string | null>(null);
```

### Main Functions

#### handleApproveTokens()
Complete approval workflow:
1. Fetches nonce from `/api/wallet/nonce/{proxyAddress}`
2. Encodes 7 approval transactions via MultiSend
3. Requests EIP712 signature from user
4. Sends to `/api/wallet/approve-tokens`
5. Updates UI with results

#### Helper Functions
- `encodeApprove()`: Encode ERC20 approve call
- `encodeSetApprovalForAll()`: Encode ERC721 approval
- `encodeMultiSendTransactions()`: Encode all 7 txs
- `getSafeTxDomain()`: Create Safe domain for sig

---

## Backend Usage

### Routes
Mounted at: `src/routes/wallet.ts`

### Endpoints

#### GET `/api/wallet/nonce/:proxyAddress`
```bash
curl http://localhost:3001/api/wallet/nonce/0x...
```
**Response:**
```json
{
  "success": true,
  "nonce": 0,
  "proxyAddress": "0x..."
}
```

#### POST `/api/wallet/approve-tokens`
```bash
curl -X POST http://localhost:3001/api/wallet/approve-tokens \
  -H "Content-Type: application/json" \
  -d '{
    "proxyAddress": "0x...",
    "safeTx": {
      "to": "0x...",
      "value": 0,
      "data": "0x...",
      "operation": 1,
      "safeTxGas": 0,
      "baseGas": 0,
      "gasPrice": 0,
      "gasToken": "0x0000...",
      "refundReceiver": "0x0000...",
      "nonce": 0
    },
    "signature": {
      "r": "0x...",
      "s": "0x...",
      "v": 27
    }
  }'
```
**Response:**
```json
{
  "success": true,
  "transactionHash": "0x..."
}
```

### Service Methods

#### getProxyNonce(proxyAddress: string): Promise<number>
- Reads nonce from Safe contract
- Returns current nonce value
- Throws error if address invalid

#### executeTokenApprovals(params: ApprovalParams): Promise<ApprovalResult>
- Executes signed SafeTx
- Returns transaction hash
- Returns error if execution fails

---

## Contract Addresses (Amoy Testnet)

| Contract | Address | Purpose |
|----------|---------|---------|
| USDC (Collateral) | 0x7006b5a13d347dab68b9c2caabee2e6bc11296fd | Collateral token |
| CTF | 0x53dBaF3856166A512dA9A53c470A820b8cD7195c | Conditional Tokens Framework |
| CTF Exchange | 0x605921c2eC6E761945bEEA78D46b81f045dc0399 | CTF trading |
| Neg Risk Exchange | 0x53BBB0b44dd4216AD0e30bc7508F40f66CA7B503 | Negative Risk trading |
| Neg Risk Adapter | 0x19DBBC593c2058A9536b8c46e08cb0aa6180c903 | Neg Risk support |
| MultiSend | 0x38869bf66a61cF6bDB3095b56e0eb756eCec3d35 | Batch execution |
| Safe Factory | 0x50468d520D77BBA5129C24135A24a3a1d621afca | Wallet deployment |

---

## Approval Transactions

### All 7 Transactions Batched via MultiSend:

| # | Contract | Function | Spender/Operator | Amount |
|----|----------|----------|------------------|--------|
| 1 | USDC | approve | CTF | max |
| 2 | USDC | approve | CTF Exchange | max |
| 3 | CTF | setApprovalForAll | CTF Exchange | true |
| 4 | USDC | approve | Neg Risk Exchange | max |
| 5 | USDC | approve | Neg Risk Adapter | max |
| 6 | CTF | setApprovalForAll | Neg Risk Exchange | true |
| 7 | CTF | setApprovalForAll | Neg Risk Adapter | true |

---

## SafeTx Structure

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

---

## EIP712 Signature

### Domain
```typescript
{
  chainId: 80002,
  verifyingContract: proxyAddress
}
```

### Type
```typescript
SafeTx: [
  { name: 'to', type: 'address' },
  { name: 'value', type: 'uint256' },
  { name: 'data', type: 'bytes' },
  { name: 'operation', type: 'uint8' },
  { name: 'safeTxGas', type: 'uint256' },
  { name: 'baseGas', type: 'uint256' },
  { name: 'gasPrice', type: 'uint256' },
  { name: 'gasToken', type: 'address' },
  { name: 'refundReceiver', type: 'address' },
  { name: 'nonce', type: 'uint256' },
]
```

---

## Environment Variables

### Frontend (.env.local)
```
NEXT_PUBLIC_SAFE_PROXY_FACTORY_ADDRESS=0x50468d520D77BBA5129C24135A24a3a1d621afca
NEXT_PUBLIC_COLLATERAL_TOKEN=0x7006b5a13d347dab68b9c2caabee2e6bc11296fd
NEXT_PUBLIC_CTF_CONTRACT=0x53dBaF3856166A512dA9A53c470A820b8cD7195c
NEXT_PUBLIC_CTF_EXCHANGE=0x605921c2eC6E761945bEEA78D46b81f045dc0399
NEXT_PUBLIC_NEG_RISK_EXCHANGE=0x53BBB0b44dd4216AD0e30bc7508F40f66CA7B503
NEXT_PUBLIC_NEG_RISK_ADAPTER=0x19DBBC593c2058A9536b8c46e08cb0aa6180c903
NEXT_PUBLIC_MULTI_SEND=0x38869bf66a61cF6bDB3095b56e0eb756eCec3d35
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

### Backend (.env)
```
SAFE_PROXY_FACTORY_ADDRESS=0x50468d520D77BBA5129C24135A24a3a1d621afca
ADMIN_PRIVATE_KEY=<admin_key>
RPC_URL=https://rpc-amoy.polygon.technology/
```

---

## Debugging

### Frontend Console Logs
```javascript
[DepositModal] Backend URL: ...
[DepositModal] Safe Proxy Factory: ...
[DepositModal] Contract Addresses: {...}
[DepositModal] Starting token approval for: ...
[DepositModal] Current nonce: ...
[DepositModal] MultiSend data encoded, length: ...
[DepositModal] SafeTx object created: {...}
[DepositModal] Requesting signature...
[DepositModal] Signature received: ...
[DepositModal] Signature components - r: ..., s: ..., v: ...
[DepositModal] Sending approval request to backend
[DepositModal] Approval response: {...}
```

### Backend Console Logs
```
[WalletDeploymentService] Current nonce for {proxy}: {nonce}
[WalletDeploymentService] Executing token approvals for: {proxy}
[WalletDeploymentService] SafeTx data: {...}
[WalletDeploymentService] Reconstructed signature: ...
[WalletDeploymentService] Transaction sent: {hash}
[WalletDeploymentService] Transaction confirmed: {hash}
```

---

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "Invalid signature" | Wrong wallet connected | Verify user connected correct wallet |
| "Nonce error" | Stale nonce | Fetch fresh nonce before signing |
| "Backend not accessible" | Backend not running | Start backend: `npm run dev` |
| "Invalid proxy address" | Address not deployed | Deploy wallet first |
| "Insufficient gas" | Admin wallet empty | Fund admin wallet with gas |
| "Signature rejected" | User cancelled | Ask user to sign again |

---

## Files Changed

1. **Frontend**
   - `packages/frontend/src/components/DepositModal.tsx`
   
2. **Backend Routes**
   - `packages/backend/src/routes/wallet.ts`
   
3. **Backend Services**
   - `packages/backend/src/services/walletDeploymentService.ts`
   
4. **Backend ABIs**
   - `packages/backend/src/abis/Safe.json` (NEW)

---

## Testing

### Manual Testing Steps

1. **Deploy Wallet**
   ```
   1. Open DepositModal
   2. Click "Enable Trading"
   3. Sign transaction
   4. Verify wallet deployed
   ```

2. **Approve Tokens**
   ```
   1. See "Token Approvals" section
   2. Click "Approve Tokens"
   3. Sign EIP712 message
   4. Wait for transaction
   5. Verify "✓ Approvals Complete"
   ```

3. **Verify on Chain**
   ```
   1. Get multisig address
   2. Check token approvals:
      - USDC approved to CTF
      - USDC approved to CTF Exchange
      - USDC approved to Neg Risk Exchange
      - USDC approved to Neg Risk Adapter
   3. Check setApprovalForAll:
      - CTF approved to CTF Exchange
      - CTF approved to Neg Risk Exchange
      - CTF approved to Neg Risk Adapter
   ```

---

## Related Documentation

- [TOKEN_APPROVAL_IMPLEMENTATION.md](TOKEN_APPROVAL_IMPLEMENTATION.md) - Full implementation details
- [TOKEN_APPROVAL_CHANGES_SUMMARY.md](TOKEN_APPROVAL_CHANGES_SUMMARY.md) - All changes made
