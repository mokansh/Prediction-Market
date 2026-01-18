'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import axios from 'axios';

interface Market {
  id: string;
  title: string;
  category: string;
  yesPrice: number;
  noPrice: number;
  volume: string;
}

interface ResolutionState {
  selectedMarketId: string | null;
  selectedOutcome: 'YES' | 'NO' | null;
  isResolving: boolean;
  error: string | null;
  success: string | null;
  transactionHash: string | null;
}

export default function AdminResolutionPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<ResolutionState>({
    selectedMarketId: null,
    selectedOutcome: null,
    isResolving: false,
    error: null,
    success: null,
    transactionHash: null,
  });

  useEffect(() => {
    fetchMarkets();
  }, []);

  const fetchMarkets = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/markets');
      console.log('[AdminResolution] Markets API Response:', response.data);
      
      // Handle both response formats
      const marketsList = response.data.markets || response.data || [];
      console.log('[AdminResolution] Markets list:', marketsList);
      
      if (Array.isArray(marketsList)) {
        // Transform backend market format if needed
        const transformedMarkets = marketsList.map((market: any) => ({
          id: market.id || market.questionId || '',
          title: market.title || market.question || 'Unknown Market',
          category: market.category || 'General',
          yesPrice: market.yesPrice || 50,
          noPrice: market.noPrice || 50,
          volume: market.volume || '$0',
        }));
        console.log('[AdminResolution] Transformed markets:', transformedMarkets);
        setMarkets(transformedMarkets);
      }
    } catch (err: any) {
      console.error('[AdminResolution] Error fetching markets:', err);
      setState(prev => ({
        ...prev,
        error: `Failed to load markets: ${err.message || 'Unknown error'}`,
      }));
    } finally {
      setLoading(false);
    }
  };

  const selectedMarket = markets.find(m => m.id === state.selectedMarketId);

  const handleResolve = async () => {
    if (!state.selectedMarketId || !state.selectedOutcome) {
      setState(prev => ({
        ...prev,
        error: 'Please select both a market and an outcome',
      }));
      return;
    }

    try {
      setState(prev => ({
        ...prev,
        isResolving: true,
        error: null,
        success: null,
      }));

      const response = await axios.post('/api/admin/resolve-market', {
        marketId: state.selectedMarketId,
        outcome: state.selectedOutcome,
      });

      if (response.data.success) {
        setState(prev => ({
          ...prev,
          success: `Market resolved as ${state.selectedOutcome}`,
          transactionHash: response.data.transactionHash,
          selectedMarketId: null,
          selectedOutcome: null,
        }));

        // Refresh markets after resolution
        setTimeout(() => {
          fetchMarkets();
        }, 2000);
      } else {
        setState(prev => ({
          ...prev,
          error: response.data.error || 'Failed to resolve market',
        }));
      }
    } catch (err: any) {
      console.error('[AdminResolution] Error resolving market:', err);
      setState(prev => ({
        ...prev,
        error: err.response?.data?.error || err.message || 'Failed to resolve market',
      }));
    } finally {
      setState(prev => ({
        ...prev,
        isResolving: false,
      }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 backdrop-blur-md border-b border-slate-700/50 bg-slate-950/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                Polymarket
              </h1>
              <p className="text-sm text-gray-400 mt-1">Admin Resolution</p>
            </div>
            <Link
              href="/"
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-gray-200 transition-colors"
            >
              Back to Markets
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Success Message */}
        {state.success && (
          <div className="mb-6 p-4 rounded-lg bg-green-900/30 border border-green-500/50">
            <p className="text-green-400 font-medium">{state.success}</p>
            {state.transactionHash && (
              <p className="text-green-300 text-sm mt-2">
                Tx: <code className="bg-slate-800 px-2 py-1 rounded">{state.transactionHash.slice(0, 20)}...</code>
              </p>
            )}
          </div>
        )}

        {/* Error Message */}
        {state.error && (
          <div className="mb-6 p-4 rounded-lg bg-red-900/30 border border-red-500/50">
            <p className="text-red-400 font-medium">{state.error}</p>
          </div>
        )}

        {/* Resolution Panel */}
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl border border-slate-700/50 backdrop-blur p-8">
          <h2 className="text-2xl font-bold mb-8">Market Resolution</h2>

          {loading ? (
            <div className="text-center py-12 text-gray-400">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mb-4"></div>
              <p>Loading markets...</p>
            </div>
          ) : markets.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-6 max-w-md mx-auto">
                <p className="text-yellow-400 font-medium mb-2">No markets available</p>
                <p className="text-yellow-300/70 text-sm">
                  No prediction markets have been created yet. Visit the <Link href="/admin" className="underline hover:text-yellow-200">Admin page</Link> to create the first market.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Market Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Select Market to Resolve
                </label>
                <select
                  value={state.selectedMarketId || ''}
                  onChange={(e) =>
                    setState(prev => ({
                      ...prev,
                      selectedMarketId: e.target.value,
                      selectedOutcome: null,
                    }))
                  }
                  className="w-full px-4 py-3 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                >
                  <option value="">-- Select a market --</option>
                  {markets.map(market => (
                    <option key={market.id} value={market.id}>
                      {market.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected Market Preview */}
              {selectedMarket && (
                <div className="p-4 rounded-lg bg-slate-700/30 border border-slate-600/50">
                  <h3 className="font-semibold text-white mb-2">{selectedMarket.title}</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Category:</span>
                      <p className="text-white font-medium">{selectedMarket.category}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Volume:</span>
                      <p className="text-white font-medium">{selectedMarket.volume}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">YES Price:</span>
                      <p className="text-green-400 font-medium">${selectedMarket.yesPrice.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">NO Price:</span>
                      <p className="text-red-400 font-medium">${selectedMarket.noPrice.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Outcome Selection */}
              {selectedMarket && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Select Winning Outcome
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() =>
                        setState(prev => ({
                          ...prev,
                          selectedOutcome: 'YES',
                        }))
                      }
                      className={`p-4 rounded-lg border-2 font-semibold transition-all ${
                        state.selectedOutcome === 'YES'
                          ? 'border-green-400 bg-green-400/20 text-green-300'
                          : 'border-slate-600 bg-slate-700/30 text-gray-400 hover:border-green-400/50'
                      }`}
                    >
                      ✓ YES Wins
                    </button>
                    <button
                      onClick={() =>
                        setState(prev => ({
                          ...prev,
                          selectedOutcome: 'NO',
                        }))
                      }
                      className={`p-4 rounded-lg border-2 font-semibold transition-all ${
                        state.selectedOutcome === 'NO'
                          ? 'border-red-400 bg-red-400/20 text-red-300'
                          : 'border-slate-600 bg-slate-700/30 text-gray-400 hover:border-red-400/50'
                      }`}
                    >
                      ✓ NO Wins
                    </button>
                  </div>
                </div>
              )}

              {/* Resolution Summary */}
              {selectedMarket && state.selectedOutcome && (
                <div className="p-4 rounded-lg bg-blue-900/20 border border-blue-500/50">
                  <p className="text-blue-300 text-sm">
                    Ready to resolve <strong>{selectedMarket.title}</strong> as{' '}
                    <strong className={state.selectedOutcome === 'YES' ? 'text-green-400' : 'text-red-400'}>
                      {state.selectedOutcome}
                    </strong>
                    . Payouts will be set to [{state.selectedOutcome === 'YES' ? '1, 0' : '0, 1'}].
                  </p>
                </div>
              )}

              {/* Resolve Button */}
              <button
                onClick={handleResolve}
                disabled={!selectedMarket || !state.selectedOutcome || state.isResolving}
                className="w-full px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-cyan-500/50"
              >
                {state.isResolving ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Resolving...
                  </span>
                ) : (
                  'Resolve Market'
                )}
              </button>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="mt-12 p-6 rounded-lg bg-slate-800/30 border border-slate-700/50">
          <h3 className="text-lg font-semibold text-white mb-4">About Market Resolution</h3>
          <ul className="space-y-2 text-gray-300 text-sm">
            <li>• Admin can manually resolve markets that have been flagged for manual resolution</li>
            <li>• Select the market and the winning outcome (YES or NO)</li>
            <li>• Click "Resolve Market" to call the resolveManually function on UmaCtfAdapter</li>
            <li>• Payouts will be set based on the selected outcome</li>
            <li>• The transaction must be confirmed on the blockchain</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
