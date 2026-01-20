# Railway Deployment Visual Guide

## 🎯 Your Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     YOUR COMPUTER                       │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Git Repository (Prediction-Market)              │  │
│  │  ├── packages/backend/                           │  │
│  │  │   ├── src/server.ts                           │  │
│  │  │   ├── package.json                            │  │
│  │  │   ├── tsconfig.json                           │  │
│  │  │   ├── railway.json        ✨ NEW             │  │
│  │  │   ├── Dockerfile          ✨ NEW             │  │
│  │  │   └── .env.production     ✨ NEW             │  │
│  │  └── ... (other packages)                        │  │
│  └──────────────────────────────────────────────────┘  │
│                         │                               │
│                    git push                             │
│                         ↓                               │
└─────────────────────────────────────────────────────────┘
                          │
                          ↓
            ┌──────────────────────────┐
            │    GitHub Repository     │
            └──────────────────────────┘
                          │
                          ↓
            ┌──────────────────────────┐
            │   Railway Dashboard      │
            │   - Projects             │
            │   - Deployments          │
            │   - Monitoring           │
            └──────────────────────────┘
                          │
                          ↓
         ┌────────────────────────────────────┐
         │    Railway Container Environment   │
         │  ┌─────────────────────────────┐  │
         │  │   Node.js (v20 Alpine)      │  │
         │  │  ┌────────────────────────┐ │  │
         │  │  │  Express.js Server     │ │  │
         │  │  │  ├── REST API          │ │  │
         │  │  │  ├── WebSocket (WS)    │ │  │
         │  │  │  └── Health check      │ │  │
         │  │  └────────────────────────┘ │  │
         │  └─────────────────────────────┘  │
         │              │                     │
         │    ┌─────────┼─────────┐           │
         │    ↓         ↓         ↓           │
         │  ┌──────┐ ┌──────┐ ┌──────┐       │
         │  │ PG   │ │Redis │ │ etc  │       │
         │  │ DB   │ │Cache │ │      │       │
         │  └──────┘ └──────┘ └──────┘       │
         └────────────────────────────────────┘
                          │
                          ↓
            ┌──────────────────────────┐
            │   Public HTTPS URL       │
            │  (assigned by Railway)   │
            │  https://your-api.      │
            │  railway.app            │
            └──────────────────────────┘
                          │
                          ↓
            ┌──────────────────────────┐
            │   Frontend (Vercel)      │
            │   Makes API calls        │
            └──────────────────────────┘
```

---

## 📊 Deployment Process

```
START
  │
  ├─ [Step 1] Install Railway CLI
  │  Command: npm install -g @railway/cli
  │  Status: 🟢 Done
  │
  ├─ [Step 2] Login to Railway
  │  Command: railway login
  │  Opens: Browser for authentication
  │  Status: ⭕ Pending
  │
  ├─ [Step 3] Navigate to backend
  │  Command: cd packages/backend
  │  Status: ⭕ Pending
  │
  ├─ [Step 4] Initialize project
  │  Command: railway init
  │  Creates: New Railway project
  │  Status: ⭕ Pending
  │
  ├─ [Step 5] Add PostgreSQL
  │  Command: railway add
  │  Service: PostgreSQL database
  │  Status: ⭕ Pending
  │
  ├─ [Step 6] Add Redis
  │  Command: railway add
  │  Service: Redis cache
  │  Status: ⭕ Pending
  │
  ├─ [Step 7] Set variables
  │  Command: railway variables set KEY=value
  │  Variables: 6 required + 2 auto
  │  Status: ⭕ Pending
  │
  ├─ [Step 8] Deploy
  │  Command: railway up
  │  Action: Build, push, start
  │  Duration: 3-5 minutes
  │  Status: ⭕ Pending
  │
  ├─ [Step 9] Verify
  │  Command: curl https://your-url/health
  │  Expected: {"status":"ok"}
  │  Status: ⭕ Pending
  │
  └─ [Step 10] Success
     Status: 🟢 Live and running!
     URL: https://your-backend-random.railway.app
