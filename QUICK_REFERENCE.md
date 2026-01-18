# 🚀 Quick Reference - Multisig Wallet Deployment

## 📁 Key Files

| File | Purpose |
|------|---------|
| `frontend/src/components/DepositModal.tsx` | Main deposit modal component |
| `backend/src/services/walletDeploymentService.ts` | Wallet deployment logic |
| `backend/src/routes/wallet.ts` | API endpoints |
| `backend/.env` | Backend configuration (SECRET!) |
| `frontend/.env.local` | Frontend configuration |

## 🔑 Environment Variables

### Backend (.env)
```bash
SAFE_PROXY_FACTORY_ADDRESS=0x...
ADMIN_PRIVATE_KEY=0x...
RPC_URL=https://rpc-amoy.polygon.technology/
PORT=3001
```

### Frontend (.env.local)
```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_SAFE_PROXY_FACTORY_ADDRESS=0x...
```

## 🏃 Quick Start

```bash
# Backend
cd packages/backend
npm install
npm run dev

# Frontend (new terminal)
cd packages/frontend
npm install
npm run dev
```

## 🌐 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/wallet/check-deployment/:address` | Check if wallet deployed |
| POST | `/api/wallet/deploy` | Deploy new wallet |
| GET | `/api/wallet/admin-address` | Get admin address |

## 🔄 User Flow

1. User clicks "Deposit"
2. Modal checks deployment status
3. If not deployed → "Enable Trading" button
4. User signs EIP-712 message
5. Backend deploys wallet
6. Success! Wallet ready

## 🎯 EIP-712 Message Structure

```typescript
{
  paymentToken: "0x0000000000000000000000000000000000000000",
  payment: 0,
  paymentReceiver: "0x0000000000000000000000000000000000000000"
}
```

## 🐛 Common Issues

| Problem | Solution |
|---------|----------|
| Modal not opening | Check wallet connected |
| Deployment fails | Check admin wallet has MATIC |
| CORS errors | Verify BACKEND_URL |
| Signature rejected | User needs to approve in MetaMask |

## 📊 Testing

```bash
# Check backend health
curl http://localhost:3001/health

# Check deployment status
curl http://localhost:3001/api/wallet/check-deployment/0xYourAddress

# Get admin address
curl http://localhost:3001/api/wallet/admin-address
```

## 🔒 Security Notes

- ⚠️ NEVER commit `.env` files
- ⚠️ Keep admin private key secure
- ⚠️ Use private RPC in production
- ✅ Signatures verified on-chain
- ✅ Deterministic addresses (CREATE2)

## 💰 Gas Costs

- ~200k-300k gas per deployment
- ~0.001-0.003 MATIC per wallet
- Admin wallet pays all gas fees

## 📚 Documentation

| File | What's Inside |
|------|---------------|
| `IMPLEMENTATION_SUMMARY.md` | Complete implementation details |
| `WALLET_DEPLOYMENT_README.md` | Full technical documentation |
| `FLOW_DIAGRAM.md` | Visual flow diagrams |
| `SETUP_CHECKLIST.md` | Step-by-step setup guide |

## 🆘 Get Help

1. Check browser console (F12)
2. Check backend terminal logs
3. Review error messages
4. Check blockchain explorer
5. Read documentation files

## 🎨 Component Props

### DepositModal
```typescript
interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}
```

## 🌍 Network Details

- **Network:** Polygon Amoy Testnet
- **Chain ID:** 80002 (0x13882)
- **RPC:** https://rpc-amoy.polygon.technology/
- **Explorer:** https://www.oklink.com/amoy
- **Faucet:** https://faucet.polygon.technology/

## 📦 Dependencies

### Frontend
- ethers ^6.10.0
- axios ^1.13.2
- next 16.1.1

### Backend
- ethers ^6.10.0
- express ^4.19.2
- dotenv ^16.4.5
- cors ^2.8.5

## 🔧 NPM Commands

```bash
# Backend
npm run dev     # Start development server
npm run build   # Build for production
npm start       # Run production build

# Frontend
npm run dev     # Start development server
npm run build   # Build for production
npm start       # Run production build
```

## ✨ Features

✅ Gasless onboarding (admin pays gas)
✅ EIP-712 signatures (user-friendly)
✅ Deterministic addresses (CREATE2)
✅ Safe/Gnosis wallet integration
✅ Automatic deployment status check
✅ Error handling & user feedback
✅ TypeScript type safety
✅ Comprehensive documentation

---

**Need more details?** See `IMPLEMENTATION_SUMMARY.md`
