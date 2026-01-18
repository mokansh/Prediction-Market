## Multisig Wallet Deployment - Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          USER INTERACTION FLOW                           │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────┐
│  User    │
│ clicks   │
│ Deposit  │
└────┬─────┘
     │
     ▼
┌────────────────────┐
│  DepositModal      │
│  opens             │
└────┬───────────────┘
     │
     │ GET /api/wallet/check-deployment/:address
     ▼
┌────────────────────────────────────────────────────┐
│  Backend checks blockchain:                        │
│  - Compute proxy address (CREATE2)                 │
│  - Check if code exists at that address            │
└────┬───────────────────────────────────────────────┘
     │
     ├─────────┬────────────┐
     │         │            │
     ▼         ▼            ▼
  NOT      DEPLOYED     ERROR
  DEPLOYED
     │
     ▼
┌────────────────────┐
│ Show "Enable       │
│ Trading" Button    │
└────┬───────────────┘
     │
     │ User clicks
     ▼
┌────────────────────┐
│ Sign EIP-712       │
│ Message            │
│ (in MetaMask)      │
└────┬───────────────┘
     │
     │ signature (r, s, v)
     ▼
┌────────────────────────────────────────────────────┐
│ POST /api/wallet/deploy                            │
│ {                                                  │
│   userAddress: "0x...",                            │
│   signature: { r, s, v },                          │
│   paymentToken: "0x000...000",                     │
│   payment: 0,                                      │
│   paymentReceiver: "0x000...000"                   │
│ }                                                  │
└────┬───────────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────────────────┐
│ Backend Service:                                   │
│ walletDeploymentService.deployWallet()             │
└────┬───────────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────────────────┐
│ Smart Contract Call:                               │
│ SafeProxyFactory.createProxy(                      │
│   paymentToken,                                    │
│   payment,                                         │
│   paymentReceiver,                                 │
│   signature                                        │
│ )                                                  │
│                                                    │
│ (Admin wallet pays gas)                            │
└────┬───────────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────────────────┐
│ Contract Execution:                                │
│ 1. Recover user address from signature            │
│ 2. Deploy Safe proxy using CREATE2                │
│ 3. Initialize Safe with user as owner              │
│ 4. Emit ProxyCreation event                        │
└────┬───────────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────────────────┐
│ Backend receives transaction receipt              │
│ - Extract proxy address from event                 │
│ - Return to frontend                               │
└────┬───────────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────────────────┐
│ Frontend shows success:                            │
│ "Trading enabled! Your multisig wallet has been    │
│  deployed at: 0x..."                               │
└────┬───────────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────────────────┐
│ Modal updates to show deposit interface           │
└────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                          COMPONENT ARCHITECTURE                          │
└─────────────────────────────────────────────────────────────────────────┘

Frontend (React/Next.js)
┌─────────────────────────────────────────────────────────────┐
│  page.tsx                                                    │
│  ├── Deposit Button                                         │
│  └── DepositModal Component                                 │
│      ├── Check deployment status (useEffect)                │
│      ├── Enable Trading button                              │
│      ├── EIP-712 signature creation                         │
│      └── API calls to backend                               │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ HTTP(S)
                          ▼
Backend (Express/Node.js)
┌─────────────────────────────────────────────────────────────┐
│  server.ts                                                   │
│  └── /api/wallet routes                                     │
│                                                              │
│  routes/wallet.ts                                            │
│  ├── GET /check-deployment/:address                         │
│  ├── POST /deploy                                            │
│  └── GET /admin-address                                      │
│                                                              │
│  services/walletDeploymentService.ts                         │
│  ├── checkWalletDeployment()                                │
│  ├── deployWallet()                                          │
│  └── getAdminAddress()                                       │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ ethers.js
                          ▼
Blockchain (Polygon Amoy Testnet)
┌─────────────────────────────────────────────────────────────┐
│  SafeProxyFactory Contract                                   │
│  ├── computeProxyAddress(user)                              │
│  ├── createProxy(token, payment, receiver, sig)             │
│  ├── _getSigner(sig) - Verify EIP-712 signature            │
│  └── CREATE2 deployment of Safe proxy                       │
│                                                              │
│  Deployed Safe Wallet                                        │
│  └── Gnosis Safe multisig contract                          │
└─────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                          DATA STRUCTURES                                 │
└─────────────────────────────────────────────────────────────────────────┘

EIP-712 Domain:
{
  name: "Polymarket Contract Proxy Factory",
  chainId: 80002,
  verifyingContract: SAFE_PROXY_FACTORY_ADDRESS
}

EIP-712 Message Type:
CreateProxy {
  address paymentToken
  uint256 payment
  address paymentReceiver
}

Signature Message:
{
  paymentToken: "0x0000000000000000000000000000000000000000",
  payment: 0,
  paymentReceiver: "0x0000000000000000000000000000000000000000"
}

Signature Components:
{
  r: "0x...",  // 32 bytes
  s: "0x...",  // 32 bytes
  v: 27 or 28  // 1 byte
}


┌─────────────────────────────────────────────────────────────────────────┐
│                          SECURITY FLOW                                   │
└─────────────────────────────────────────────────────────────────────────┘

1. User Signs EIP-712 Message
   └── MetaMask shows readable message (not raw hex)
   
2. Signature Sent to Backend
   └── Backend receives: { userAddress, signature, ... }
   
3. Backend Calls Smart Contract
   └── Admin wallet sends transaction
   
4. Smart Contract Verifies Signature
   ├── Recreates message hash
   ├── Uses ecrecover to get signer address
   └── Ensures signer == expected user
   
5. Contract Deploys Wallet
   ├── Uses CREATE2 for deterministic address
   ├── Sets user as wallet owner
   └── Cannot be front-run or spoofed
   
6. Confirmation
   └── Event emitted, receipt returned


┌─────────────────────────────────────────────────────────────────────────┐
│                          ERROR HANDLING                                  │
└─────────────────────────────────────────────────────────────────────────┘

Frontend:
├── Connection errors → Display error message
├── User rejects signature → "Signature request was rejected"
├── Backend errors → Show error from response
└── Network errors → "Failed to enable trading"

Backend:
├── Invalid address → 400 "Invalid Ethereum address"
├── Invalid signature → 400 "Invalid signature"
├── Already deployed → Return existing address
├── Transaction fails → 500 "Failed to deploy wallet"
└── RPC errors → 500 "Internal server error"

Smart Contract:
├── Invalid signature → Transaction reverts
├── create2 fails → "create2 call failed"
└── Already deployed → CREATE2 returns address(0)
```
