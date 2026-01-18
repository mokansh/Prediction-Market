# Token Approval Flow Diagram

## Complete User Journey

```
┌─────────────────────────────────────────────────────────────────┐
│                      USER STARTS DEPOSIT                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│         Is MultiSig Wallet Deployed?                             │
└──────────────────────────┬──────────────────────────────────────┘
                    NO ┌───┴────┐ YES
                      │        │
                      ▼        ▼
            ┌─────────────┐   ┌──────────────────────┐
            │Show "Enable │   │Show "Token Approvals"│
            │ Trading"    │   │     Section          │
            └──────┬──────┘   └──────┬───────────────┘
                   │                 │
                   ▼                 ▼
            ┌──────────────┐   ┌─────────────────────────┐
            │User Clicks   │   │User Clicks "Approve     │
            │"Enable       │   │Tokens"                  │
            │Trading"      │   └────────┬────────────────┘
            └──────┬───────┘            │
                   │                    ▼
                   │           ┌────────────────────┐
                   │           │Fetch Nonce from    │
                   │           │Backend             │
                   │           └────────┬───────────┘
                   │                    │
                   │                    ▼
                   │           ┌────────────────────────┐
                   │           │Encode 7 Approvals     │
                   │           │via MultiSend          │
                   │           └────────┬──────────────┘
                   │                    │
                   │                    ▼
                   │           ┌──────────────────────────┐
                   │           │Request EIP712 Signature │
                   │           │(SafeTx type)            │
                   │           └────────┬────────────────┘
                   │                    │
    ┌──────────────┼────────────────────┼──────────────┐
    │    USER SIGNS WITH WALLET         │               │
    └──────────────┼────────────────────┼──────────────┘
                   │                    │
                   ▼                    ▼
         ┌──────────────────┐ ┌──────────────────────┐
         │Send Signature    │ │Send Signature (r,s,v)│
         │to Backend        │ │to Backend            │
         │(Deployment)      │ │(Approvals)           │
         └─────────┬────────┘ └─────────┬────────────┘
                   │                    │
                   │                    ▼
                   │        ┌─────────────────────────┐
                   │        │Backend Admin Executes   │
                   │        │SafeTx via Safe Contract │
                   │        └────────┬────────────────┘
                   │                 │
                   ▼                 ▼
         ┌──────────────────┐ ┌──────────────────────┐
         │✓ Wallet Created  │ │✓ Approvals Complete  │
         │at ProxyAddress   │ │ 7 Txs Executed       │
         └──────┬───────────┘ └─────────┬────────────┘
                │                       │
                └───────────┬───────────┘
                            │
                            ▼
                ┌──────────────────────────┐
                │Update UI: Show Proxy     │
                │and Enable Deposit Button │
                └──────────┬───────────────┘
                           │
                           ▼
                ┌──────────────────────────┐
                │User Can Now Input Amount │
                │and Click Deposit         │
                └──────────────────────────┘
```

---

## Frontend Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DepositModal Component                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  State Management:                                          │
│  ├─ isWalletDeployed (bool | null)                         │
│  ├─ approvalsCompleted (Set<string>)                        │
│  ├─ isProcessingApproval (bool)                            │
│  ├─ currentApprovalStep (string | null)                    │
│  └─ proxyAddress (string | null)                           │
│                                                              │
│  Utilities:                                                 │
│  ├─ encodeApprove()                                         │
│  ├─ encodeSetApprovalForAll()                              │
│  ├─ encodeMultiSendTransactions()                          │
│  └─ getSafeTxDomain()                                      │
│                                                              │
│  Handlers:                                                  │
│  ├─ checkWalletDeployment()                                │
│  ├─ handleEnableTrading()                                  │
│  └─ handleApproveTokens()                                  │
│                                                              │
│  UI Sections:                                               │
│  ├─ Not Connected                                           │
│  ├─ Checking Deployment                                    │
│  ├─ Wallet Not Deployed                                    │
│  ├─ Wallet Deployed + Token Approvals:                     │
│  │  ├─ Approval Status                                     │
│  │  ├─ Approve Tokens Button                               │
│  │  ├─ Progress Display                                    │
│  │  ├─ Error Messages                                      │
│  │  ├─ Deposit Amount Input                                │
│  │  └─ Deposit Button                                      │
│  └─ Loading States                                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Backend API Flow

