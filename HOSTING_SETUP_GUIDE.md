# Backend & Frontend Hosting Setup - Complete Guide

## 🎯 Current Status

Your **backend is fully configured for Railway deployment**. Everything you need is ready!

---

## 📋 What's Been Set Up

### ✅ Backend (Railway) - COMPLETE
- Configuration files created
- Docker setup ready
- Environment templates provided
- Comprehensive documentation written
- Automation script available

### ⭕ Frontend (Vercel) - Next Step
- After backend is deployed

---

## 🚀 Get Started in 3 Steps

### Step 1: Start Backend Deployment (NOW)
```bash
# Option A: Automated (easiest)
chmod +x scripts/deploy-railway.sh
./scripts/deploy-railway.sh

# Option B: Manual (most control)
npm install -g @railway/cli
railway login
cd packages/backend
railway init
# ... follow prompts
```

📖 **Read first:** [QUICK_START_RAILWAY.md](./QUICK_START_RAILWAY.md)

### Step 2: Wait for Deployment to Complete
- Build runs automatically (~3-5 minutes)
- Services connect
- Get your public URL: `https://your-backend-xyz.railway.app`

### Step 3: Deploy Frontend to Vercel
```bash
# After backend is live
cd packages/frontend
vercel deploy
# Set NEXT_PUBLIC_API_URL to your Railway backend URL
```

---

## 📁 Documentation Files

All in the project root:

| File | Purpose | Read Time |
|------|---------|-----------|
| **[QUICK_START_RAILWAY.md](./QUICK_START_RAILWAY.md)** | Start here! Overview & quick options | 5 min |
| **[RAILWAY_BACKEND_DEPLOYMENT_INDEX.md](./RAILWAY_BACKEND_DEPLOYMENT_INDEX.md)** | Complete index of all docs | 5 min |
| **[RAILWAY_ENVIRONMENT_VARIABLES.md](./RAILWAY_ENVIRONMENT_VARIABLES.md)** | Environment variables guide | 10 min |
| **[RAILWAY_DEPLOYMENT_GUIDE.md](./RAILWAY_DEPLOYMENT_GUIDE.md)** | Step-by-step deployment | 15 min |
| **[RAILWAY_DEPLOYMENT_CHECKLIST.md](./RAILWAY_DEPLOYMENT_CHECKLIST.md)** | Pre/post deployment checklist | Reference |
| **[RAILWAY_VISUAL_GUIDE.md](./RAILWAY_VISUAL_GUIDE.md)** | Architecture diagrams | 10 min |
| **[RAILWAY_BACKEND_SETUP_COMPLETE.md](./RAILWAY_BACKEND_SETUP_COMPLETE.md)** | Setup overview | 5 min |

---

## 🔧 What You Need Before Deploying

| Item | Where to Get | Example |
|------|-------------|---------|
| **Railway Account** | https://railway.app | Sign up free |
| **Railway CLI** | `npm install -g @railway/cli` | v5.0+ |
| **RPC URL** | Polygon Amoy | `https://rpc-amoy.polygon.technology/` |
| **Admin Private Key** | Your wallet | `0x...` |
| **Safe Factory Address** | Your deployment | `0x...` |

---

## 🎯 Backend Deployment Architecture

```
Your Code (Git)
    ↓
GitHub Repository
    ↓
Railway (Auto-Deploy)
    ↓
┌─────────────────────────┐
│  Railway Container      │
│  ├─ Node.js 20          │
│  ├─ Express Server      │
│  ├─ WebSocket Server    │
│  └─ Health Check        │
└─────────────────────────┘
    ↓
┌─────────────────────────┐
│  Connected Services     │
│  ├─ PostgreSQL (DB)     │
│  ├─ Redis (Cache)       │
│  └─ Environment Vars    │
└─────────────────────────┘
    ↓
Public HTTPS URL
(Vercel Frontend connects here)
```

---

## 📊 What You're Hosting

### Backend Stack
- **Server:** Express.js + TypeScript
- **Database:** PostgreSQL
- **Cache:** Redis
- **Real-time:** WebSocket
- **Blockchain:** RPC connection to Polygon

### Frontend Stack (Next)
- **Framework:** Next.js 16
- **Styling:** Tailwind CSS
- **Wallet:** RainbowKit + Wagmi
- **API:** Calls your Railway backend

---

## 💰 Cost Breakdown

### Backend (Railway)
| Component | Free Tier | Paid |
|-----------|-----------|------|
| Node Server | $5/mo trial | $5-20/mo |
| PostgreSQL | 5GB free | $10/mo+ |
| Redis | 256MB free | $5/mo+ |
| **Total** | ~$5 trial | ~$20-30/mo |

### Frontend (Vercel)
- Free tier available for Next.js
- Paid tiers: $20/mo+

---

## ✅ Deployment Checklist

**Before you deploy:**
- [ ] Read [QUICK_START_RAILWAY.md](./QUICK_START_RAILWAY.md)
- [ ] Create Railway account
- [ ] Install Railway CLI
- [ ] Gather credentials (RPC_URL, private key, etc)
- [ ] All code committed to git
- [ ] `pnpm-lock.yaml` is committed

**Deployment options:**
- [ ] Option A: Run `scripts/deploy-railway.sh` (automated)
- [ ] Option B: Manual CLI steps (from guide)
- [ ] Option C: GitHub auto-deploy (dashboard setup)

**After deployment:**
- [ ] Test health endpoint
- [ ] Verify database connected
- [ ] Check WebSocket works
- [ ] Deploy frontend to Vercel

