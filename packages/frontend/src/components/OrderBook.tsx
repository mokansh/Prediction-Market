'use client';

import React, { useState, useEffect } from 'react';
import { useOrderBookWebSocket } from '@/hooks/useOrderBookWebSocket';

interface OrderBookEntry {
  price: number;
  amount: number;
  total: number;
}

interface OrderBookProps {
  marketId: string;
  outcome: 'YES' | 'NO';
}

export function OrderBook({ marketId, outcome }: OrderBookProps) {
  const [buySide, setBuySide] = useState<OrderBookEntry[]>([]);
  const [sellSide, setSellSide] = useState<OrderBookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isConnected: wsConnected, lastUpdate } = useOrderBookWebSocket(marketId, outcome);

  // Fetch initial order book
  useEffect(() => {
    fetchOrderBook();
  }, [marketId, outcome]);

  // Update when WebSocket sends new data
  useEffect(() => {
    if (lastUpdate) {
      processOrderBookData(lastUpdate);
    }
  }, [lastUpdate]);

  const processOrderBookData = (data: any) => {
    // Handle both 'orderBook' and 'orderbook' fields for compatibility
    const book = data.orderBook || data.orderbook;
    
    if (book) {
      // Process buy side - only include open/partially filled orders (remainingAmount > 0)
      const buyOrders = book.buySide || [];
      const buyEntries: OrderBookEntry[] = [];
      let buyTotal = 0;
      
      buyOrders.forEach((order: any) => {
        // Skip fully matched orders
        if (order.remainingAmount <= 0) return;
        
        const normalizedAmount = order.remainingAmount / 1e6; // Divide by 10^6 for display
        buyTotal += normalizedAmount;
        buyEntries.push({
          price: order.price,
          amount: normalizedAmount,
          total: buyTotal
        });
      });

      // Process sell side - only include open/partially filled orders (remainingAmount > 0)
      const sellOrders = book.sellSide || [];
      const sellEntries: OrderBookEntry[] = [];
      let sellTotal = 0;
      
      sellOrders.forEach((order: any) => {
        // Skip fully matched orders
        if (order.remainingAmount <= 0) return;
        
        const normalizedAmount = order.remainingAmount / 1e6; // Divide by 10^6 for display
        sellTotal += normalizedAmount;
        sellEntries.push({
          price: order.price,
          amount: normalizedAmount,
          total: sellTotal
        });
      });

      setBuySide(buyEntries);
      setSellSide(sellEntries);
      setError(null);
    }
  };

  const fetchOrderBook = async () => {
    try {
      const response = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL + `/api/orders/market/${marketId}?outcome=${outcome}`);
      const data = await response.json();

      if (data.success) {
        processOrderBookData(data);
      } else {
        setError(data.error || 'Failed to load order book');
      }
    } catch (err) {
      console.error('[OrderBook] Fetch error:', err);
      // Don't show error if it's just a connectivity issue, try again
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        Loading order book...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500 dark:text-red-400">
        {error}
      </div>
    );
  }

  const maxTotal = Math.max(
    ...buySide.map(e => e.total),
    ...sellSide.map(e => e.total),
    1
  );

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          Order Book - {outcome}
        </h3>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {wsConnected ? 'Live' : 'Polling'}
          </span>
        </div>
      </div>

      <div className="divide-y divide-gray-200 dark:divide-slate-700">
        {/* Sell Side (Asks) */}
        <div className="p-4">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 grid grid-cols-3 gap-2">
            <span>Price</span>
            <span className="text-right">Amount</span>
            <span className="text-right">Total</span>
          </div>
          <div className="space-y-1">
            {sellSide.slice(0, 10).reverse().map((entry, idx) => (
              <div
                key={idx}
                className="relative grid grid-cols-3 gap-2 text-sm py-1 px-2 rounded"
              >
                <div
                  className="absolute inset-0 bg-red-100 dark:bg-red-900/20 rounded"
                  style={{ width: `${(entry.total / maxTotal) * 100}%` }}
                />
                <span className="relative z-10 text-red-600 dark:text-red-400 font-mono">
                  ${entry.price.toFixed(2)}
                </span>
                <span className="relative z-10 text-right text-gray-900 dark:text-white font-mono">
                  {entry.amount.toFixed(2)}
                </span>
                <span className="relative z-10 text-right text-gray-600 dark:text-gray-400 font-mono">
                  {entry.total.toFixed(2)}
                </span>
              </div>
            ))}
            {sellSide.length === 0 && (
              <div className="text-center text-gray-400 dark:text-gray-500 py-2">
                No sell orders
              </div>
            )}
          </div>
        </div>

        {/* Spread */}
        {buySide.length > 0 && sellSide.length > 0 && (
          <div className="px-4 py-2 bg-gray-50 dark:bg-slate-800 text-center">
            <span className="text-xs text-gray-600 dark:text-gray-400">
              Spread: ${(sellSide[0].price - buySide[0].price).toFixed(3)}
            </span>
          </div>
        )}

        {/* Buy Side (Bids) */}
        <div className="p-4">
          <div className="space-y-1">
            {buySide.slice(0, 10).map((entry, idx) => (
              <div
                key={idx}
                className="relative grid grid-cols-3 gap-2 text-sm py-1 px-2 rounded"
              >
                <div
                  className="absolute inset-0 bg-green-100 dark:bg-green-900/20 rounded"
                  style={{ width: `${(entry.total / maxTotal) * 100}%` }}
                />
                <span className="relative z-10 text-green-600 dark:text-green-400 font-mono">
                  ${entry.price.toFixed(2)}
                </span>
                <span className="relative z-10 text-right text-gray-900 dark:text-white font-mono">
                  {entry.amount.toFixed(2)}
                </span>
                <span className="relative z-10 text-right text-gray-600 dark:text-gray-400 font-mono">
                  {entry.total.toFixed(2)}
                </span>
              </div>
            ))}
            {buySide.length === 0 && (
              <div className="text-center text-gray-400 dark:text-gray-500 py-2">
                No buy orders
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
