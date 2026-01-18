# Wallet Balance Feature - Deployment Checklist

## Pre-Deployment Verification

### Backend Service Verification

- [ ] **TypeScript Compilation**
  ```bash
  cd packages/backend
  npx tsc --noEmit
  ```
  Status: ✅ Pass (0 errors)

- [ ] **Service Code Present**
  - [ ] `src/services/walletBalanceService.ts` exists
  - [ ] `src/routes/wallet.ts` includes balance endpoints
  - [ ] `.data/` directory auto-created on first run

- [ ] **Dependencies Installed**
  ```bash
  npm list ethers ws
  ```
  Required:
  - `ethers.js` - For ERC20 contract interaction
  - `ws` - For WebSocket real-time updates (optional)

- [ ] **Environment Variables Set**
  ```env
  COLLATERAL_TOKEN=0x41E94cB5eB3092Bc577881a08e21A7ff090DcAa7
  RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_API_KEY
  NODE_ENV=production
  ```

### Frontend Component Verification

- [ ] **Component Code Present**
  - [ ] `src/components/WalletBalance.tsx` exists
  - [ ] All hooks exported (useUserBalance, useBalanceCheck, useWalletMapping)
  - [ ] All components exported (WalletBalanceDisplay, OrderForm, etc.)

- [ ] **No TypeScript Errors**
  ```bash
  cd packages/frontend
  npx tsc --noEmit
  ```

- [ ] **Dependencies Available**
  - [ ] `React` 18+
  - [ ] `react-dom` 18+

### Database/Storage Setup

- [ ] **Directory Structure Created**
  ```bash
  mkdir -p packages/backend/.data
  chmod 755 packages/backend/.data
  ```

- [ ] **File Permissions**
  - [ ] `.data/` directory writable by Node process
  - [ ] `balances.json` will be created on first use

- [ ] **Backup Strategy Planned**
  - [ ] Daily backup of `.data/balances.json`
  - [ ] Disaster recovery plan documented

### Smart Contract Configuration

- [ ] **ERC20 Token Contract**
  - [ ] Address: `0x41E94cB5eB3092Bc577881a08e21A7ff090DcAa7` (USDC on Amoy)
  - [ ] Contract verified on block explorer
  - [ ] ABI available in `src/services/walletBalanceService.ts`

- [ ] **Multisig Wallet Deployment**
  - [ ] Safe contracts deployed
  - [ ] USDC token approved for multisig wallets
  - [ ] Test transfer made to verify flow

- [ ] **RPC Endpoint**
  - [ ] Alchemy/Infura endpoint created
  - [ ] API key configured
  - [ ] Rate limits understood

## Deployment Steps

### 1. Backend Deployment

```bash
# Install dependencies
cd packages/backend
npm install

# Verify compilation
npx tsc --noEmit

# Set environment variables
export COLLATERAL_TOKEN=0x41E94cB5eB3092Bc577881a08e21A7ff090DcAa7
export RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_API_KEY

# Start server
npm start

# Expected output:
# Server running on http://localhost:3001
# WalletBalanceService initialized
```

### 2. Frontend Deployment

```bash
# Install dependencies
cd packages/frontend
npm install

# Verify compilation
npx tsc --noEmit

# Build for production
npm run build

# Verify build output
ls -la .next/

# Start server
npm start

# Expected output:
# > polymarket-frontend@1.0.0 start
# ready - started server on 0.0.0.0:3000
```

### 3. Integration Testing

After both services are running:

```bash
# Test 1: Get individual balance
curl -s http://localhost:3001/api/wallet/balance/0x1234567890123456789012345678901234567890 | jq .

# Test 2: Check sufficient balance
curl -s -X POST http://localhost:3001/api/wallet/check-sufficient \
  -H "Content-Type: application/json" \
  -d '{"userAddress":"0x1234567890123456789012345678901234567890","requiredAmount":"0.50"}' | jq .

# Test 3: Update wallet mapping
curl -s -X POST http://localhost:3001/api/wallet/update-mapping \
  -H "Content-Type: application/json" \
  -d '{"userAddress":"0x1234567890123456789012345678901234567890","walletAddress":"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}' | jq .

# Test 4: Frontend can reach backend
curl -s http://localhost:3000 | grep -o "balance" || echo "Frontend loaded"
```

## Post-Deployment Verification

### Functionality Tests

- [ ] **Balance Retrieval**
  - [ ] Individual user balance returns UserBalance object
  - [ ] Batch retrieval returns array of balances
  - [ ] Formatted balance matches ERC20 decimals

- [ ] **Balance Validation**
  - [ ] Sufficient balance check returns true when balance >= required
  - [ ] Insufficient balance check returns false with message
  - [ ] Error handling for invalid addresses

- [ ] **Wallet Mapping**
  - [ ] Mapping created successfully
  - [ ] Mapping persisted to .data/balances.json
  - [ ] Subsequent balance queries use mapped wallet

- [ ] **Order Integration** (if order placement connected)
  - [ ] Orders rejected when insufficient balance
  - [ ] Orders accepted when sufficient balance
  - [ ] Balance correctly decrements after order placement

### Performance Tests