```

---

## 🔧 Configuration Overview

```
┌─────────────────────────────────────────┐
│     Railway Configuration                │
├─────────────────────────────────────────┤
│                                         │
│  Build Configuration (railroad.json):   │
│  ├─ builder: nixpacks                   │
│  ├─ nodejs: auto-detected               │
│  └─ build: tsc (TypeScript compiler)    │
│                                         │
│  Container Setup (Dockerfile):          │
│  ├─ FROM: node:20-alpine                │
│  ├─ WORKDIR: /app                       │
│  ├─ COPY: package files                 │
│  ├─ RUN: pnpm install                   │
│  ├─ COPY: source code                   │
│  ├─ RUN: npm run build                  │
│  ├─ EXPOSE: 3001                        │
│  └─ CMD: node dist/server.js            │
│                                         │
│  Environment (docker-ignore):           │
│  ├─ Exclude: node_modules               │
│  ├─ Exclude: dist/                      │
│  ├─ Exclude: .env                       │
│  └─ Exclude: .git/                      │
│                                         │
└─────────────────────────────────────────┘
```

---

## 📋 Environment Variables Map

```
┌──────────────────────────────────────────────────┐
│           Environment Variables                  │
├──────────────────────────────────────────────────┤
│                                                  │
│  🔒 ADMIN_PRIVATE_KEY                            │
│     │ Type: Secret (ENCRYPTED)                   │
│     │ From: Your wallet                          │
│     │ Use: Sign transactions                     │
│     └─ Railway keeps this secure!                │
│                                                  │
│  🌐 RPC_URL                                      │
│     │ Type: Public                               │
│     │ Value: Polygon Amoy endpoint               │
│     │ Use: Connect to blockchain                 │
│     └─ https://rpc-amoy.polygon.technology/     │
│                                                  │
│  📝 SAFE_PROXY_FACTORY_ADDRESS                  │
│     │ Type: Public                               │
│     │ From: Your deployment                      │
│     │ Use: Safe contract factory address         │
│     └─ 0x...                                     │
│                                                  │
│  🎯 CORS_ORIGIN                                  │
│     │ Type: Public                               │
│     │ Value: Frontend domain                     │
│     │ Use: Allow frontend requests               │
│     └─ https://your-frontend.vercel.app          │
│                                                  │
│  🚀 NODE_ENV                                     │
│     │ Type: Public                               │
│     │ Value: production                          │
│     │ Use: Environment mode                      │
│     └─ Optimized for production                  │
│                                                  │
│  🔌 PORT                                         │
│     │ Type: Public                               │
│     │ Value: 3001 (or auto-assigned)             │
│     │ Use: Server port                           │
│     └─ Railway assigns if not set                │
│                                                  │
│  🗄️  DATABASE_URL (auto)                        │
│     │ Type: Secret (AUTO-PROVIDED)               │
│     │ Format: postgresql://user:pass@host/db     │
│     │ Use: PostgreSQL connection                 │
│     └─ Railway sets when DB service added        │
│                                                  │
│  🎯 REDIS_URL (auto)                            │
│     │ Type: Secret (AUTO-PROVIDED)               │
│     │ Format: redis://[:pass]@host:port          │
│     │ Use: Redis connection                      │
│     └─ Railway sets when Redis service added     │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow

```
User/Frontend
    │
    ↓
┌─────────────────────┐
│   HTTPS Request     │
│   (REST or WS)      │
└─────────────────────┘
    │
    ↓
┌──────────────────────────────┐
│   Express.js Server          │
│   (on Railway)               │
│  ├─ Route handler            │
│  ├─ Authentication           │
│  └─ Business logic           │
└──────────────────────────────┘
    │
    ├──────────────┬──────────────┐
    ↓              ↓              ↓
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Check    │  │ Store    │  │ Send     │
│ Cache    │  │ in DB    │  │ Response │
│ (Redis)  │  │ (PG)     │  │          │
└──────────┘  └──────────┘  └──────────┘
    │              │              │
    └──────────────┴──────────────┘
    │
    ↓
┌─────────────────────┐
│  HTTPS Response     │
│  (JSON or WS)       │
└─────────────────────┘
    │
    ↓
User/Frontend (Updated)
```

---

## 🎯 Service Connectivity

```
            ┌─────────────────────────┐
            │   Your Express Server   │
            │   (Node.js Container)   │
            └─────────────────────────┘
                      │
         ┌────────────┼────────────┐
         ↓            ↓            ↓
    
    PostgreSQL    Redis         External
    Database      Cache         Services
    ┌────────┐  ┌────────┐  ┌─────────┐
    │ Tables │  │ Store  │  │RPC Call │
    │ Rows   │  │Session │  │Blockchain
    │Markets │  │Cache   │  │eth_call │
    │Orders  │  │Keys    │  └─────────┘
    │Wallets │  └────────┘
    └────────┘

    Environment: railway.internal
    - PG Host: db.railway.internal
    - Redis: redis.railway.internal
    - External: Internet (RPC)
```

---

## 📊 Request Lifecycle

