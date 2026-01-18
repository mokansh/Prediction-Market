# Wallet Balance Feature - Architecture & Flow Diagrams

## 1. System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         POLYMARKET SYSTEM                               │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                                  │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────┐  ┌────────────────────────────────┐   │
│  │  WalletBalanceDisplay       │  │  OrderForm                     │   │
│  │  - Shows available balance  │  │  - Order size input            │   │
│  │  - Shows locked amounts     │  │  - Price selection             │   │
│  │  - Auto-refreshes 30s       │  │  - Validates balance           │   │
│  │                             │  │  - Places order                │   │
│  └────────┬────────────────────┘  └────────┬─────────────────────┘   │
│           │                                 │                          │
│           │   useUserBalance()              │ useBalanceCheck()        │
│           │                                 │                          │
│  ┌────────┴─────────────────────────────────┴──────────────────────┐   │
│  │  Custom Hooks                                                   │   │
│  │  • useUserBalance() - Fetch balance, auto-refresh             │   │
│  │  • useBalanceCheck() - Validate order amount                  │   │
│  │  • useWalletMapping() - Link user to wallet                   │   │
│  └──────────────────┬───────────────────────────────────────────┘   │
│                     │                                                  │
│                     │ fetch() / API calls                              │
│                     │                                                  │
└─────────────────────┼──────────────────────────────────────────────────┘
                      │
                      │
                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     BACKEND (Express.js)                                │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  REST API Routes (src/routes/wallet.ts)                         │   │
