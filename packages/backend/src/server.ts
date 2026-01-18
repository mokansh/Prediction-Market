import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import path from 'path';
import walletRoutes from './routes/wallet';
import adminRoutes from './routes/admin';
import marketsRoutes from './routes/markets';
import marketConditionsRoutes from './routes/marketConditions';
import ordersRoutes from './routes/orders';
import { SettlementWorker } from './services/settlementWorker';
import { SettlementExecutor } from './services/settlementExecutor';
import { settlementQueue } from './services/settlementQueue';
import { getEventListenerService } from './services/eventListenerService';
import { swaggerSpec } from './swagger';

// Load environment variables from .env file
const envPath = path.resolve(process.cwd(), '.env');
console.log('[Server] Loading env from:', envPath);
const result = dotenv.config({ path: envPath });
if (result.error) {
  console.warn('[Server] Warning: Could not load .env file:', result.error.message);
} else {
  console.log('[Server] Environment variables loaded');
}

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Swagger UI
app.get('/api-docs', (_req, res) => {
  res.json(swaggerSpec);
});

app.get('/swagger', (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Polymarket CLOB API</title>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
        <style>
          body{
            margin:0;
            padding:0;
          }
        </style>
      </head>
      <body>
        <redoc spec-url='http://localhost:3001/api-docs'></redoc>
        <script src="https://cdn.jsdelivr.net/npm/redoc@latest/bundles/redoc.standalone.js"></script>
      </body>
    </html>
  `);
});

// Wallet routes
app.use('/api/wallet', walletRoutes);

// Admin routes
app.use('/api/admin', adminRoutes);

// Markets routes
app.use('/api/markets', marketsRoutes);

// Market Conditions routes (conditionId, tokenIds)
app.use('/api/market-conditions', marketConditionsRoutes);

// Orders routes (CLOB)
app.use('/api/orders', ordersRoutes);

// Settlement diagnostics and manual processing
app.get('/api/settlement/status', (_req, res) => {
  res.json({
    queueSize: settlementQueue.size(),
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/settlement/process', async (_req, res) => {
  try {
    const executor = new SettlementExecutor();
    let processed = 0;

    while (settlementQueue.size() > 0) {
      const job = settlementQueue.dequeue();
      if (!job) break;

      try {
        const txHash = await executor.settle(job);
        console.log('[Settlement] Manually processed job tx:', txHash);
        processed += 1;
      } catch (err: any) {
        console.error('[Settlement] Manual processing failed:', err?.message || err);
      }
    }

    res.json({
      success: true,
      processed,
      remaining: settlementQueue.size(),
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err?.message || 'Manual settlement failed',
    });
  }
});

// Start settlement worker (background)
try {
  const worker = new SettlementWorker();
  worker.start();
  console.log('[SettlementWorker] Started');
} catch (err) {
  console.error('[SettlementWorker] Failed to start:', err);
}

// Start event listener for CTF ConditionPreparation events
try {
  const eventListener = getEventListenerService();
  eventListener.startListening();
  console.log('[EventListener] Started');
} catch (err) {
  console.error('[EventListener] Failed to start:', err);
}

// WebSocket handler for real-time orderbook updates
interface WebSocketMessage {
  type: string;
  marketId?: string;
  outcome?: string;
  action?: string;
  data?: any;
}

const subscribedClients = new Map<string, Set<WebSocket>>();

wss.on('connection', (ws) => {
  console.log('[WebSocket] Client connected');

  ws.on('message', (message) => {
    try {
      const msg: WebSocketMessage = JSON.parse(message.toString());
      
      switch (msg.type) {
        case 'subscribe':
          handleSubscribe(ws, msg);
          break;
        case 'unsubscribe':
          handleUnsubscribe(ws, msg);
          break;
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
        default:
          console.log('[WebSocket] Unknown message type:', msg.type);
      }
    } catch (err) {
      console.error('[WebSocket] Error processing message:', err);
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Invalid message format' 
      }));
    }
  });

  ws.on('close', () => {
    console.log('[WebSocket] Client disconnected');
    // Clean up subscriptions
    subscribedClients.forEach((clients) => {
      clients.delete(ws);
    });
  });

  ws.send(JSON.stringify({ 
    type: 'connected',
    message: 'Connected to CLOB WebSocket',
    timestamp: new Date().toISOString()
  }));
});

function handleSubscribe(ws: WebSocket, msg: WebSocketMessage) {
  const { marketId, outcome } = msg;
  
  if (!marketId) {
    ws.send(JSON.stringify({ 
      type: 'error',
      message: 'Market ID is required'
    }));
    return;
  }

  const channel = outcome ? `${marketId}:${outcome}` : marketId;
  
  if (!subscribedClients.has(channel)) {
    subscribedClients.set(channel, new Set());
  }
  
  subscribedClients.get(channel)!.add(ws);
  
  ws.send(JSON.stringify({
    type: 'subscribed',
    channel,
    timestamp: new Date().toISOString()
  }));
  
  console.log(`[WebSocket] Client subscribed to ${channel}`);
}

function handleUnsubscribe(ws: WebSocket, msg: WebSocketMessage) {
  const { marketId, outcome } = msg;
  const channel = outcome ? `${marketId}:${outcome}` : marketId;
  
  if (subscribedClients.has(channel)) {
    subscribedClients.get(channel)!.delete(ws);
  }
  
  ws.send(JSON.stringify({
    type: 'unsubscribed',
    channel,
    timestamp: new Date().toISOString()
  }));
  
  console.log(`[WebSocket] Client unsubscribed from ${channel}`);
}

// Broadcast function for orderbook updates
export function broadcastOrderbookUpdate(
  marketId: string,
  outcome?: string
) {
  const channel = outcome ? `${marketId}:${outcome}` : marketId;
  const clients = subscribedClients.get(channel);
  
  if (clients && clients.size > 0) {
    const { getOrderBookService } = require('./services/orderBookService');
    const orderBookService = getOrderBookService();
    
    const update = outcome 
      ? orderBookService.getOrderBook(marketId, outcome)
      : {
          yes: orderBookService.getOrderBook(marketId, 'YES'),
          no: orderBookService.getOrderBook(marketId, 'NO')
        };
    
    const message = JSON.stringify({
      type: 'orderbook_update',
      channel,
      update,
      timestamp: new Date().toISOString()
    });
    
    clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    });
  }
}

const PORT = Number(process.env.PORT) || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
