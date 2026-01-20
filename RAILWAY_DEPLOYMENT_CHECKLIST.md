# Railway Backend Deployment Checklist

## Pre-Deployment ✅

- [ ] **Create Railway Account**
  - Visit https://railway.app
  - Sign up with GitHub/Google
  - Create/join a team (optional)

- [ ] **Install Railway CLI**
  ```bash
  npm install -g @railway/cli
  ```
  Verify: `railway --version`

- [ ] **Prepare Code**
  - [ ] All code committed to git
  - [ ] `pnpm-lock.yaml` committed
  - [ ] `.env.production` configured
  - [ ] `railway.json` in place
  - [ ] `Dockerfile` in place (optional, Railway can auto-detect)

- [ ] **Verify Build**
  ```bash
  cd packages/backend
  npm run build
  # Should create dist/ folder with no errors
  ```

- [ ] **Test Locally**
  ```bash
  npm run dev
  # Should start on http://localhost:3001
  # Check: curl http://localhost:3001/health
  ```

## Deployment Steps 🚀

### Step 1: Initialize Railway
```bash
railway login
cd packages/backend
railway init
```
- [ ] Successfully logged in
- [ ] Project created/selected

### Step 2: Add Services
```bash
railway add
```
- [ ] PostgreSQL service added
  - [ ] Username set
  - [ ] Password set (secure)
  - [ ] Database name set
- [ ] Redis service added
  - [ ] Optional password set

### Step 3: Set Environment Variables
```bash
railway variables set RPC_URL=https://rpc-amoy.polygon.technology/
railway variables set SAFE_PROXY_FACTORY_ADDRESS=0x...
railway variables set ADMIN_PRIVATE_KEY=0x... # KEEP SECRET
railway variables set CORS_ORIGIN=https://your-frontend.vercel.app
railway variables set NODE_ENV=production
railway variables set PORT=3001
```
- [ ] All required variables set
- [ ] Private keys NOT in git
- [ ] CORS_ORIGIN matches frontend URL

### Step 4: Deploy
```bash
railway up
```
- [ ] Build successful
- [ ] All services connected
- [ ] No deployment errors

### Step 5: Verify Deployment
```bash
# Get URL from Railway dashboard
curl https://your-railway-url/health
```
- [ ] Returns `{"status":"ok"}`
- [ ] Logs show no errors
- [ ] Database connected
- [ ] Redis connected

## Post-Deployment 🎯

- [ ] **Test API Endpoints**
  - [ ] Health check: `/health` → 200 OK
  - [ ] Swagger: `/api-docs` → JSON response
  - [ ] Admin endpoints functional
  - [ ] Markets endpoints functional
  - [ ] Orders endpoints functional

- [ ] **Test WebSocket**
  ```bash
  wscat -c wss://your-railway-url
  # Send: {"type":"subscribe","marketId":"market1"}
  # Expect: subscribed confirmation
  ```
  - [ ] WebSocket connects
  - [ ] Subscribe/unsubscribe works
  - [ ] Order updates received

- [ ] **Test Database**
  - [ ] Migrations applied
  - [ ] Tables created
  - [ ] Sample data loaded

- [ ] **Test Redis**
  - [ ] Cache hits working
  - [ ] Sessions stored
  - [ ] Order queue functioning

- [ ] **Monitor Resources**
  - [ ] CPU usage reasonable (< 80%)
  - [ ] Memory usage stable
  - [ ] No connection errors
  - [ ] Log output clean (no errors)

## Frontend Integration ✅

- [ ] **Update Frontend .env**
  ```env
  NEXT_PUBLIC_API_URL=https://your-railway-backend-url
  ```

- [ ] **Test API Connectivity**
  - [ ] Requests from frontend reach backend
  - [ ] CORS headers correct
  - [ ] Authentication working

- [ ] **Deploy Frontend to Vercel**
  - [ ] Frontend repository ready
  - [ ] Environment variables set
  - [ ] Deployment successful

## Security Checklist 🔒

- [ ] **Secrets Secured**
  - [ ] `ADMIN_PRIVATE_KEY` NOT in git
  - [ ] Database password in Railway secrets
  - [ ] Redis password in Railway secrets
  - [ ] API keys in Railway secrets

- [ ] **CORS Configured**
  - [ ] `CORS_ORIGIN` set to frontend domain
  - [ ] Not set to `*` in production
  - [ ] Credentials properly handled

- [ ] **Environment Set**
  - [ ] `NODE_ENV=production`
  - [ ] Debug mode disabled
  - [ ] Sensitive logging disabled

- [ ] **Database Security**
  - [ ] Strong password set
  - [ ] Backups enabled
  - [ ] SSL connections used

## Monitoring & Maintenance 📊

- [ ] **Set Up Monitoring**
  - [ ] Enable Railway metrics
  - [ ] Configure alerts for high usage
  - [ ] Monitor error rates

- [ ] **Set Up Logging**
  - [ ] Railway logs configured
  - [ ] Error tracking enabled
  - [ ] Performance metrics tracked

- [ ] **Backup Plan**
  - [ ] Database backups scheduled
  - [ ] Auto-deploy disabled (manual deployments safer)
  - [ ] Rollback procedure documented

- [ ] **Performance**
  - [ ] Response times < 200ms
  - [ ] WebSocket connections stable
  - [ ] No memory leaks
  - [ ] Load tested

## Rollback Procedure 🔄

If deployment fails:
1. Check Railway logs: `railway logs`
2. Identify error
3. Fix code locally
4. Rebuild: `npm run build`
5. Test: `npm run dev`
6. Push to git
7. Redeploy: `railway up`

Or rollback to previous:
```bash
railway history
railway rollback <deployment-id>
```

## Useful Commands 📝

```bash
# View current project
railway projects

# Switch project
railway switch

# View environment
railway variables list

# View logs
railway logs -f  # Follow logs

# View services
railway services

# Open dashboard
railway open

# Deploy
railway up

# View deployment history
railway history
```

## Troubleshooting 🔧

| Issue | Solution |
|-------|----------|
| **Build fails** | Check `npm run build` locally first |
| **Port conflict** | Remove PORT variable, Railway assigns automatically |
| **DB connection error** | Verify DATABASE_URL is set via `railway variables list` |
| **WebSocket fails** | Check CORS_ORIGIN and frontend URL |
| **Out of memory** | Increase Railway resource allocation |
| **Slow startup** | Check if migrations running on startup |

## Post-Deployment Support

- Railway Docs: https://docs.railway.app
- Status Page: https://status.railway.app
- Support: support@railway.app
- Community: Discord link in Railway dashboard

---

**Status:** ⭕ Ready to Deploy  
**Last Updated:** January 20, 2025  
**Backend URL:** (will be assigned after deployment)
