# Polymarket Clone Monorepo

This repository scaffolds a monorepo for contracts, subgraph, backend, and frontend as outlined in the setup guide.

## Structure

- packages/contracts
- packages/subgraph
- packages/backend
- packages/frontend
- packages/client
- scripts/start-dev.sh

## Prerequisites

- Node.js >= 18, pnpm >= 8
- Docker & Docker Compose
- Foundry (for contracts)
- Git, PostgreSQL >= 14, Redis >= 6

## Workspace Setup

1. Install pnpm globally:

```bash
npm install -g pnpm
```

2. Copy env template:

```bash
cp .env.example .env
```

3. Clone repos:

```bash
mkdir -p packages/{contracts,subgraph,client,frontend,backend,shared}
cd packages/contracts
# CTF Exchange & UMA adapter
git clone https://github.com/mokansh/ctf-exchange.git
git clone https://github.com/mokansh/uma-ctf-adapter.git

cd ../subgraph
git clone https://github.com/mokansh/polymarket-subgraph.git

cd ../client
git clone https://github.com/mokansh/clob-client.git
git clone https://github.com/mokansh/clob-order-utils.git
```

## Backend (packages/backend)

Install dependencies and run dev:

```bash
cd packages/backend
pnpm install
pnpm dev
```

Health check:

```bash
curl http://localhost:3001/health
```

### Admin Features

The backend includes admin endpoints for market creation:

- **POST `/api/admin/create-market`**: Create new prediction markets
- **GET `/api/admin/info`**: Get admin configuration

See [`packages/backend/ADMIN_API.md`](packages/backend/ADMIN_API.md) for complete documentation.

Example:
```bash
npx ts-node examples/createMarket.ts
```

## Subgraph (packages/subgraph)

Start local graph node:

```bash
cd packages/subgraph
# Ensure RPC_URL is set in .env
docker-compose up -d
```

Then configure and deploy the subgraph following the guide.

## Frontend (packages/frontend)

Initialize Next.js app (TypeScript):

```bash
cd packages/frontend
npx create-next-app@latest . --typescript --tailwind --app --src-dir
pnpm add ethers viem wagmi @rainbow-me/rainbowkit
pnpm add @apollo/client graphql
pnpm add @polymarket/clob-client
pnpm add swr axios
pnpm dev
```

## Dev Script

Use the helper script to start subgraph, backend, and frontend:

```bash
chmod +x scripts/start-dev.sh
./scripts/start-dev.sh
```

## Notes

- Update `.env` with deployed contract addresses after Foundry deployment.
- `pnpm-workspace.yaml` is configured to include all packages/*.