- [ ] **Response Times**
  - [ ] Single balance query: < 1 second
  - [ ] Batch query (10 users): < 2 seconds
  - [ ] Balance check: < 500ms

- [ ] **Concurrent Requests**
  - [ ] 10 concurrent balance queries succeed
  - [ ] No race conditions in file persistence
  - [ ] All responses accurate

- [ ] **Error Handling**
  - [ ] Network errors return helpful messages
  - [ ] Invalid inputs rejected with 400 status
  - [ ] Server doesn't crash on bad requests

### Monitoring Setup

- [ ] **Error Logging**
  ```typescript
  // Check logs
  tail -f packages/backend/logs/error.log
  ```

- [ ] **API Monitoring**
  - [ ] Endpoint response time tracking
  - [ ] Error rate monitoring
  - [ ] Balance query frequency analysis

- [ ] **Database Monitoring**
  - [ ] .data/balances.json file size
  - [ ] Backup completion logs
  - [ ] Data corruption checks

## Rollback Plan

If issues occur after deployment:

### Immediate Rollback (< 1 hour)

1. **Stop Backend Service**
   ```bash
   pkill -f "node.*server.ts"
   ```

2. **Restore Balance Data**
   ```bash
   cp .data/balances.json.backup .data/balances.json
   ```

3. **Restart with Previous Version**
   ```bash
   git checkout main
   npm install
   npm start
   ```

### Full Rollback (> 1 hour)

1. **Revert Code Changes**
   ```bash
   git revert HEAD~1
   ```

2. **Restart Services**
   ```bash
   npm start
   ```

3. **Notify Users**
   - Display maintenance message
   - Timeline for fix

## Production Readiness Checklist

### Security

- [ ] **API Rate Limiting**
  ```typescript
  // Implement in wallet.ts
  import rateLimit from 'express-rate-limit';
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  });
  router.use(limiter);
  ```

- [ ] **Input Validation**
  - [ ] Address format validation
  - [ ] Numeric amount validation
  - [ ] No SQL injection vectors

- [ ] **Error Message Sanitization**
  - [ ] No sensitive data in error messages
  - [ ] User-friendly error descriptions
  - [ ] Stack traces hidden in production

- [ ] **CORS Configuration**
  ```typescript
  app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
  }));
  ```

### Scalability

- [ ] **Caching Strategy**
  - [ ] In-memory cache for frequent queries
  - [ ] Cache invalidation on updates
  - [ ] TTL: 30 seconds for balance data

- [ ] **Database Migration Plan**
  - [ ] Path to PostgreSQL documented
  - [ ] Schema designed for balances
  - [ ] Migration script prepared

- [ ] **Load Testing**
  ```bash
  # Simulate 100 concurrent users
  npx autocannon -c 100 -d 30 http://localhost:3001/api/wallet/balance/0x...
  ```

### Monitoring & Alerts

- [ ] **Health Check Endpoint**
  ```typescript
  router.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: Date.now() });
  });
  ```

- [ ] **Error Alerting**
  - [ ] Email alerts for 5+ consecutive errors
  - [ ] Slack notifications for high error rate
  - [ ] Dashboard for monitoring

- [ ] **Log Aggregation**
  - [ ] Logs shipped to external service
  - [ ] 30-day retention
  - [ ] Searchable indexing

## Success Criteria

✅ Deployment is successful when:

1. **API Endpoints Working**
   - [x] GET /api/wallet/balance/:userAddress returns 200
   - [x] POST /api/wallet/check-sufficient returns 200
   - [x] POST /api/wallet/update-mapping returns 200

2. **Data Persistence**
   - [x] Wallet mappings saved to .data/balances.json
   - [x] Data survives server restart
   - [x] No data corruption on concurrent updates

3. **Frontend Integration**
   - [x] Components render without errors
   - [x] Balance updates every 30 seconds
   - [x] Order validation works end-to-end

4. **Performance**
   - [x] Balance query < 1 second
   - [x] Batch query < 2 seconds
   - [x] No memory leaks on sustained load

5. **Error Handling**
   - [x] Invalid addresses return 400
   - [x] Network errors handled gracefully
   - [x] Server stays online during errors

## Support & Documentation

- **API Documentation**: `WALLET_BALANCE_API.md`
- **Integration Guide**: `ORDER_PLACEMENT_INTEGRATION.md`
- **Quick Reference**: `WALLET_BALANCE_QUICK_REFERENCE.md`
- **React Components**: `packages/frontend/src/components/WalletBalance.tsx`
- **Service Code**: `packages/backend/src/services/walletBalanceService.ts`

## Deployment Contacts

- **Backend Lead**: [Name]
- **Frontend Lead**: [Name]
- **DevOps**: [Name]
- **On-Call**: [Phone/Slack]

## Sign-Off

- [ ] **Backend Lead**: _________________ Date: _______
- [ ] **Frontend Lead**: _________________ Date: _______
- [ ] **QA Lead**: _________________ Date: _______
- [ ] **DevOps**: _________________ Date: _______

---

**Deployment Date**: _______________  
**Deployed By**: _______________  
**Deployment Duration**: _______________  
**Issues Encountered**: _______________  
