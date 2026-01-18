#!/usr/bin/env bash
set -e

echo "Starting Polymarket Clone development environment..."

# Ensure RPC_URL is exported if present in .env
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Start Graph Node
cd packages/subgraph

echo "Starting Graph Node stack (docker-compose)..."
docker-compose up -d

# Start Backend
cd ../backend

echo "Starting Backend (pnpm dev)..."
pnpm dev &

# Start Frontend
cd ../frontend

echo "Starting Frontend (pnpm dev)..."
pnpm dev &

cd ../../

echo "All services started!"
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:3001"
echo "Subgraph: http://localhost:8000"