```
[1] Frontend sends request
    │
    ↓
[2] Express middleware processes
    ├─ CORS check ✓
    ├─ JSON parse ✓
    ├─ Logging ✓
    │
    ↓
[3] Route handler executes
    ├─ Validate input ✓
    ├─ Check Redis cache
    │  ├─ Hit → Return cached
    │  └─ Miss → Continue
    │
    ↓
[4] Database query
    ├─ PostgreSQL query
    ├─ Receive results
    ├─ Cache result in Redis
    │
    ↓
[5] Process results
    ├─ Format response
    ├─ Add metadata
    │
    ↓
[6] Send response
    ├─ JSON serialization
    ├─ HTTPS transmission
    │
    ↓
[7] Frontend receives
    └─ Display to user
```

---

## 🔐 Security Layers

```
┌─────────────────────────────────────┐
│         External Traffic             │
│         (HTTPS Encrypted)            │
└─────────────────────────────────────┘
    │
    ↓ (Railway automatically encrypted)
┌─────────────────────────────────────┐
│    Railway Container Network         │
│    (Internal to Railway)             │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  Environment Variables      │   │
│  │  (Vault - Encrypted)        │   │
│  │  - ADMIN_PRIVATE_KEY (🔒)   │   │
│  │  - DATABASE_URL (🔒)        │   │
│  │  - REDIS_URL (🔒)           │   │
│  │  - NODE_ENV                 │   │
│  └─────────────────────────────┘   │
│           │                        │
│           ↓                        │
│  ┌─────────────────────────────┐   │
│  │  Server Process             │   │
│  │  (Sandboxed Container)      │   │
│  └─────────────────────────────┘   │
│           │                        │
│    ┌──────┴──────┐                │
│    ↓             ↓                │
│  ┌─────┐    ┌──────────┐          │
│  │ DB  │    │ Redis    │          │
│  │SSL  │    │Encrypted │          │
│  └─────┘    └──────────┘          │
└─────────────────────────────────────┘
    │
    ↓ (SSL connection)
External Blockchain (RPC)
```

---

## 📈 Scaling Path

```
Stage 1: Development (Current)
┌─────────────────────────────────┐
│  Express Server (1 container)   │
│  PostgreSQL 5GB free            │
│  Redis 256MB free               │
│  Cost: ~$5-10/month free trial  │
└─────────────────────────────────┘
         ↓
Stage 2: Production (Next)
┌─────────────────────────────────┐
│  Express Server (1 instance)    │
│  PostgreSQL with backups        │
│  Redis with persistence         │
│  Cost: ~$20-30/month            │
└─────────────────────────────────┘
         ↓
Stage 3: Scale (Future)
┌─────────────────────────────────┐
│  Express Load Balancer          │
│  Multiple server instances      │
│  PostgreSQL HA cluster          │
│  Redis Cluster                  │
│  CDN for static content         │
│  Cost: $100+/month              │
└─────────────────────────────────┘
```

---

## ✅ Health Status Indicators

```
HEALTHY STATE:
═════════════════════════════════════

Container Status:     ✅ Running (Green)
CPU Usage:            ✅ < 50%
Memory Usage:         ✅ < 70%
Disk Usage:           ✅ < 80%
Network:              ✅ Connected
Database:             ✅ Connected
Redis:                ✅ Connected
Health Endpoint:      ✅ 200 OK


ALERT STATE:
═════════════════════════════════════

Container Status:     ⚠️ Rebuilding
CPU Usage:            ⚠️ 50-80%
Memory Usage:         ⚠️ 70-90%
Disk Usage:           ⚠️ 80-95%
Network:              ⚠️ Slow
Database:             ⚠️ High latency
Redis:                ⚠️ Memory full
Health Endpoint:      ⚠️ Timeout


CRITICAL STATE:
═════════════════════════════════════

Container Status:     ❌ Failed/Crashed
CPU Usage:            ❌ > 90%
Memory Usage:         ❌ > 95%
Disk Usage:           ❌ > 95%
Network:              ❌ Disconnected
Database:             ❌ Connection refused
Redis:                ❌ No connection
Health Endpoint:      ❌ 500 Error
```

---

## 📞 Support Layers

```
Issue Level 1 (Check First)
├─ Read documentation
├─ Check logs: railway logs
├─ Verify environment variables
└─ Test locally: npm run dev

         ↓ (if unresolved)

Issue Level 2 (Advanced)
├─ Check Railway status page
├─ Review server logs
├─ Verify database connection
└─ Test with curl/Postman

         ↓ (if unresolved)

Issue Level 3 (Support)
├─ Railway Dashboard issues
├─ Service connectivity
├─ Performance problems
└─ Contact Railway support

Support: https://railway.app/support
```

---

**Visual Guide Complete!** 🎨

Refer back to this guide when you need to understand the deployment architecture.

**Next:** Read [QUICK_START_RAILWAY.md](./QUICK_START_RAILWAY.md)
