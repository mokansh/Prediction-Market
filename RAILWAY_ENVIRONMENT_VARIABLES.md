# Environment Variables Guide for Railway Backend

## Overview

This document explains all environment variables needed for your backend on Railway.

## Required Variables

### 1. **RPC_URL** (Blockchain)
- **Purpose:** Connect to Polygon Amoy testnet
- **Value:** `https://rpc-amoy.polygon.technology/`
- **Type:** Public
- **Railway:** Set manually

```bash
railway variables set RPC_URL=https://rpc-amoy.polygon.technology/
```

### 2. **ADMIN_PRIVATE_KEY** (Blockchain)
- **Purpose:** Sign transactions as admin
- **Value:** Your wallet's private key (0x...)
- **Type:** Secret (NEVER commit to git!)
- **Railway:** Set as secret variable

```bash
railway variables set ADMIN_PRIVATE_KEY=0x1234567890abcdef...
```

**⚠️ Security Warning:**
- This is sensitive! Keep it secret!
- Railway encrypts this value
- Never paste in logs or share with anyone
- Use a dedicated admin wallet, not your personal wallet

### 3. **SAFE_PROXY_FACTORY_ADDRESS** (Contracts)
- **Purpose:** Address of Safe proxy factory contract
- **Value:** Your deployed contract address (0x...)
- **Type:** Public
- **Railway:** Set manually

```bash
railway variables set SAFE_PROXY_FACTORY_ADDRESS=0xabcdef1234567890...
```

### 4. **NODE_ENV** (Server)
- **Purpose:** Environment mode
- **Value:** `production`
- **Type:** Public
- **Railway:** Set to production

```bash
railway variables set NODE_ENV=production
```

### 5. **PORT** (Server)
- **Purpose:** Server port
- **Value:** `3001` (or let Railway assign)
- **Type:** Public
- **Railway:** Usually not needed (Railway assigns)

```bash
# Optional - Railway assigns if not set
railway variables set PORT=3001
```

