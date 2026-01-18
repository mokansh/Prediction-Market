#!/bin/bash

echo "🚀 Setting up Polymarket Multisig Wallet Deployment Feature"
echo ""

# Check if we're in the project root
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

echo "📦 Installing backend dependencies..."
cd packages/backend
if [ ! -f ".env" ]; then
    echo "Creating backend .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit packages/backend/.env and add your configuration"
fi
npm install
cd ../..

echo ""
echo "📦 Installing frontend dependencies..."
cd packages/frontend
if [ ! -f ".env.local" ]; then
    echo "Creating frontend .env.local file from template..."
    cp .env.example .env.local
    echo "⚠️  Please edit packages/frontend/.env.local and add your configuration"
fi
npm install
cd ../..

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Edit packages/backend/.env with your configuration:"
echo "   - SAFE_PROXY_FACTORY_ADDRESS: Address of deployed SafeProxyFactory contract"
echo "   - ADMIN_PRIVATE_KEY: Private key of admin wallet (will pay gas fees)"
echo "   - RPC_URL: RPC endpoint (default: https://rpc-amoy.polygon.technology/)"
echo ""
echo "2. Edit packages/frontend/.env.local with your configuration:"
echo "   - NEXT_PUBLIC_BACKEND_URL: Backend API URL (default: http://localhost:3001)"
echo "   - NEXT_PUBLIC_SAFE_PROXY_FACTORY_ADDRESS: Same as backend"
echo ""
echo "3. Fund your admin wallet with MATIC on Polygon Amoy testnet"
echo "   Get testnet MATIC: https://faucet.polygon.technology/"
echo ""
echo "4. Start the backend: cd packages/backend && npm run dev"
echo "5. Start the frontend: cd packages/frontend && npm run dev"
echo ""
echo "📖 For detailed documentation, see WALLET_DEPLOYMENT_README.md"
