#!/bin/bash

# Railway Backend Deployment Quick Start
# This script automates the Railway deployment setup

set -e

echo "🚀 Railway Backend Deployment Setup"
echo "===================================="
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
fi

echo "✅ Railway CLI found"
echo ""

# Navigate to backend directory
cd "packages/backend"
echo "📁 Working in: $(pwd)"
echo ""

# Check git status
if [ ! -d .git ]; then
    echo "⚠️  Warning: Git repository not found in workspace"
    echo "   Railway deployment requires git"
    exit 1
fi

echo "🔐 Logging into Railway..."
railway login

echo ""
echo "📦 Creating/Initializing Railway Project..."
railway init

echo ""
echo "🗄️  Adding PostgreSQL Database..."
echo "   Follow the prompts to add PostgreSQL"
railway add

echo ""
echo "📍 Adding Redis Cache..."
echo "   Follow the prompts to add Redis"
railway add

echo ""
echo "🔧 Setting Environment Variables..."
echo "   Enter your values when prompted:"
echo ""

# Prompt for environment variables
read -p "Enter RPC_URL (e.g., https://rpc-amoy.polygon.technology/): " RPC_URL
railway variables set RPC_URL="$RPC_URL"

read -p "Enter SAFE_PROXY_FACTORY_ADDRESS (0x...): " SAFE_PROXY_FACTORY_ADDRESS
railway variables set SAFE_PROXY_FACTORY_ADDRESS="$SAFE_PROXY_FACTORY_ADDRESS"

read -sp "Enter ADMIN_PRIVATE_KEY (0x..., will be hidden): " ADMIN_PRIVATE_KEY
echo ""
railway variables set ADMIN_PRIVATE_KEY="$ADMIN_PRIVATE_KEY"
read -p "Enter COLLATERAL_TOKEN (e.g., USDC): " COLLATERAL_TOKEN
railway variables set COLLATERAL_TOKEN="$COLLATERAL_TOKEN"
read -p "Enter COLLATERAL_TOKEN_ADDRESS (0x...): " COLLATERAL_TOKEN_ADDRESS
railway variables set COLLATERAL_TOKEN_ADDRESS="$COLLATERAL_TOKEN_ADDRESS"
read -p "Enter CTF_EXCHANGE_ADDRESS (0x...): " CTF_EXCHANGE_ADDRESS
railway variables set CTF_EXCHANGE_ADDRESS="$CTF_EXCHANGE_ADDRESS"
read -p "Enter UMA_CTF_ADAPTER_ADDRESS (0x...): " UMA_CTF_ADAPTER_ADDRESS
railway variables set UMA_CTF_ADAPTER_ADDRESS="$UMA_CTF_ADAPTER_ADDRESS"
read -p "Enter CONDITIONAL_TOKENS_ADDRESS (0x...): " CONDITIONAL_TOKENS_ADDRESS
railway variables set CONDITIONAL_TOKENS_ADDRESS="$CONDITIONAL_TOKENS_ADDRESS"
read -p "Enter REWARD_TOKEN_ADDRESS (0x...): " REWARD_TOKEN_ADDRESS
railway variables set REWARD_TOKEN_ADDRESS="$REWARD_TOKEN_ADDRESS"
read -p "Enter REWARD_AMOUNT (e.g., 1000): " REWARD_AMOUNT
railway variables set REWARD_AMOUNT="$REWARD_AMOUNT"
read -p "Enter PROPOSAL_BOND (e.g., 100): " PROPOSAL_BOND
railway variables set PROPOSAL_BOND="$PROPOSAL_BOND"
read -p "Enter LIVENESS (in seconds, e.g., 3600): " LIVENESS
railway variables set LIVENESS="$LIVENESS"
read -p "Enter FEE_MODULE_ADDRESS (0x...): " FEE_MODULE_ADDRESS
railway variables set FEE_MODULE_ADDRESS="$FEE_MODULE_ADDRESS"
read -p "Enter NEG_RISK_FEE_MODULE (0x...): " NEG_RISK_FEE_MODULE
railway variables set NEG_RISK_FEE_MODULE="$NEG_RISK_FEE_MODULE"
read -p "Enter CTF_CONTRACT_ADDRESS (0x...): " CTF_CONTRACT_ADDRESS
railway variables set CTF_CONTRACT_ADDRESS="$CTF_CONTRACT_ADDRESS"

# read -p "Enter DATABASE_URL (from Railway PostgreSQL add-on): " DATABASE_URL
# railway variables set DATABASE_URL="$DATABASE_URL"
# read -p "Enter REDIS_URL (from Railway Redis add-on): " REDIS_URL
# railway variables set REDIS_URL="$REDIS_URL"

read -p "Enter CORS_ORIGIN (e.g., https://your-frontend.vercel.app): " CORS_ORIGIN
railway variables set CORS_ORIGIN="$CORS_ORIGIN"

railway variables set NODE_ENV=production
railway variables set PORT=3001

echo ""
echo "📋 Environment Variables Set:"
railway variables list

echo ""
echo "🎯 Ready to Deploy!"
echo "===================================="
echo ""
echo "Option 1: Deploy now"
echo "  $ railway up"
echo ""
echo "Option 2: Deploy via GitHub (Auto-deploy on push)"
echo "  - Enable in Railway Dashboard"
echo "  - Select watch path: packages/backend"
echo ""
echo "Option 3: View Dashboard"
echo "  $ railway open"
echo ""
echo "✅ Setup complete!"