### 6. **CORS_ORIGIN** (Frontend Integration)
- **Purpose:** Allow requests from frontend
- **Value:** Your frontend URL (https://your-domain.com)
- **Type:** Public
- **Railway:** Set to frontend domain

```bash
railway variables set CORS_ORIGIN=https://your-frontend.vercel.app
```

**Important:** 
- Must be exact domain (no trailing slash)
- Examples:
  - ✅ `https://app.vercel.app`
  - ❌ `https://app.vercel.app/`
  - ❌ `*` (not recommended in production)

## Auto-Provided Variables

These are automatically set by Railway when you add services:

### **DATABASE_URL** (PostgreSQL)
- Format: `postgresql://user:password@host:port/database`
- Created when: PostgreSQL service added
- Used by: Server to connect to database
- Example: `postgresql://postgres:password@db.railway.internal:5432/polymarket`

### **REDIS_URL** (Redis Cache)
- Format: `redis://[:password]@host:port`
- Created when: Redis service added
- Used by: Server for caching/sessions
- Example: `redis://redis.railway.internal:6379`

**Note:** These are automatically available. Don't set them manually!

## How to Set Variables on Railway

### Method 1: Railway CLI

```bash
# Single variable
railway variables set KEY=value

# Multiple variables
railway variables set KEY1=value1 KEY2=value2

# View all variables
railway variables list

# View specific variable
railway variables get RPC_URL

# Delete variable
railway variables delete KEY
```

### Method 2: Railway Dashboard

1. Go to https://railway.app
2. Select your project
3. Go to backend service
4. Click "Variables" tab
5. Click "Add Variable"
6. Enter key and value
7. Click save

### Method 3: .env.production File

Create `packages/backend/.env.production`:

```env
NODE_ENV=production
PORT=3001
RPC_URL=https://rpc-amoy.polygon.technology/
SAFE_PROXY_FACTORY_ADDRESS=0x...
ADMIN_PRIVATE_KEY=0x...
CORS_ORIGIN=https://your-frontend.vercel.app
```

Then Railway will read this file.

**⚠️ Warning:** Don't commit `.env.production` with real secrets!

## Deployment Checklist

- [ ] `RPC_URL` set correctly
- [ ] `ADMIN_PRIVATE_KEY` set as secret
- [ ] `SAFE_PROXY_FACTORY_ADDRESS` set
- [ ] `NODE_ENV` set to `production`
- [ ] `CORS_ORIGIN` set to frontend URL
- [ ] `DATABASE_URL` auto-provided (verify with `railway variables list`)
- [ ] `REDIS_URL` auto-provided (verify with `railway variables list`)

## Verification

### Check Variables Are Set

```bash
# From backend directory
railway variables list

# Output should show:
# KEY                          VALUE
# NODE_ENV                    production
# PORT                        3001
# RPC_URL                     https://rpc-amoy...
# ADMIN_PRIVATE_KEY           ••••••••••••••••
# SAFE_PROXY_FACTORY_ADDRESS  0xabcdef...
# DATABASE_URL                postgresql://...
# REDIS_URL                   redis://...
# CORS_ORIGIN                 https://your-frontend...
```

### Test Connection

After deployment, check server logs:

```bash
railway logs -f

# Should show:
# [Server] Environment variables loaded
# [Server] Connecting to database...
# [Server] Connected to PostgreSQL
# [Server] Connected to Redis
# Server running on port 3001
```

### Test API

```bash
# Health check (requires CORS_ORIGIN or no CORS restrictions)
curl https://your-railway-url/health

# Expected response:
# {"status":"ok","timestamp":"2025-01-20T12:34:56.789Z"}
```

## Secrets Management Best Practices

### Do ✅
- Use Railway's secrets feature for sensitive data
- Rotate `ADMIN_PRIVATE_KEY` occasionally
- Use a dedicated admin wallet
- Monitor who has access to variables
- Keep `.env.production` out of git

### Don't ❌
- Commit private keys to git
- Share keys in Discord/Slack
- Use same key for multiple environments
- Set private keys as public variables
- Leave `.env` files in repository

## Troubleshooting

### Variables Not Showing in App

**Problem:** App can't read environment variables

```bash
# Solution 1: Redeploy
railway up

# Solution 2: Check if set
railway variables list

# Solution 3: Check logs
railway logs | grep "environment"
```

### Wrong Value Causing Errors

**Problem:** App errors about invalid contract address

```bash
# Solution: Update variable
railway variables set SAFE_PROXY_FACTORY_ADDRESS=0xnewtestaddress

# Redeploy
railway up
```

### CORS Errors

**Problem:** Frontend can't reach backend

```bash
# Solution: Check CORS_ORIGIN
railway variables list | grep CORS_ORIGIN

# Update if wrong
railway variables set CORS_ORIGIN=https://correct-frontend.vercel.app

# Redeploy
railway up
```

## Variable Reference Table

| Name | Value | Type | Required | Auto-Set |
|------|-------|------|----------|----------|
| `RPC_URL` | `https://rpc-amoy.polygon.technology/` | Public | ✅ | ❌ |
| `ADMIN_PRIVATE_KEY` | `0x...` | Secret | ✅ | ❌ |
| `SAFE_PROXY_FACTORY_ADDRESS` | `0x...` | Public | ✅ | ❌ |
| `NODE_ENV` | `production` | Public | ✅ | ❌ |
| `PORT` | `3001` | Public | ⭕ | ❌ |
| `CORS_ORIGIN` | `https://...` | Public | ⭕ | ❌ |
| `DATABASE_URL` | `postgresql://...` | Secret | ✅ | ✅ |
| `REDIS_URL` | `redis://...` | Secret | ✅ | ✅ |

## Quick Setup Script

```bash
#!/bin/bash

# Set all required variables at once
railway variables set \
  NODE_ENV=production \
  PORT=3001 \
  RPC_URL=https://rpc-amoy.polygon.technology/ \
  SAFE_PROXY_FACTORY_ADDRESS=0x... \
  ADMIN_PRIVATE_KEY=0x... \
  CORS_ORIGIN=https://your-frontend.vercel.app

# Verify
railway variables list

# Deploy
railway up
```

## Support

For variable-related issues:
- Railway Docs: https://docs.railway.app/guides/variables
- Check Railway dashboard for detailed values
- Review server logs for errors: `railway logs`

---

**Last Updated:** January 20, 2025
