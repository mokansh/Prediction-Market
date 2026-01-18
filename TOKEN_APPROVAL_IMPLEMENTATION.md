# Token Approval Implementation for MultiSig Wallet

## Overview

This document describes the token approval feature for the multisig wallet deployment. After a user deploys their multisig wallet, they can approve tokens for trading on various contracts by signing an EIP712 SafeTx and having the admin execute it.

## Frontend Implementation

### DepositModal Component (`packages/frontend/src/components/DepositModal.tsx`)

#### Key Features

1. **Contract Address Configuration**
   - All contract addresses are loaded from environment variables
   - Fallback addresses are provided for testing
   - Addresses include:
     - COLLATERAL_TOKEN: ERC20 token (USDC)
     - CTF_CONTRACT: Conditional Tokens Framework
     - CTF_EXCHANGE: CTF Exchange contract
     - NEG_RISK_EXCHANGE: Negative Risk Exchange
     - NEG_RISK_ADAPTER: Negative Risk Adapter
     - MULTI_SEND: MultiSend contract for batch transactions

2. **EIP712 Signature Types**

   **For Wallet Deployment (existing):**
   ```typescript
   CreateProxy: [
     { name: 'paymentToken', type: 'address' },
     { name: 'payment', type: 'uint256' },
     { name: 'paymentReceiver', type: 'address' },
   ]
   ```

   **For Token Approvals (new):**
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

3. **Utility Functions**

   - **encodeApprove()**: Encodes ERC20 approve function calls
   - **encodeSetApprovalForAll()**: Encodes ERC721/1155 setApprovalForAll calls
   - **encodeMultiSendTransactions()**: Encodes all 7 approval transactions for MultiSend
   - **getSafeTxDomain()**: Creates domain separator for Safe wallet

4. **Transaction Structure**

   The token approval consists of 7 transactions executed via MultiSend:

   1. **CTF Contract Approval**: Approve COLLATERAL_TOKEN to CTF_CONTRACT for max(uint256)
   2. **CTF Exchange Approval**: Approve COLLATERAL_TOKEN to CTF_EXCHANGE for max(uint256)
   3. **CTF Exchange Operator**: Set CTF_EXCHANGE as operator on CTF_CONTRACT
   4. **Neg Risk Exchange Approval**: Approve COLLATERAL_TOKEN to NEG_RISK_EXCHANGE for max(uint256)
   5. **Neg Risk Adapter Approval**: Approve COLLATERAL_TOKEN to NEG_RISK_ADAPTER for max(uint256)
   6. **Neg Risk Exchange Operator**: Set NEG_RISK_EXCHANGE as operator on CTF_CONTRACT
   7. **Neg Risk Adapter Operator**: Set NEG_RISK_ADAPTER as operator on CTF_CONTRACT

5. **User Flow**

   ```
   Wallet Deployed
        ↓
   [Approve Tokens Button]
   ↓ (shows in TokenApprovals section)
   User Clicks "Approve Tokens"
        ↓
   Frontend fetches nonce from backend
        ↓
   Frontend encodes MultiSend transactions
        ↓
   Frontend requests EIP712 signature from user
        ↓
   Frontend sends signed SafeTx to backend
        ↓
   Backend executes via admin wallet
        ↓
   [✓ Approvals Complete]
        ↓
   [Deposit Button Enabled]
   ```

#### UI States

- **Before Wallet Deployment**: Shows "Enable Trading" button
- **After Wallet Deployment**: Shows "Token Approvals" section with:
  - Status indicator
  - "Approve Tokens" button
  - Progress display during execution
  - Error handling
- **After Approvals Complete**: Button shows "✓ Approvals Complete" and Deposit is enabled

#### State Management

- `approvalsCompleted`: Set of approved contracts
- `isProcessingApproval`: Boolean flag for approval in progress
- `currentApprovalStep`: String describing current step for user feedback

---

## Backend Implementation

### API Endpoints

#### 1. GET `/api/wallet/nonce/:proxyAddress`
Retrieves the current nonce for a multisig wallet.

**Request Parameters:**
- `proxyAddress` (path): Address of the multisig wallet proxy

**Response:**
```json
{
  "success": true,
  "proxyAddress": "0x...",
  "nonce": 0,
  "timestamp": "2024-01-16T..."
}
```

#### 2. POST `/api/wallet/approve-tokens`
Executes token approvals on the multisig wallet.

