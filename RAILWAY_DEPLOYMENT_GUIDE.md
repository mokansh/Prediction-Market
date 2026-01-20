# Backend Deployment to Railway

Complete guide for deploying the backend to Railway.

## Prerequisites

1. **Railway Account** - Sign up at [railway.app](https://railway.app)
2. **Railway CLI** - Install locally
3. **Git** - Your code must be in git
4. **Node.js & PNPM** - For local testing

## Step 1: Install Railway CLI

```bash
npm install -g @railway/cli
```

Or using npm/yarn:
```bash
npm install -g @railway/cli
# or
yarn global add @railway/cli
```

## Step 2: Login to Railway

```bash
railway login
```

This will open your browser to authenticate. Follow the prompts and return to terminal.

## Step 3: Create Railway Project

**Option A: From Repository Root**

```bash
cd /home/user/Documents/Prediction-Market

# Create a new Railway project
railway init

# Select or create a new project
# Follow the prompts to name your project
```

**Option B: Link Existing GitHub Repo**

1. Go to [railway.app](https://railway.app)
2. Click "Create New Project"
3. Select "GitHub Repository"
4. Choose your Prediction-Market repository
5. Railway will auto-detect the monorepo structure

## Step 4: Navigate to Backend Directory

```bash
cd packages/backend
```

## Step 5: Add Services to Railway

### Add PostgreSQL Database

```bash
railway add
# Select "PostgreSQL"
# Follow prompts to configure
```

### Add Redis Cache

```bash
railway add
# Select "Redis"
# Follow prompts to configure
```

## Step 6: Set Environment Variables

Railway automatically exposes database credentials. Configure additional variables:

```bash
railway variables set RPC_URL=https://rpc-amoy.polygon.technology/
railway variables set SAFE_PROXY_FACTORY_ADDRESS=0xYourAddress
railway variables set ADMIN_PRIVATE_KEY=0xYourPrivateKey
railway variables set CORS_ORIGIN=https://your-frontend.vercel.app
railway variables set NODE_ENV=production
railway variables set PORT=3001
```

**Important Security Note:**
- Never commit `ADMIN_PRIVATE_KEY` to git
- Use Railway's secret management for sensitive data
- Railway UI provides a secure variables section

## Step 7: Configure Build Settings

Railway auto-detects Node.js projects. The `railway.json` file helps with custom configuration.

Verify Railway detects:
- ✅ Build command: `npm run build` (or `pnpm build`)
- ✅ Start command: `node dist/server.js`
- ✅ Node version: 20+

If needed, update `railway.json`:

```json
{
  "build": {
    "builder": "nixpacks"
  }
}
```

## Step 8: Deploy

### Option A: Deploy from CLI

```bash
# From packages/backend directory
railway up

# Or with specific service
railway deploy --service backend
```

### Option B: Deploy from Dashboard

1. Go to [railway.app](https://railway.app)
2. Open your project
3. Select the backend service
4. Click "Deploy"

### Option C: Auto-Deploy via GitHub

1. In Railway dashboard, connect GitHub
2. Select your repository
3. Enable "Watch Path" → `packages/backend`
4. Enable auto-deploy on push

## Step 9: Verify Deployment

### Check Health Endpoint

```bash
# Get your Railway backend URL from dashboard
curl https://your-railway-backend-url.railway.app/health

# Expected response:
# {"status":"ok","timestamp":"2025-01-20T..."}
```

### View Logs

```bash
# From CLI
railway logs

# Or in Railway dashboard → Logs tab
```

### Monitor Deployment

In Railway dashboard:
- ✅ Green status = Running
- 🟡 Yellow = Building/Starting
- 🔴 Red = Error

## Step 10: Configure Frontend Integration

Update your frontend `.env.local`:

```env
NEXT_PUBLIC_API_URL=https://your-railway-backend-url.railway.app
```

Or use Railway's provided URL from the dashboard.

## Environment Variables Reference

| Variable | Example | Required | Type |
|----------|---------|----------|------|
| `RPC_URL` | `https://rpc-amoy.polygon.technology/` | ✅ | Public |
| `ADMIN_PRIVATE_KEY` | `0x...` | ✅ | Secret |
| `SAFE_PROXY_FACTORY_ADDRESS` | `0x...` | ✅ | Public |
| `DATABASE_URL` | Auto-set by Railway | ✅ | Secret |
| `REDIS_URL` | Auto-set by Railway | ✅ | Secret |
| `PORT` | `3001` | ✅ | Public |
| `NODE_ENV` | `production` | ✅ | Public |
| `CORS_ORIGIN` | `https://frontend.vercel.app` | ⭕ | Public |

**Note:** Railway automatically provides `DATABASE_URL` and `REDIS_URL` when you add PostgreSQL and Redis services.

## Troubleshooting

### Build Fails

**Problem:** Railway can't find dependencies
```bash
# Solution: Ensure pnpm-lock.yaml is committed
git add pnpm-lock.yaml
git commit -m "Add pnpm lock file"
git push
```

### Port Already in Use

**Problem:** Port 3001 conflicts
```bash
# Solution: Railway assigns a random port by default
# Remove PORT variable or let Railway assign it
railway variables delete PORT
```

### Database Connection Error

**Problem:** Can't connect to PostgreSQL
```bash
# Solution: Verify DATABASE_URL is set
railway variables list | grep DATABASE_URL

# If missing, reconnect PostgreSQL plugin
railway add # Add PostgreSQL if not present
```

### WebSocket Connection Failed

**Problem:** WebSocket connections not working
```
# Solution: Verify Railway supports WebSockets (it does)
# Check CORS_ORIGIN matches frontend URL
# Ensure frontend uses correct backend URL
```

## Scaling Up

### Increase Resource Allocation

1. Go to Railway dashboard → Project settings
2. Select backend service
3. Increase CPU/Memory (Pay-as-you-go billing)

### Monitoring

- Enable metrics in Railway dashboard
- Monitor CPU, Memory, Network usage
- Set up alerts for high usage

## Rollback Deployment

```bash
# View deployment history
railway history

# Rollback to previous deployment
railway rollback <deployment-id>
```

## Next Steps

1. ✅ Deploy backend to Railway
2. ⭕ Deploy frontend to Vercel (see `VERCEL_DEPLOYMENT_GUIDE.md`)
3. ⭕ Configure database migrations
4. ⭕ Set up monitoring and logging
5. ⭕ Enable CI/CD with GitHub Actions

## Quick Reference Commands

```bash
# View current project
railway projects

# Switch project
railway switch

# View environment variables
railway variables list

# Set variable
railway variables set KEY=value

# View logs
railway logs

# Deploy
railway up

# View services
railway services

# Remove service
railway remove <service>
```

## Support

- Railway Docs: https://docs.railway.app
- Dashboard: https://railway.app
- Support: support@railway.app

---

**Last Updated:** January 20, 2025
