# 🚀 Railway Backend Deployment - Complete Setup

## ✅ Setup Complete!

All necessary files and documentation have been created for deploying your backend to Railway.

---

## 📁 Files Created

### Configuration Files (in `packages/backend/`)
```
✅ railway.json          - Railway build configuration
✅ Dockerfile            - Docker container image
✅ .env.production       - Production environment template
✅ .dockerignore         - Docker build optimization
```

### Documentation Files (in project root)
```
✅ RAILWAY_DEPLOYMENT_GUIDE.md              - Step-by-step guide (detailed)
✅ RAILWAY_DEPLOYMENT_CHECKLIST.md         - Pre/post deployment checklist
✅ RAILWAY_ENVIRONMENT_VARIABLES.md        - Environment variables reference
✅ RAILWAY_BACKEND_SETUP_COMPLETE.md       - Setup overview
```

### Automation Script (in `scripts/`)
```
✅ deploy-railway.sh                        - Interactive deployment script
```

---

## 🚀 Quick Start (Choose One)

### Option 1: Automated Script (Fastest)
```bash
chmod +x scripts/deploy-railway.sh
./scripts/deploy-railway.sh
```
This script will:
- Check Railway CLI is installed
- Initialize Railway project
- Add PostgreSQL & Redis
- Prompt for environment variables
- Guide you through deployment

### Option 2: Manual Steps (Most Control)
```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Go to backend
cd packages/backend

# 4. Initialize
railway init

# 5. Add services
railway add    # Choose PostgreSQL
railway add    # Choose Redis

# 6. Set variables (see RAILWAY_ENVIRONMENT_VARIABLES.md)
railway variables set RPC_URL=https://rpc-amoy.polygon.technology/
railway variables set SAFE_PROXY_FACTORY_ADDRESS=0x...
railway variables set ADMIN_PRIVATE_KEY=0x...
railway variables set CORS_ORIGIN=https://your-frontend.vercel.app

# 7. Deploy
railway up
```

### Option 3: GitHub Auto-Deploy
1. Push code to GitHub
2. In Railway dashboard → Connect GitHub
3. Select repository and watch path: `packages/backend`
4. Enable auto-deploy

---

## 📋 What You Need Before Starting

| Item | Where to Get | Example |
|------|-------------|---------|
| **Railway Account** | https://railway.app | Sign up with GitHub |
| **RPC URL** | Polygon | `https://rpc-amoy.polygon.technology/` |
| **Admin Private Key** | Your wallet | `0x...` |
| **Safe Contract Address** | Your deployment | `0x...` |
| **Frontend URL** | Vercel (later) | `https://app.vercel.app` |

---

## 📚 Documentation Guide

Read these in order:

1. **[RAILWAY_BACKEND_SETUP_COMPLETE.md](./RAILWAY_BACKEND_SETUP_COMPLETE.md)** (5 min read)
   - Overview of what's set up
   - Architecture diagram
   - Expected outcomes

2. **[RAILWAY_ENVIRONMENT_VARIABLES.md](./RAILWAY_ENVIRONMENT_VARIABLES.md)** (10 min read)
   - All environment variables explained
   - How to set them
   - Security best practices

3. **[RAILWAY_DEPLOYMENT_GUIDE.md](./RAILWAY_DEPLOYMENT_GUIDE.md)** (15 min read)
   - Complete deployment walkthrough
   - Step-by-step instructions
   - Troubleshooting tips

4. **[RAILWAY_DEPLOYMENT_CHECKLIST.md](./RAILWAY_DEPLOYMENT_CHECKLIST.md)** (Reference)
   - Use during/after deployment
   - Verification steps
   - Post-deployment tests

---

## 🎯 Deployment Flow

```
Start
  ↓
[1] Install Railway CLI
  ↓
[2] Login to Railway
  ↓
[3] Initialize project
  ↓
[4] Add PostgreSQL + Redis
  ↓
[5] Set environment variables
  ↓
[6] Deploy with: railway up
  ↓
[7] Get public URL
  ↓
[8] Test endpoints
  ↓
Success! ✅
```