**Request Body:**
```json
{
  "proxyAddress": "0x...",
  "safeTx": {
    "to": "0x...",
    "value": 0,
    "data": "0x...",
    "operation": 1,
    "safeTxGas": 0,
    "baseGas": 0,
    "gasPrice": 0,
    "gasToken": "0x0000000000000000000000000000000000000000",
    "refundReceiver": "0x0000000000000000000000000000000000000000",
    "nonce": 0
  },
  "signature": {
    "r": "0x...",
    "s": "0x...",
    "v": 27
  }
}
```

**Response:**
```json
{
  "success": true,
  "transactionHash": "0x..."
}
```

### Service Methods

#### WalletDeploymentService

##### getProxyNonce(proxyAddress: string): Promise<number>
- Reads the current nonce from the Safe contract
- Uses the Safe contract's `nonce()` function
- Returns the nonce as an integer

##### executeTokenApprovals(params: ApprovalParams): Promise<ApprovalResult>
- Takes signed SafeTx data and user signature
- Calls `execTransaction` on the Safe contract via admin wallet
- Executes the MultiSend batch transaction
- Returns transaction hash on success

**Process:**
1. Validates inputs
2. Creates Safe contract instance at proxy address
3. Reconstructs signature from r, s, v components
4. Calls `execTransaction` with all SafeTx parameters
5. Waits for transaction confirmation
6. Returns transaction hash

### Key Implementation Details

1. **Admin Execution**: The admin wallet executes the transaction on behalf of the multisig
2. **Operation Type**: Set to 1 (DelegateCall) to execute through MultiSend
3. **Gas Parameters**: All set to 0 (Let the network determine gas)
4. **Signature Format**: Reconstructed as compact serialized format for Safe execution
5. **MultiSend Data Encoding**: Encodes 7 separate transactions with:
   - Operation = 0 (CALL) for each inner transaction
   - Target addresses for each contract
   - Encoded function data for each approval

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
ADMIN_PRIVATE_KEY=<private_key>
RPC_URL=https://rpc-amoy.polygon.technology/
COLLATERAL_TOKEN=0x7006b5a13d347dab68b9c2caabee2e6bc11296fd
CONDITIONAL_TOKENS_ADDRESS=0x53dBaF3856166A512dA9A53c470A820b8cD7195c
```

---

## ABI Files

### Safe.json
New ABI file created at `packages/backend/src/abis/Safe.json`

Contains functions:
- `nonce()`: Returns the current transaction nonce
- `execTransaction()`: Executes a signed transaction

---

## Error Handling

### Frontend
- Validates EIP712 domain configuration
- Validates all contract addresses
- Handles user signature rejection
- Displays clear error messages to user
- Retry logic through button re-click

### Backend
- Validates proxy address format
- Validates SafeTx structure
- Validates signature components
- Validates nonce retrieval
- Returns detailed error messages
- Logs all operations for debugging

---

## Testing Steps

1. **Deploy Multisig Wallet**
   - Click "Enable Trading"
   - Sign the deployment transaction
   - Wallet is created and deployed

2. **Approve Tokens**
   - Click "Approve Tokens" button
   - Sign the SafeTx when prompted
   - Backend executes the approval transaction
   - Button shows "✓ Approvals Complete"

3. **Verify Approvals**
   - Check blockchain for MultiSend transaction
   - Verify all 7 inner transactions executed
   - Check token approvals via Web3 call

4. **Deposit**
   - Deposit amount input becomes enabled
   - User can now proceed with deposits

---

## Future Enhancements

1. **Per-Contract Approvals**: Allow individual approvals instead of batch
2. **Approval Status**: Show which specific contracts are approved
3. **Reapproval**: Allow users to re-approve with different amounts
4. **Gas Estimation**: Calculate and display estimated gas costs
5. **Transaction Tracking**: Show transaction history and status

---

## Security Considerations

1. **Admin Key Storage**: Keep ADMIN_PRIVATE_KEY secure in environment variables
2. **Signature Verification**: Backend verifies signature format before execution
3. **Nonce Management**: Nonce is retrieved fresh each time to prevent replay
4. **Operation Type**: DelegateCall (1) is used for MultiSend execution
5. **Gas Limits**: All gas parameters set to 0 for flexibility

---

## Troubleshooting

### "Backend server is not accessible"
- Ensure backend is running on the configured port
- Check NEXT_PUBLIC_BACKEND_URL is correct
- Verify firewall/network connectivity

### "Invalid signature"
- Ensure user signs with the correct wallet
- Check that user has connected the wallet
- Verify no network switched during signing

### "Failed to get nonce"
- Verify proxy address is correct
- Ensure proxy address is deployed
- Check RPC connection

### Transaction Reverted
- Verify SafeTx parameters are correct
- Check nonce matches current value
- Ensure admin wallet has sufficient gas
- Verify MultiSend encoding is valid