```
┌──────────────────────────────────────────────────────────────┐
│             Frontend Token Approval Request                   │
└───────────────────────┬──────────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
    ┌──────────────┐          ┌──────────────────┐
    │GET /nonce    │          │POST /approve     │
    │:proxyAddress │          │-tokens           │
    └──────┬───────┘          └───────┬──────────┘
           │                          │
           ▼                          ▼
    ┌──────────────────┐    ┌─────────────────────┐
    │Validate Address  │    │Validate Inputs:    │
    │Read Safe nonce() │    │- ProxyAddress      │
    │Return nonce      │    │- SafeTx structure  │
    └──────┬───────────┘    │- Signature (r,s,v) │
           │                └────────┬────────────┘
           │                         │
           └────────────┬────────────┘
                        │
                        ▼
         ┌──────────────────────────────┐
         │WalletDeploymentService       │
         │                              │
         │getProxyNonce()               │
         │├─ Create Safe Contract       │
         │├─ Call nonce()               │
         │└─ Return number              │
         │                              │
         │executeTokenApprovals()       │
         │├─ Create Safe Contract       │
         │├─ Reconstruct Signature      │
         │├─ Call execTransaction()     │
         │├─ Wait confirmation          │
         │└─ Return txHash              │
         └───────────────┬──────────────┘
                         │
                         ▼
         ┌──────────────────────────────┐
         │Polygon Amoy RPC              │
         │                              │
         │Safe Contract at ProxyAddress │
         │├─ Read nonce()               │
         │└─ Execute SafeTx             │
         │   (MultiSend batch)          │
         └──────────────┬───────────────┘
                        │
                        ▼
         ┌──────────────────────────────┐
         │MultiSend Contract            │
         │                              │
         │Executes 7 Approvals:         │
         │1. USDC→CTF approve           │
         │2. USDC→CTF Ex approve        │
         │3. CTF→CTF Ex setApprove      │
         │4. USDC→NegRisk Ex approve    │
         │5. USDC→NegRisk Ad approve    │
         │6. CTF→NegRisk Ex setApprove  │
         │7. CTF→NegRisk Ad setApprove  │
         └──────────────┬───────────────┘
                        │
                        ▼
         ┌──────────────────────────────┐
         │Return Response to Frontend   │
         │                              │
         │{                             │
         │  success: true,              │
         │  transactionHash: "0x..."    │
         │}                             │
         └──────────────────────────────┘
```

---

## Data Structure: MultiSend Encoding

```
MultiSend Data Format (for 7 Approvals):

┌─────────────────────────────────────────────────────────────┐
│ Transaction 1: Approve USDC to CTF                          │
├─────────────────────────────────────────────────────────────┤
│ Operation:    00 (CALL)                                     │
│ To:           <CTF_ADDR> (20 bytes)                         │
│ Value:        0 (32 bytes)                                  │
│ Data Length:  <length> (32 bytes)                           │
│ Data:         <encoded approve()> (variable)                │
└─────────────────────────────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ Transaction 2: Approve USDC to CTF Exchange                 │
│ (same structure...)                                         │
└─────────────────────────────────────────────────────────────┘
                          ▼
                    ... (Tx 3-7) ...
                          │
                          ▼
        ┌──────────────────────────────────┐
        │ SafeTx                           │
        ├──────────────────────────────────┤
        │ to: MultiSend address            │
        │ value: 0                         │
        │ data: [All encodings above]      │
        │ operation: 1 (DelegateCall)      │
        │ safeTxGas: 0                     │
        │ baseGas: 0                       │
        │ gasPrice: 0                      │
        │ gasToken: 0x0000...              │
        │ refundReceiver: 0x0000...        │
        │ nonce: <current_nonce>           │
        └──────────────────────────────────┘
                          │
                          ▼
         ┌────────────────────────────────┐
         │ EIP712 Sign with User Wallet    │
         │ Domain: {chainId, verifier}     │
         │ Type: SafeTx (10 fields)        │
         │ Signature: (r, s, v)            │
         └────────────────────────────────┘
```

---

## Contract Interaction Timeline

```
Time    Frontend                 Backend              Blockchain
────    ────────────────────────────────────────────────────────

T0      User clicks
        "Approve Tokens"
        │
T1      │                       (idle)                (idle)
        Fetch nonce ────────────▶
        │
T2      │◀───────── nonce ──────
        │
T3      Encode 7 txs
        │
T4      Sign EIP712
        │ (user signs wallet)
        │
T5      Send signed
        SafeTx ─────────────────▶
        │
T6      │                       Validate inputs
        │
T7      │                       Create Safe contract
        │
T8      │                       Reconstruct signature
        │
T9      │                       Send execTransaction ──────▶
        │                                              Safe.execTransaction()
        │
T10     │                                                ▼
        │                                             MultiSend.multiSend()
        │                                             (Execute 7 txs)
        │
T11     │                                                ▼
        │                                             Approve 1: USDC→CTF
        │
T12     │                                                ▼
        │                                             Approve 2: USDC→CTF Ex
        │
T13     │                                                ▼
        │                                             ... Tx 3-7 ...
        │
T14     │                       Wait for
        │                       confirmation
        │
T15     │                       Get txHash            ✓ Confirmed
        │
T16     │◀────── {success, txHash} ─────
        │
T17     Update UI: "✓ Approvals Complete"
        │
T18     Enable Deposit button
        │
T19     Ready for deposit ──────────────────────────── Ready
```