---

## 🔐 Security Reminders

⚠️ **NEVER commit these to git:**
- `ADMIN_PRIVATE_KEY`
- `.env` files with secrets
- Private keys
- Database credentials

✅ **DO:**
- Use Railway's secrets management
- Keep keys in environment only
- Rotate keys periodically
- Use dedicated admin wallet

---

## 💰 Cost Estimate

| Component | Free Tier | Paid |
|-----------|-----------|------|
| Node Server | $5/month trial | $5-20/mo |
| PostgreSQL | 5GB included | $10/mo + |
| Redis | 256MB included | $5/mo + |
| **Total** | ~$5 trial | ~$20-30/mo |

See Railway pricing for current rates.

---

## 📊 System Requirements

Your backend will have:
- ✅ Node.js 20 (auto-managed)
- ✅ PostgreSQL database
- ✅ Redis cache
- ✅ WebSocket support
- ✅ HTTPS/SSL (auto)
- ✅ 99.9% uptime SLA

---

## 🧪 Testing After Deployment

Once deployed, test these:

```bash
# Health check
curl https://your-railway-url/health
# Expected: {"status":"ok","timestamp":"..."}

# API docs
curl https://your-railway-url/api-docs

# WebSocket (install wscat first)
npm install -g wscat
wscat -c wss://your-railway-url
# Send: {"type":"subscribe","marketId":"market1"}
```

---

## 🔗 Next Steps

After backend is deployed:

1. **Update Frontend**
   - Set `NEXT_PUBLIC_API_URL` to your Railway URL
   - See: `packages/frontend/.env.local`

2. **Deploy Frontend to Vercel**
   - Following same pattern as backend
   - Use: https://vercel.com/new

3. **Monitor & Maintain**
   - Check logs regularly
   - Monitor resource usage
   - Set up alerts

4. **Setup CI/CD** (Optional)
   - Auto-deploy on git push
   - Railway integrates with GitHub

---

## 📞 Getting Help

| Resource | Link |
|----------|------|
| **Railway Docs** | https://docs.railway.app |
| **Dashboard** | https://railway.app |
| **Status Page** | https://status.railway.app |
| **Community** | Discord (in Railway dashboard) |

---

## 📝 Command Reference

```bash
# Login
railway login

# Initialize project
railway init

# Add service
railway add

# Set variables
railway variables set KEY=value

# View variables
railway variables list

# Deploy
railway up

# View logs
railway logs -f

# View history
railway history

# Rollback
railway rollback <deployment-id>

# Open dashboard
railway open

# List services
railway services
```

---

## ✅ Deployment Readiness Checklist

Before running deployment:

- [ ] Railway account created
- [ ] Railway CLI installed
- [ ] Code committed to git
- [ ] `pnpm-lock.yaml` committed
- [ ] `npm run build` works locally
- [ ] `npm run dev` works locally
- [ ] All required env variables documented
- [ ] Read RAILWAY_DEPLOYMENT_GUIDE.md

---

## 🎉 What Happens After Deployment

✅ Your backend will be live at: `https://your-railway-url`

✅ You can:
- Make API requests from anywhere
- Connect frontend to backend
- Scale horizontally if needed
- View logs and metrics
- Rollback deployments
- Update environment variables anytime

---

## 📞 Support & Troubleshooting

**Common Issues:**
- Build fails? → Run `npm run build` locally first
- DB connection error? → Check `DATABASE_URL` is set
- CORS error? → Verify `CORS_ORIGIN` matches frontend
- Out of memory? → Upgrade Railway resources

See **RAILWAY_DEPLOYMENT_GUIDE.md** for detailed troubleshooting.

---

## 🚀 You're Ready!

Everything is set up. Choose your deployment method above and get started!

**Questions?** Check the documentation files or Railway docs.

**Ready to deploy?** Start with Option 1 or Option 2 above.

---

**Status:** 🟢 Ready to Deploy  
**Date:** January 20, 2025  
**Version:** 1.0  
**Backend:** Express.js + TypeScript  
**Hosting:** Railway  

Good luck! 🚀
