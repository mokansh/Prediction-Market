#!/bin/bash

# Start both backend and frontend servers

echo "Starting Polymarket Development Servers..."
echo "=========================================="

# Kill any existing servers on ports 3000 and 3001
echo "Cleaning up existing processes..."
lsof -ti:3001 2>/dev/null | xargs kill -9 2>/dev/null
lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null
sleep 2

# Start backend
echo "Starting backend server on port 3001..."
cd packages/backend
npm run dev > /tmp/backend-dev.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait for backend to start
sleep 5

# Start frontend
echo "Starting frontend server on port 3000..."
cd ../frontend
npm run dev > /tmp/frontend-dev.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

sleep 3

echo ""
echo "=========================================="
echo "✅ Servers Started!"
echo "=========================================="
echo "Backend:  http://localhost:3001"
echo "Frontend: http://localhost:3000"
echo ""
echo "Backend PID:  $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo ""
echo "Logs:"
echo "  Backend:  tail -f /tmp/backend-dev.log"
echo "  Frontend: tail -f /tmp/frontend-dev.log"
echo ""
echo "To stop servers:"
echo "  kill $BACKEND_PID $FRONTEND_PID"
echo "=========================================="
