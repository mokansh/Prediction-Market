'use client';

import React, { useState, useEffect } from 'react';

interface Order {
  id: string;
  marketId: string;
  side: 'BUY' | 'SELL';
  outcome: 'YES' | 'NO';
  amount: number;
  price: number;
  filledAmount: number;
  remainingAmount: number;
  status: string;
  createdAt: number;
}

interface MyMarketOrdersProps {
  marketId: string;
  userAddress?: string;
}

export function MyMarketOrders({ marketId, userAddress }: MyMarketOrdersProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userAddress) {
      fetchUserOrders();
      const interval = setInterval(fetchUserOrders, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [userAddress, marketId]);

  const fetchUserOrders = async () => {
    if (!userAddress) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/orders/user/${userAddress}`);
      const data = await response.json();

      if (data.success) {
        // Filter orders for this market only and exclude fully filled orders
        const marketOrders = (data.orders || []).filter((order: Order) => 
          order.marketId === marketId && order.remainingAmount > 0
        );
        setOrders(marketOrders);
        setError(null);
      } else {
        setError(data.error || 'Failed to load orders');
      }
    } catch (err) {
      console.error('[MyMarketOrders] Fetch error:', err);
      setError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  if (!userAddress) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
        Connect your wallet to see your orders
      </div>
    );
  }

  if (loading && orders.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
        Loading your orders...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500 dark:text-red-400 text-sm">
        {error}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
        No orders yet for this market
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-slate-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          Your Orders
        </h3>
      </div>

      <div className="divide-y divide-gray-200 dark:divide-slate-700">
        {orders.map((order) => (
          <div key={order.id} className="p-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${
                  order.side === 'BUY'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {order.side}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {order.amount.toFixed(2)} {order.outcome}
                </span>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${
                order.status === 'OPEN'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  : order.status === 'FILLED'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
              }`}>
                {order.status}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>${order.price.toFixed(4)}</span>
              <span>
                {order.filledAmount.toFixed(2)} / {order.amount.toFixed(2)} filled
              </span>
            </div>

            {/* Progress bar */}
            <div className="mt-2 w-full bg-gray-200 dark:bg-slate-700 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  order.side === 'BUY'
                    ? 'bg-green-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${(order.filledAmount / order.amount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
