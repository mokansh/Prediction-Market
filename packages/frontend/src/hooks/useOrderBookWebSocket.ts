'use client';

import { useEffect, useRef, useState } from 'react';

interface WebSocketMessage {
  type: string;
  marketId?: string;
  outcome?: string;
  data?: any;
}

export function useOrderBookWebSocket(marketId: string, outcome: string) {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<any>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 3;

  const connectWebSocket = () => {
    try {
      // Don't try to connect if we've exceeded max attempts
      if (reconnectAttempts.current >= maxReconnectAttempts) {
        console.log('[WebSocket] Max reconnect attempts reached');
        return;
      }

      const wsUrl = `ws://localhost:3001`;
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log('[WebSocket] Connected');
        setIsConnected(true);
        reconnectAttempts.current = 0; // Reset on successful connection

        // Subscribe to market updates only if connection is open
        if (ws.current?.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({
            type: 'subscribe',
            marketId,
            outcome
          }));
        }
      };

      ws.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          if (message.type === 'orderbook_update') {
            setLastUpdate(message.data);
          }
        } catch (error) {
          console.error('[WebSocket] Message parse error:', error);
        }
      };

      ws.current.onerror = (error) => {
        console.warn('[WebSocket] Connection error (attempt ' + (reconnectAttempts.current + 1) + ')');
        setIsConnected(false);
      };

      ws.current.onclose = () => {
        console.log('[WebSocket] Disconnected');
        setIsConnected(false);

        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
          reconnectAttempts.current++;
          console.log(`[WebSocket] Reconnecting in ${delay}ms...`);
          setTimeout(connectWebSocket, delay);
        }
      };
    } catch (error) {
      console.error('[WebSocket] Failed to create connection:', error);
      setIsConnected(false);
    }
  };

  useEffect(() => {
    connectWebSocket();

    // Cleanup on unmount
    return () => {
      if (ws.current) {
        // Only send unsubscribe if connection is open
        if (ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({
            type: 'unsubscribe',
            marketId,
            outcome
          }));
        }
        ws.current.close();
      }
    };
  }, [marketId, outcome]);

  return { isConnected, lastUpdate };
}