---

## Error Handling Tree

```
Token Approval Flow
        │
        ├─ Frontend Validation
        │  ├─ Invalid proxy address ─▶ "Invalid proxy address"
        │  ├─ Missing SafeTx data ──▶ "Invalid SafeTx data"
        │  ├─ Invalid signature ────▶ "Invalid signature"
        │  └─ Network error ────────▶ "Backend not accessible"
        │
        ├─ User Actions
        │  ├─ Signature rejected ───▶ "Signature rejected"
        │  ├─ Wrong wallet ────────▶ "Transaction failed"
        │  └─ Cancelled ───────────▶ "Approval cancelled"
        │
        ├─ Backend Processing
        │  ├─ Address validation ───▶ "Invalid proxy address"
        │  ├─ SafeTx validation ───▶ "Invalid SafeTx data"
        │  ├─ Signature validation ─▶ "Invalid signature format"
        │  └─ Nonce check ────────▶ "Nonce mismatch"
        │
        └─ Blockchain Execution
           ├─ Insufficient gas ────▶ "Out of gas"
           ├─ Invalid operation ──▶ "Operation failed"
           ├─ Access denied ──────▶ "Access denied"
           └─ Reverted ──────────▶ "Transaction reverted"
```

---

## State Diagram: UI States

```
                    ┌─────────────────────┐
                    │   Initial State     │
                    │  (Modal Closed)     │
                    └──────────┬──────────┘
                               │
                    Open Modal ▼
                    ┌─────────────────────┐
                    │ Checking Deployment │
                    │   (Spinner)         │
                    └──────────┬──────────┘
                        ┌──────┴──────┐
                   Not  │             │  Yes
                Deployed│             │Deployed
                        ▼             ▼
        ┌──────────────────────┐   ┌────────────────────┐
        │Show "Enable Trading" │   │"Token Approvals"   │
        │      Button          │   │     Section        │
        └──────────┬───────────┘   └────────┬───────────┘
                   │                        │
        User Clicks│                User Clicks
        "Enable"   │                "Approve"
                   ▼                        ▼
        ┌──────────────────────┐   ┌────────────────────┐
        │  Deploying Wallet    │   │Processing Approval │
        │      (Spinner)       │   │    (Spinner)       │
        └──────────┬───────────┘   └────────┬───────────┘
                   │                        │
           Success ▼                Success ▼
        ┌──────────────────────┐   ┌────────────────────┐
        │ "✓ Trading Enabled"  │   │"✓ Approvals        │
        │ Show Approvals       │   │ Complete"          │
        │ Section              │   │ Enable Deposit     │
        └──────────┬───────────┘   └────────┬───────────┘
                   │                        │
                   │                        │
                   └────────────┬───────────┘
                                │
                    Can Proceed ▼
                    ┌──────────────────┐
                    │ Deposit Ready    │
                    │ Input + Button   │
                    │   Enabled        │
                    └──────────────────┘
```

---

## Security: Signature Validation Flow

```
┌────────────────────────────────────────┐
│ User Signs with Connected Wallet       │
│ EIP712 Message: SafeTx struct          │
└─────────────────────┬──────────────────┘
                      │
                      ▼
┌────────────────────────────────────────┐
│ Frontend Receives (r, s, v) signature  │
│ Validates format                       │
└─────────────────────┬──────────────────┘
                      │
                      ▼
┌────────────────────────────────────────┐
│ Frontend sends to Backend              │
│ /api/wallet/approve-tokens             │
└─────────────────────┬──────────────────┘
                      │
                      ▼
┌────────────────────────────────────────┐
│ Backend Validates:                     │
│ ✓ r, s, v format correct               │
│ ✓ ProxyAddress valid                   │
│ ✓ SafeTx structure valid               │
└─────────────────────┬──────────────────┘
                      │
                      ▼
┌────────────────────────────────────────┐
│ Backend Reconstructs Signature         │
│ ethers.Signature.from({r, s, v})       │
└─────────────────────┬──────────────────┘
                      │
                      ▼
┌────────────────────────────────────────┐
│ Admin Wallet Calls execTransaction     │
│ Passes signature to Safe contract      │
└─────────────────────┬──────────────────┘
                      │
                      ▼
┌────────────────────────────────────────┐
│ Safe Contract Verifies Signature       │
│ Executes if valid                      │
└─────────────────────┬──────────────────┘
                      │
                      ▼
┌────────────────────────────────────────┐
│ ✓ Transaction Confirmed                │
│ All 7 approvals executed               │
└────────────────────────────────────────┘
```