│  │                                                                  │   │
│  │  GET  /api/wallet/balance/:userAddress                          │   │
│  │  GET  /api/wallet/balance/batch?addresses=...                   │   │
│  │  POST /api/wallet/check-sufficient                              │   │
│  │  POST /api/wallet/update-mapping                                │   │
│  │                                                                  │   │
│  └──────────────────┬──────────────────────────────────────────────┘   │
│                     │                                                    │
│                     ▼                                                    │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  WalletBalanceService (Singleton)                               │  │
│  │  (src/services/walletBalanceService.ts)                         │  │
│  │                                                                   │  │
│  │  ┌────────────────────────────────────────────────────────┐    │  │
│  │  │ Key Methods:                                           │    │  │
│  │  │ • getUserBalance(address)                              │    │  │
│  │  │ • getBatchBalances(addresses[])                        │    │  │
│  │  │ • hasSufficientBalance(address, amount)                │    │  │
│  │  │ • updateWalletMapping(userAddr, walletAddr)            │    │  │
│  │  │ • loadFromFile() / saveToFile()                        │    │  │
│  │  └────────────────────────────────────────────────────────┘    │  │
│  │                      │                                          │  │
│  │                      │ Reads/Writes                             │  │
│  │                      ▼                                          │  │
│  │           ┌──────────────────────┐                              │  │
│  │           │  .data/balances.json │  (File Persistence)         │  │
│  │           └──────────────────────┘                              │  │
│  │                                                                   │  │
│  │  ┌─────────────────────────────────────────────────────────┐   │  │
│  │  │ ERC20 Token Interaction                                 │   │  │
│  │  │ • ethers.Contract(tokenAddress, ABI, provider)         │   │  │
│  │  │ • balanceOf(walletAddress)                              │   │  │
│  │  │ • decimals()                                             │   │  │
│  │  │ • formatUnits(balance, decimals)                        │   │  │
│  │  └─────────────────────────────────────────────────────────┘   │  │
│  │                      │                                          │  │
│  │                      │ RPC Call                                 │  │
│  │                      ▼                                          │  │
│  │           ┌──────────────────────┐                              │  │
│  │           │  RPC Provider        │                              │  │
│  │           │  (Alchemy/Infura)    │                              │  │
│  │           └──────────────────────┘                              │  │
│  │                      │                                          │  │
│  │                      │ JSON-RPC Call                            │  │
│  │                      ▼                                          │  │
│  │           ┌──────────────────────┐                              │  │
│  │           │  ERC20 Contract      │                              │  │
│  │           │  (Blockchain)        │                              │  │
│  │           │  (Polygon Amoy)      │                              │  │
│  │           └──────────────────────┘                              │  │
│  │                                                                   │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## 2. User Balance Query Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ User Requests Balance in Frontend                                   │
│ (WalletBalanceDisplay component mounts)                             │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
                   ▼
        ┌──────────────────────────┐
        │ useUserBalance() Hook    │
        │ called with userAddress  │
        └──────────────┬───────────┘
                       │
                       ▼
        ┌──────────────────────────────────────────┐
        │ fetch('/api/wallet/balance/0x1234...')   │
        │                                          │
        │ GET request to backend                   │
        └──────────────┬───────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────────┐
        │ Backend Route: /api/wallet/balance       │
        │                                          │
        │ 1. Validate address format               │
        │ 2. Check if wallet mapping exists        │
        │    - If not, check .data/balances.json   │
        │    - If found, use mapped wallet addr    │
        └──────────────┬───────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────────┐
        │ WalletBalanceService.getUserBalance()    │
        │                                          │
        │ 1. Get wallet address from mapping       │
        │ 2. Create ethers.Contract instance       │
        │    - Token address                       │
        │    - ERC20 ABI                           │
        │    - RPC Provider                        │
        │ 3. Call contract.balanceOf(wallet)       │
        └──────────────┬───────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────────┐
        │ RPC Call to Blockchain                   │
        │                                          │
        │ eth_call → balanceOf function            │
        │ returns raw balance (in wei)             │
        └──────────────┬───────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────────┐
        │ Format Balance                           │
        │                                          │
        │ 1. Get token decimals                    │
        │ 2. formatUnits(balance, decimals)        │
        │ 3. Create UserBalance object             │
        │    - collateralBalance (raw)             │
        │    - collateralBalanceFormatted (5.00)   │
        │    - availableForOrders                  │
        │    - lockedInOrders                      │
        │    - lastUpdated                         │
        └──────────────┬───────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────────┐
        │ Return JSON Response                     │
        │ {                                        │
        │   "success": true,                       │
        │   "balance": {                           │
        │     "collateralBalanceFormatted": "5"   │
        │     ...                                  │
        │   }                                      │
        │ }                                        │
        └──────────────┬───────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────────┐
        │ Frontend Receives Response               │
        │                                          │
        │ useUserBalance updates state:            │
        │ - balance = data.balance                 │
        │ - loading = false                        │
        │ - error = null                           │
        └──────────────┬───────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────────┐
        │ Component Re-renders                     │
        │                                          │
        │ Display: "Balance: 5.00 USDC"            │
        │          "Available: 4.50 USDC"          │
        │          "Locked: 0.50 USDC"             │
        └──────────────────────────────────────────┘
                       │
                       ▼ (after 30 seconds)
        ┌──────────────────────────────────────────┐
        │ Auto-Refresh Timer Triggers              │
        │                                          │
        │ Hook calls refetch() → back to step 2    │
        └──────────────────────────────────────────┘
