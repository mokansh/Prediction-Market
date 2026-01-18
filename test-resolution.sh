#!/bin/bash

# Start backend
cd /home/user/Documents/polymarket/packages/backend
npm run dev > /tmp/backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to start
sleep 8

# Test resolution status endpoint
echo "Testing resolution status endpoint..."
RESPONSE=$(curl -s http://localhost:3001/api/markets/0x4dd125cbdacb3ef9288bdd76b3e4d57870f6bdaccb0ef51bc73298cc3f51df51/resolution-status)

echo "Response: $RESPONSE"

# Check if market is resolved
if echo "$RESPONSE" | grep -q '"resolved":true'; then
    echo "✅ Market is marked as resolved"
    if echo "$RESPONSE" | grep -q '"outcome":"YES"'; then
        echo "✅ Outcome is YES"
    else
        echo "❌ Outcome not set correctly"
    fi
else
    echo "❌ Market is not marked as resolved"
fi

# Cleanup
kill -9 $BACKEND_PID 2>/dev/null
wait $BACKEND_PID 2>/dev/null
