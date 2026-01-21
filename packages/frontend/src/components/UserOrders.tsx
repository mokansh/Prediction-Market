'use client';

import React, { useState, useEffect } from 'react';
import { useWallet } from '@/context/WalletContext';

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

export function UserOrders() {
  const { address, isConnected } = useWallet();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isConnected && address) {
      fetchUserOrders();
      const interval = setInterval(fetchUserOrders, 10000); // Refresh every 10 seconds
      return () => clearInterval(interval);
    } else {
      setOrders([]);
    }
  }, [address, isConnected]);

  const fetchUserOrders = async () => {
    if (!address) return;

    setLoading(true);
    try {
      const response = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL +`/api/orders/user/${address}`);
      const data = await response.json();

      if (data.success) {
        setOrders(data.orders || []);
        setError(null);
      } else {
        setError(data.error || 'Failed to load orders');
      }
    } catch (err) {
      console.error('[UserOrders] Fetch error:', err);
      setError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const cancelOrder = async (orderId: string) => {
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        // Refresh orders
        fetchUserOrders();
      } else {
        alert(data.error || 'Failed to cancel order');
      }
    } catch (err) {
      console.error('[UserOrders] Cancel error:', err);
      alert('Failed to cancel order');
    }
  };

  if (!isConnected) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-gray-400">
        Connect your wallet to view orders
      </div>
    );
  }

  if (loading && orders.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-gray-400">
        Loading orders...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-500 dark:text-red-400">
        {error}
      </div>
    );
  }

  if (orders.length === 0) {
    return null;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'FULLY_FILLED':
        return 'text-green-600 dark:text-green-400';
      case 'PARTIAL_FILLED':
        return 'text-blue-600 dark:text-blue-400';
      case 'PENDING':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'CANCELLED':
        return 'text-gray-600 dark:text-gray-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-slate-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          Your Orders ({orders.length})
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-slate-800 text-xs text-gray-500 dark:text-gray-400 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Side</th>
              <th className="px-4 py-3 text-left">Outcome</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Filled</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                <td className="px-4 py-3">
                  <span
                    className={`text-sm font-medium ${
                      order.side === 'BUY'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {order.side}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                  {order.outcome}
                </td>
                <td className="px-4 py-3 text-sm text-right font-mono text-gray-900 dark:text-white">
                  ${order.price.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-sm text-right font-mono text-gray-900 dark:text-white">
                  {order.amount.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-sm text-right font-mono text-gray-600 dark:text-gray-400">
                  {order.filledAmount.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs font-medium ${getStatusColor(order.status)}`}>
                    {order.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {(order.status === 'PENDING' || order.status === 'PARTIAL_FILLED') && (
                    <button
                      onClick={() => cancelOrder(order.id)}
                      className="text-xs text-red-600 dark:text-red-400 hover:underline"
                    >
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