```

## 3. Order Placement with Balance Validation

```
┌─────────────────────────────────────────────────────────┐
│ User Submits Order Form                                 │
│ - Order Size: 1.00 USDC                                 │
│ - Type: Buy YES                                         │
│ - Price: 0.6                                            │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
        ┌──────────────────────────────────────┐
        │ OrderForm Component Handler          │
        │ validateAndSubmitOrder()             │
        │                                      │
        │ Step 1: Validate Input               │
        │ - Order size > 0? ✓                  │
        │ - Valid price? ✓                     │
        └──────────────┬───────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────┐
        │ Step 2: Check Balance                │
        │                                      │
        │ POST /api/wallet/check-sufficient    │
        │ {                                    │
        │   "userAddress": "0x1234...",        │
        │   "requiredAmount": "1.00"           │
        │ }                                    │
        └──────────────┬───────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────┐
        │ Backend Validates Balance            │
        │                                      │
        │ 1. Get user balance                  │
        │ 2. Parse available amount            │
        │ 3. Compare: available >= required    │
        │ 4. Return { hasSufficientBalance }   │
        └──────────────┬───────────────────────┘
                       │
         ┌─────────────┴────────────────┐
         │                              │
         ▼                              ▼
  ┌─────────────┐            ┌──────────────────┐
  │  CASE 1:    │            │  CASE 2:         │
  │ Sufficient  │            │ Insufficient     │
  │ Balance     │            │ Balance          │
  │             │            │                  │
  │ Return:     │            │ Return:          │
  │ {           │            │ {                │
  │  success    │            │  success: true   │
  │  :true,     │            │  hasSufficient   │
  │  hasSuff    │            │  Balance: false  │
  │  icient     │            │  message:        │
  │  Balance    │            │  "Insufficient"  │
  │  :true      │            │ }                │
  │ }           │            │                  │
  └──────┬──────┘            └────────┬─────────┘
         │                           │
         ▼                           ▼
   ┌──────────────────┐      ┌──────────────────┐
   │ Frontend Shows:  │      │ Frontend Shows:  │
   │ "Balance OK"     │      │ "❌ Insufficient │
   │ ✓ Proceed →      │      │ Available: X"    │
   └────────┬─────────┘      └──────────────────┘
            │
            ▼
   ┌──────────────────────────────────────────┐
   │ Step 3: Place Order                      │
   │                                          │
   │ POST /api/orders/place                   │
   │ {                                        │
   │   "userAddress": "0x1234...",            │
   │   "orderSize": 1.00,                     │
   │   "orderType": "buy",                    │
   │   "priceYes": 0.6,                       │
   │   "priceNo": 0.4                         │
   │ }                                        │
   └────────┬─────────────────────────────────┘
            │
            ▼
   ┌──────────────────────────────────────────┐
   │ Backend Double-Checks Balance            │
   │ (Defense in Depth)                       │
   │                                          │
   │ 1. Call hasSufficientBalance() again     │
   │ 2. If still insufficient → reject        │
   │ 3. If sufficient → proceed                │
   └────────┬─────────────────────────────────┘
            │
            ▼
   ┌──────────────────────────────────────────┐
   │ Order Matching                           │
   │                                          │
   │ 1. Generate Order ID                     │
   │ 2. Match against order book              │
   │ 3. Execute matches                       │
   │ 4. Update order status                   │
   │ 5. Broadcast to WebSocket subscribers    │
   └────────┬─────────────────────────────────┘
            │
            ▼
   ┌──────────────────────────────────────────┐
   │ Update User Balance                      │
   │                                          │
   │ 1. Calculate locked amount               │
   │ 2. availableForOrders -= locked          │
   │ 3. lockedInOrders += locked              │
   │ 4. Save to .data/balances.json           │
   │ 5. Notify frontend via WebSocket         │
   └────────┬─────────────────────────────────┘
            │
            ▼
   ┌──────────────────────────────────────────┐
   │ Return Success Response                  │
   │                                          │
   │ {                                        │
   │   "success": true,                       │
   │   "orderId": "ORD-123-abc",              │
   │   "matches": 1                           │
   │ }                                        │
   └────────┬─────────────────────────────────┘
            │
            ▼
   ┌──────────────────────────────────────────┐
   │ Frontend Updates UI                      │
   │                                          │
   │ 1. Clear form                            │
   │ 2. Show "✅ Order Placed"                │
   │ 3. Auto-refresh balance                  │
   │ 4. Update order list                     │
   └──────────────────────────────────────────┘
