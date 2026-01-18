# 📋 Setup Checklist - Multisig Wallet Deployment

Use this checklist to ensure everything is properly configured before deploying to production.

## ✅ Prerequisites

- [ ] Node.js v18+ installed
- [ ] npm or pnpm installed
- [ ] MetaMask browser extension installed
- [ ] Access to Polygon Amoy testnet
- [ ] SafeProxyFactory contract deployed on Amoy (or deployment plan)

## 🔧 Configuration Steps

### 1. Backend Configuration

- [ ] Navigate to `packages/backend/`
- [ ] Copy `.env.example` to `.env`
- [ ] Fill in environment variables:
  - [ ] `SAFE_PROXY_FACTORY_ADDRESS` - Address of deployed SafeProxyFactory
  - [ ] `ADMIN_PRIVATE_KEY` - Private key of admin wallet (KEEP SECRET!)
  - [ ] `RPC_URL` - Polygon Amoy RPC URL (default provided)
  - [ ] `PORT` - Backend port (default: 3001)
- [ ] Run `npm install` or `pnpm install`
- [ ] Verify no TypeScript errors: `npm run build` (optional)

### 2. Frontend Configuration

- [ ] Navigate to `packages/frontend/`
- [ ] Copy `.env.example` to `.env.local`
- [ ] Fill in environment variables:
  - [ ] `NEXT_PUBLIC_BACKEND_URL` - Backend URL (e.g., http://localhost:3001)
  - [ ] `NEXT_PUBLIC_SAFE_PROXY_FACTORY_ADDRESS` - Same as backend
- [ ] Run `npm install` or `pnpm install`
- [ ] Verify no TypeScript errors: `npm run build` (optional)

### 3. Admin Wallet Setup

- [ ] Create/use an admin wallet for gas payments
- [ ] Add admin private key to backend `.env`
- [ ] Get testnet MATIC from faucet:
  - [ ] Visit https://faucet.polygon.technology/
  - [ ] Request MATIC for admin wallet address
  - [ ] Verify balance (recommended: 0.5+ MATIC)
- [ ] IMPORTANT: Never commit or share admin private key!

### 4. Smart Contract Verification

- [ ] Confirm SafeProxyFactory is deployed on Polygon Amoy
- [ ] Verify contract address is correct in both .env files
- [ ] Test contract with read functions:
  - [ ] `computeProxyAddress(testAddress)` works
  - [ ] `domainSeparator` returns bytes32
  - [ ] `masterCopy` returns valid address

## 🧪 Testing Steps

### Local Development Testing

- [ ] Start backend: `cd packages/backend && npm run dev`
- [ ] Verify backend is running: http://localhost:3001/health
- [ ] Start frontend: `cd packages/frontend && npm run dev`
- [ ] Open browser: http://localhost:3000
- [ ] Test wallet connection:
  - [ ] Click "Connect Wallet"
  - [ ] Connect MetaMask
  - [ ] Switch to Polygon Amoy network
  - [ ] Verify wallet address shows in header
- [ ] Test deposit modal:
  - [ ] Click "Deposit" button
  - [ ] Modal opens successfully
  - [ ] Shows "Enable Trading" button (if wallet not deployed)
- [ ] Test wallet deployment:
  - [ ] Click "Enable Trading"
  - [ ] MetaMask prompts for signature
  - [ ] Sign the EIP-712 message
  - [ ] Wait for deployment (check console for logs)
  - [ ] Success message shows deployed address
- [ ] Verify on blockchain:
  - [ ] Copy deployed wallet address
  - [ ] Visit https://www.oklink.com/amoy
  - [ ] Search for address
  - [ ] Verify contract code exists

### API Testing (Optional)

- [ ] Test check-deployment endpoint:
  ```bash
  curl http://localhost:3001/api/wallet/check-deployment/0xYourAddress
  ```
- [ ] Test admin-address endpoint:
  ```bash
  curl http://localhost:3001/api/wallet/admin-address
  ```
- [ ] Verify responses are JSON with proper structure

## 🔒 Security Checklist

- [ ] `.env` files are in `.gitignore`
- [ ] Admin private key is secure and not committed
- [ ] Backend CORS is properly configured
- [ ] Frontend environment variables use `NEXT_PUBLIC_` prefix
- [ ] No sensitive data in frontend code
- [ ] RPC URL is reliable (consider private RPC for production)
- [ ] Rate limiting considered for production (TODO)

## 📊 Monitoring Setup (Production)

- [ ] Set up logging for wallet deployments
- [ ] Monitor admin wallet balance
- [ ] Track deployment success/failure rates
- [ ] Alert if admin wallet balance is low
- [ ] Database for deployment history (optional)

## 🚀 Deployment Checklist (Production)

### Backend

- [ ] Build backend: `npm run build`
- [ ] Test build: `npm start`
- [ ] Deploy to hosting service (Railway, Render, AWS, etc.)
- [ ] Set environment variables on hosting platform
- [ ] Configure CORS for production frontend URL
- [ ] Set up SSL/HTTPS
- [ ] Configure firewall rules

### Frontend

- [ ] Update `NEXT_PUBLIC_BACKEND_URL` to production URL
- [ ] Build frontend: `npm run build`
- [ ] Deploy to Vercel/Netlify/hosting service
- [ ] Verify environment variables are set
- [ ] Test on production URL
- [ ] Check SSL certificate

### Infrastructure

- [ ] Database setup (if tracking deployments)
- [ ] Redis/caching (if implementing rate limiting)
- [ ] Monitoring/alerting setup
- [ ] Backup admin wallet (secure multiple locations)
- [ ] Document recovery procedures

## 📝 Documentation Review

- [ ] Read `IMPLEMENTATION_SUMMARY.md`
- [ ] Read `WALLET_DEPLOYMENT_README.md`
- [ ] Review `FLOW_DIAGRAM.md`
- [ ] Understand EIP-712 signature format
- [ ] Understand SafeProxyFactory contract
- [ ] Document your specific deployment details

## 🐛 Troubleshooting Checklist

If something doesn't work:

- [ ] Check backend is running: `curl http://localhost:3001/health`
- [ ] Check frontend can reach backend (CORS issues?)
- [ ] Verify environment variables are loaded
- [ ] Check browser console for errors
- [ ] Check backend terminal for errors
- [ ] Verify admin wallet has MATIC
- [ ] Verify RPC URL is working
- [ ] Check contract address is correct
- [ ] Verify user is on Polygon Amoy network
- [ ] Try different browser/clear cache

## 📞 Support Resources

If you need help:

- [ ] Check logs in browser console (F12)
- [ ] Check backend logs in terminal
- [ ] Review error messages in modal
- [ ] Check blockchain explorer for transactions
- [ ] Review documentation files
- [ ] Check ethers.js documentation
- [ ] Check Safe contracts documentation

## ✨ Final Verification

Before marking as complete:

- [ ] Full end-to-end test successful
- [ ] Wallet deployed on-chain and verified
- [ ] User can see deployed wallet address
- [ ] All error cases handled gracefully
- [ ] UI/UX is smooth and intuitive
- [ ] Documentation is complete
- [ ] Team members can follow setup guide
- [ ] Production deployment plan is clear

---

## 🎉 You're Ready!

Once all items are checked, your multisig wallet deployment feature is ready to use!

**Date Completed:** ________________

**Deployed By:** ________________

**Production URLs:**
- Frontend: ________________
- Backend: ________________

**Contract Addresses:**
- SafeProxyFactory: ________________
- Admin Wallet: ________________

**Notes:**
________________
________________
________________


{"types":{"Order":[{"name":"salt","type":"uint256"},{"name":"maker","type":"address"},{"name":"signer","type":"address"},{"name":"taker","type":"address"},{"name":"tokenId","type":"uint256"},{"name":"makerAmount","type":"uint256"},{"name":"takerAmount","type":"uint256"},{"name":"expiration","type":"uint256"},{"name":"nonce","type":"uint256"},{"name":"feeRateBps","type":"uint256"},{"name":"side","type":"uint8"},{"name":"signatureType","type":"uint8"}],

"EIP712Domain":[{"name":"name","type":"string"},{"name":"version","type":"string"},{"name":"chainId","type":"uint256"},{"name":"verifyingContract","type":"address"}]},
"domain":{"name":"Polymarket CTF Exchange","version":"1","chainId":"137","verifyingContract":"0x4bfb41d5b3570defd03c39a9a4d8de6bd8b8982e"},"
primaryType":"Order","message":{"salt":"1083786480826","maker":"0x7227db3d7d86e3e11040fe55539f14b43674ab66","signer":"0xc5fdf4076b8f3a5357c5e395ab970b5b54098fef","taker":"0x0000000000000000000000000000000000000000","tokenId":"101434403359553929764780234916919166959889590658679054429843672204390513588056","makerAmount":"1000000","takerAmount":"4347800","expiration":"0","nonce":"0","feeRateBps":"0","side":"0","signatureType":"2"}}