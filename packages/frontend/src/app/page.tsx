'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/context/WalletContext';
import { DepositModal } from '@/components/DepositModal';
import { useUserBalance } from '@/components/WalletBalance';
import { UserOrders } from '@/components/UserOrders';
import axios from 'axios';
import Link from 'next/link';

interface Market {
  id: string;
  title: string;
  image?: string;
  yesPrice: number;
  noPrice: number;
  volume: string;
  category: string;
  description?: string;
  resolutionDate?: string;
  about?: string;
}

// Helper function to convert backend market format to frontend format
function transformBackendMarket(backendMarket: any, prices?: { yesPrice: number; noPrice: number }): Market {
  const resolutionDate = new Date(backendMarket.endTime * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return {
    id: backendMarket.id,
    title: backendMarket.question,
    image: backendMarket.image || '❓',
    yesPrice: prices?.yesPrice ?? 50, // cents
    noPrice: prices?.noPrice ?? 50,
    volume: '$0', // TODO: replace with real volume once available
    category: backendMarket.category,
    description: backendMarket.description,
    resolutionDate,
    about: backendMarket.description,
  };
}

const categories = ['Trending', 'Breaking', 'Politics', 'Sports', 'Crypto', 'Finance', 'Geopolitics', 'Tech'];

function MarketCard({ market, onNavigate }: { market: Market; onNavigate: (id: string) => void }) {
  const yesPercentage = market.yesPrice;
  const noPercentage = market.noPrice;
  
  return (
    <div 
      onClick={() => onNavigate(market.id)}
      className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/20 transition-all cursor-pointer p-4 hover:scale-105 transform"
    >
      <div className="flex gap-4">
        {market.image && (
          <div className="text-4xl flex-shrink-0">
            {market.image}
          </div>
        )}
        <div className="flex-1">
          <h3 className="font-semibold text-white mb-3 line-clamp-2 text-sm hover:text-blue-300 transition-colors">
            {market.title}
          </h3>
          
          {/* Yes/No Grid */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <div className="text-xs text-gray-400 mb-1">Yes</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-700/50 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${yesPercentage}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-green-400 min-w-8">
                  {yesPercentage}¢
                </span>
              </div>
            </div>
            
            <div>
              <div className="text-xs text-gray-400 mb-1">No</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-700/50 rounded-full h-2">
                  <div
                    className="bg-red-500 h-2 rounded-full"
                    style={{ width: `${noPercentage}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-red-400 min-w-8">
                  {noPercentage}¢
                </span>
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <div className="flex justify-between items-center text-xs text-gray-500 pt-3 border-t border-slate-700">
            <span>{market.volume} Vol.</span>
            <span className="bg-slate-700/50 px-2 py-1 rounded text-gray-300">
              {market.category}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const { address, isConnected, isConnecting, error, balance, connectWallet, disconnectWallet, isCorrectNetwork, switchToAmoy } = useWallet();
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const { balance: walletBalance, loading: balanceLoading } = useUserBalance(address || undefined);
  const [isCheckingWallet, setIsCheckingWallet] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [multisigAddress, setMultisigAddress] = useState<string | null>(null);
  const [isMultisigDeployed, setIsMultisigDeployed] = useState<boolean | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [isLoadingMarkets, setIsLoadingMarkets] = useState(true);
  const [showWalletMenu, setShowWalletMenu] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

  const handleMarketNavigate = (marketId: string) => {
    router.push(`/market/${marketId}`);
  };

  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  useEffect(() => {
    const fetchMultisig = async () => {
      if (!isConnected || !address) {
        setMultisigAddress(null);
        setIsMultisigDeployed(null);
        return;
      }

      setIsCheckingWallet(true);
      setWalletError(null);

      try {
        const response = await axios.get(process.env.NEXT_PUBLIC_BACKEND_URL + `/api/wallet/check-deployment/${address}`, {
          timeout: 10000,
        });

        setIsMultisigDeployed(response.data.isDeployed ?? null);
        if (response.data.proxyAddress) {
          setMultisigAddress(response.data.proxyAddress);
        }
      } catch (err: any) {
        const message = err.response?.data?.error || err.message || 'Failed to fetch multisig status';
        setWalletError(message);
        setIsMultisigDeployed(null);
      } finally {
        setIsCheckingWallet(false);
      }
    };

    fetchMultisig();
  }, [isConnected, address, BACKEND_URL]);

  // Fetch markets from backend
  useEffect(() => {
    const fetchMarkets = async () => {
      setIsLoadingMarkets(true);
      try {
        const response = await axios.get(process.env.NEXT_PUBLIC_BACKEND_URL + `/api/markets`, {
          timeout: 10000,
        });

        if (response.data.success && response.data.markets) {
          // Fetch prices for each market in parallel
          const marketsWithPrices = await Promise.all(
            response.data.markets.map(async (m: any) => {
              try {
                const priceRes = await axios.get(process.env.NEXT_PUBLIC_BACKEND_URL + `/api/orders/market/${m.id}/prices`, {
                  timeout: 8000,
                });

                if (priceRes.data?.success && priceRes.data.prices) {
                  const yesPrice = Math.round((priceRes.data.prices.yes?.midPrice ?? 0.5) * 100);
                  const noPrice = Math.round((priceRes.data.prices.no?.midPrice ?? 0.5) * 100);
                  return transformBackendMarket(m, { yesPrice, noPrice });
                }
              } catch (e) {
                console.warn('[Markets] Price fetch failed for market', m.id);
              }

              // Fallback to default 50/50 if price fetch fails
              return transformBackendMarket(m);
            })
          );

          setMarkets(marketsWithPrices);
          console.log('[Markets] Loaded', marketsWithPrices.length, 'markets from backend');
        } else {
          setMarkets([]);
        }
      } catch (err: any) {
        console.error('[Markets] Failed to fetch markets:', err.message);
        setMarkets([]);
      } finally {
        setIsLoadingMarkets(false);
      }
    };

    fetchMarkets();
  }, [BACKEND_URL]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-700/50 sticky top-0 z-40 bg-slate-950/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top Navigation */}
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
                Polymarket
              </h1>
              {isConnected && (
                <div className="flex items-center gap-3">
                  <Link 
                    href="/admin" 
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    Admin
                  </Link>
                  <span className="text-gray-400">/</span>
                  <Link 
                    href="/admin/resolution" 
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    Resolve
                  </Link>
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              {isConnected && address ? (
                <div className="flex items-center gap-3">
                  {walletBalance && (
                    <div className="text-right px-3 py-1.5 bg-green-500/10 rounded-lg border border-green-500/30 backdrop-blur">
                      <div className="text-xs text-gray-400">
                        Available Balance
                      </div>
                      <div className="text-sm font-bold text-green-400">
                        {balanceLoading ? 'Loading...' : `${walletBalance.collateralBalanceFormatted} USDC`}
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => setIsDepositModalOpen(true)}
                    className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-medium transition-colors text-sm shadow-lg"
                  >
                    Deposit
                  </button>
                  
                  {/* Wallet Menu */}
                  <div className="relative">
                    <button
                      onClick={() => setShowWalletMenu(!showWalletMenu)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-medium transition-colors text-sm shadow-lg"
                    >
                      <div className="text-right">
                        <div className="text-xs text-gray-400">Connected</div>
                        <div className="text-sm font-semibold">{formatAddress(address)}</div>
                      </div>
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>

                    {/* Dropdown Menu */}
                    {showWalletMenu && (
                      <div className="absolute right-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
                        <div className="p-4 border-b border-slate-700">
                          <div className="text-xs text-gray-400 mb-1">MetaMask Wallet</div>
                          <div className="text-sm font-mono text-white break-all">{address}</div>
                          {balance && (
                            <div className="text-xs text-gray-500 mt-1">{balance} ETH</div>
                          )}
                        </div>

                        {multisigAddress && (
                          <div className="p-4 border-b border-slate-700 bg-blue-500/5">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-xs text-blue-400 font-semibold">
                                Polymarket Wallet {isMultisigDeployed ? '(Deployed)' : '(Precomputed)'}
                              </div>
                              <button
                                onClick={() => copyToClipboard(multisigAddress)}
                                className="px-2 py-1 rounded text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                              >
                                {copiedAddress ? '✓ Copied' : 'Copy'}
                              </button>
                            </div>
                            <div className="text-sm font-mono text-white break-all">{multisigAddress}</div>
                          </div>
                        )}

                        {isCheckingWallet && (
                          <div className="p-4 text-center text-gray-400 text-sm">
                            Loading wallet info...
                          </div>
                        )}

                        <div className="p-2">
                          <button
                            onClick={() => {
                              disconnectWallet();
                              setShowWalletMenu(false);
                            }}
                            className="w-full px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition-colors text-sm"
                          >
                            Disconnect Wallet
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <button
                  onClick={connectWallet}
                  disabled={isConnecting}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium hover:from-blue-500 hover:to-blue-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                </button>
              )}
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-700/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {walletError && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-700/50 rounded-lg text-red-400 text-sm">
              {walletError}
            </div>
          )}

          {/* Network warning */}
          {isConnected && !isCorrectNetwork && (
            <div className="mb-4 p-3 bg-amber-900/20 border border-amber-700/50 rounded-lg text-amber-300 text-sm flex items-center justify-between gap-3">
              <span>Wrong network detected. Please switch to Polygon Amoy testnet.</span>
              <button
                onClick={switchToAmoy}
                className="px-3 py-1 rounded-md bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-colors"
              >
                Switch Network
              </button>
            </div>
          )}

          {/* Category Navigation */}
          <div className="overflow-x-auto pb-4 -mx-4 px-4">
            <div className="flex gap-2 min-w-min">
              {categories.map((category) => (
                <button
                  key={category}
                  className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all ${
                    category === 'Trending'
                      ? 'bg-blue-600/30 border border-blue-500 text-blue-300'
                      : 'text-gray-400 hover:text-gray-200 border border-slate-700 hover:border-slate-600'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filter */}
        <div className="mb-8 flex gap-4 items-center">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search markets..."
              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-800/50 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur"
            />
          </div>
          <button className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-700 transition-colors text-gray-300 backdrop-blur">
            🔽
          </button>
        </div>

        {/* Markets Grid */}
        {isLoadingMarkets ? (
          <div className="flex justify-center items-center py-20">
            <div className="text-gray-400">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p>Loading markets...</p>
            </div>
          </div>
        ) : markets.length === 0 ? (
          <div className="flex flex-col justify-center items-center py-20 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-semibold text-white mb-2">No Markets Yet</h3>
            <p className="text-gray-400 mb-6 max-w-md">
              No prediction markets have been created yet. {isConnected && 'Visit the Admin page to create the first market!'}
            </p>
            {isConnected && (
              <Link
                href="/admin"
                className="px-6 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium hover:from-blue-500 hover:to-blue-400 transition-all shadow-lg"
              >
                Create First Market
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {markets.map((market) => (
              <MarketCard 
                key={market.id} 
                market={market}
                onNavigate={handleMarketNavigate}
              />
            ))}
          </div>
        )}

        {/* Load More */}
        {!isLoadingMarkets && markets.length > 0 && (
          <div className="mt-12 flex justify-center">
            <button className="px-8 py-3 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-700 transition-colors font-medium text-white backdrop-blur">
              Load More Markets
            </button>
          </div>
        )}

        {/* User Orders Section */}
        {isConnected && (
          <div className="mt-12">
            <UserOrders />
          </div>
        )}
      </main>

      {/* Deposit Modal */}
      <DepositModal
        isOpen={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
      />
    </div>
  );
}