```

## 4. Data Flow Diagram

```
                    ┌──────────────────────────┐
                    │  User Address            │
                    │  0x1234...               │
                    └───────────┬──────────────┘
                                │
                                ▼
                    ┌──────────────────────────┐
                    │ .data/balances.json      │
                    │ (Wallet Mapping Store)   │
                    │                          │
                    │ {                        │
                    │  "0x1234...": {          │
                    │    walletAddress:        │
                    │    "0xabcd..."           │
                    │  }                       │
                    │ }                        │
                    └───────────┬──────────────┘
                                │
                                ▼
                    ┌──────────────────────────┐
                    │ Multisig Wallet Address  │
                    │ 0xabcd...                │
                    └───────────┬──────────────┘
                                │
                                ▼
                    ┌──────────────────────────────────┐
                    │ ERC20 Token Contract              │
                    │ Address: 0x41E94cB...             │
                    │                                  │
                    │ function balanceOf(               │
                    │   account: 0xabcd...             │
                    │ ) returns (uint256)              │
                    │                                  │
                    │ → Returns: 5000000000000000000   │
                    │            (5 USDC in wei)       │
                    └───────────┬──────────────────────┘
                                │
                                ▼
                    ┌──────────────────────────┐
                    │ UserBalance Object       │
                    │                          │
                    │ {                        │
                    │  userAddress:            │
                    │  "0x1234...",            │
                    │  walletAddress:          │
                    │  "0xabcd...",            │
                    │  collateralBalance:      │
                    │  "5000000000000000000",  │
                    │  collatBal formatted:    │
                    │  "5.00",                 │
                    │  availableForOrders:     │
                    │  "4.50",                 │
                    │  lockedInOrders:         │
                    │  "0.50",                 │
                    │  lastUpdated:            │
                    │  1705250000000           │
                    │ }                        │
                    └──────────────────────────┘
```

## 5. Component Dependency Tree

```
WalletDashboard (Root)
│
├─ WalletBalanceDisplay
│  └─ useUserBalance()
│     ├─ fetch(/api/wallet/balance/:addr)
│     └─ setInterval(refetch, 30000)
│
├─ OrderForm
│  ├─ useUserBalance()  [same hook as above]
│  │  └─ fetch(/api/wallet/balance/:addr)
│  │
│  └─ useBalanceCheck()
│     └─ fetch(/api/wallet/check-sufficient)
│
└─ WalletSetupForm
   └─ useWalletMapping()
      └─ fetch(/api/wallet/update-mapping)


All Hooks Share:
├─ userAddress (prop)
├─ Loading states
├─ Error handling
└─ Type safety (UserBalance, BalanceCheckResponse)
```

## 6. Service Architecture

```
Frontend Components
        ↓
   (fetch API)
        ↓
Express.js Routes
        ↓
        ├─ Input Validation
        │  - Address format
        │  - Numeric amounts
        │
        ├─ Error Handling
        │  - 400 Bad Request
        │  - 500 Server Error
        │
        └─ Response Formatting
           - JSON structure
           - Success flags
           - Timestamps
        │
        ▼
WalletBalanceService (Singleton)
        │
        ├─ File I/O Layer
        │  - .data/balances.json
        │  - loadFromFile()
        │  - saveToFile()
        │
        ├─ Blockchain Layer
        │  - ethers.Contract
        │  - RPC calls
        │  - ERC20 ABI
        │
        └─ Business Logic
           - getUserBalance()
           - hasSufficientBalance()
           - updateWalletMapping()
```

## 7. Request/Response Timeline

```
Time    Frontend             Network            Backend             Blockchain
────────────────────────────────────────────────────────────────────────────
T0ms    ┌─ fetch()
        │
        │                   POST request →
T50ms   │                                      ┌─ Validate input
        │                                      │
        │                                      ├─ Get wallet mapping
        │                                      │
        │                                      ├─ Create contract
        │
        │                                      ├─ Call balanceOf()
        │                                                              → RPC Call
        │                                                              
T150ms  │                                                             ← Return balance
        │                                      
        │                                      ├─ Get decimals
        │                                                              → RPC Call
        │                                      
T200ms  │                                                             ← Return decimals
        │
        │                                      ├─ Format balance
        │                                      │
        │                                      └─ Return JSON
        │                   ← JSON Response
        │
T250ms  ┌─ Parse Response
        │
        ├─ Update State
        │
        └─ Re-render UI ✓
        
Total Latency: ~250ms
Blockchain Calls: 2 (balanceOf + decimals)
```

---

These diagrams show:
1. Overall system architecture and components
2. Detailed balance query flow
3. Complete order placement workflow
4. Data transformation pipeline
5. React component hierarchy
6. Service architecture layers
7. Request/response timing

All diagrams reflect the actual implementation in the codebase.