---

## 📞 Quick Commands Reference

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Navigate to backend
cd packages/backend

# Initialize project
railway init

# Add services
railway add           # PostgreSQL
railway add           # Redis

# Set variables
railway variables set RPC_URL=https://rpc-amoy.polygon.technology/
railway variables set ADMIN_PRIVATE_KEY=0x...
railway variables set SAFE_PROXY_FACTORY_ADDRESS=0x...
railway variables set CORS_ORIGIN=https://your-frontend.vercel.app

# Deploy
railway up

# View logs
railway logs -f

# View variables
railway variables list

# Open dashboard
railway open
```

---

## 🔐 Security Reminders

⚠️ **NEVER** commit to git:
- Private keys
- `.env` files with secrets
- Database passwords

✅ **DO:**
- Use Railway's secret management
- Keep keys environment-only
- Use dedicated admin wallet
- Rotate credentials periodically

---

## 📚 Next Steps After Backend Deployment

1. **Get your Railway URL**
   - Check Railway dashboard
   - Format: `https://your-backend-xyz.railway.app`

2. **Update Frontend**
   ```bash
   cd packages/frontend
   # Edit .env.local
   NEXT_PUBLIC_API_URL=https://your-backend-xyz.railway.app
   ```

3. **Deploy Frontend to Vercel**
   ```bash
   npm install -g vercel
   cd packages/frontend
   vercel deploy
   ```

4. **Test Integration**
   - Frontend → Backend API calls
   - WebSocket connections
   - Database queries

5. **Monitor & Maintain**
   - Check Railway logs
   - Monitor resource usage
   - Set up alerts

---

## 🆘 Getting Help

| Issue | Resource |
|-------|----------|
| **Deployment steps** | [RAILWAY_DEPLOYMENT_GUIDE.md](./RAILWAY_DEPLOYMENT_GUIDE.md) |
| **Environment variables** | [RAILWAY_ENVIRONMENT_VARIABLES.md](./RAILWAY_ENVIRONMENT_VARIABLES.md) |
| **Troubleshooting** | [RAILWAY_DEPLOYMENT_GUIDE.md](./RAILWAY_DEPLOYMENT_GUIDE.md) - Troubleshooting section |
| **Pre-deployment checks** | [RAILWAY_DEPLOYMENT_CHECKLIST.md](./RAILWAY_DEPLOYMENT_CHECKLIST.md) |
| **Visual architecture** | [RAILWAY_VISUAL_GUIDE.md](./RAILWAY_VISUAL_GUIDE.md) |
| **Railway official docs** | https://docs.railway.app |
| **Railway dashboard** | https://railway.app |

---

## 📝 File Structure

```
Prediction-Market/
├── packages/
│   ├── backend/
│   │   ├── railway.json                ✨ Railway config
│   │   ├── Dockerfile                  ✨ Docker setup
│   │   ├── .env.production             ✨ Environment template
│   │   ├── .dockerignore               ✨ Docker ignore
│   │   ├── src/
│   │   │   └── server.ts               ← Express app
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── frontend/
│   │   ├── src/
│   │   └── package.json
│   └── ...
├── scripts/
│   └── deploy-railway.sh               ✨ Deployment script
├── QUICK_START_RAILWAY.md              ✨ START HERE
├── RAILWAY_BACKEND_DEPLOYMENT_INDEX.md ✨
├── RAILWAY_DEPLOYMENT_GUIDE.md         ✨
├── RAILWAY_DEPLOYMENT_CHECKLIST.md     ✨
├── RAILWAY_ENVIRONMENT_VARIABLES.md    ✨
├── RAILWAY_VISUAL_GUIDE.md             ✨
├── RAILWAY_BACKEND_SETUP_COMPLETE.md   ✨
└── README.md (this file)
```

---

## 🎓 Learning Path

**Complete deployment in 60-90 minutes:**

1. **Read** [QUICK_START_RAILWAY.md](./QUICK_START_RAILWAY.md) (5 min)
2. **Read** [RAILWAY_ENVIRONMENT_VARIABLES.md](./RAILWAY_ENVIRONMENT_VARIABLES.md) (10 min)
3. **Deploy** using automated script or manual steps (30-45 min)
4. **Verify** using [RAILWAY_DEPLOYMENT_CHECKLIST.md](./RAILWAY_DEPLOYMENT_CHECKLIST.md) (10 min)
5. **Monitor** and test endpoints (15 min)

---

## ✨ Features Included

Your backend deployment includes:
- ✅ Express.js server
- ✅ PostgreSQL database
- ✅ Redis cache
- ✅ WebSocket support
- ✅ HTTPS/SSL (auto)
- ✅ Environment management
- ✅ Logging
- ✅ Health checks
- ✅ Docker containerization
- ✅ Scalability ready

---

## 🚀 You're Ready!

Everything is configured. Your backend can be live in minutes!

**Next action:** Read [QUICK_START_RAILWAY.md](./QUICK_START_RAILWAY.md) and start deploying.

---

## 📞 Support

- **Documentation:** All files in project root (see list above)
- **Railway Docs:** https://docs.railway.app
- **Railway Dashboard:** https://railway.app
- **Questions?** Check the relevant documentation file above

---

**Status:** 🟢 Backend Ready to Deploy  
**Date:** January 20, 2025  
**Framework:** Express.js + TypeScript  
**Hosting:** Railway (Backend) + Vercel (Frontend)  

Happy deploying! 🚀
