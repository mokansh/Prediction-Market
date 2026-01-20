'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useWallet } from '@/context/WalletContext';
import { useUserBalance } from '@/components/WalletBalance';
import { OrderBook } from '@/components/OrderBook';
import { MyMarketOrders } from '@/components/MyMarketOrders';
import { DepositModal } from '@/components/DepositModal';
import { createAndSignOrder } from '@/utils/eip712Signing';
import axios from 'axios';
import Link from 'next/link';

interface Outcome {
  name: string;
  probability: number;
}

interface MarketDetail {
  id: string;
  conditionId?: string;
  title: string;
  image?: string;
  description: string;
  yesPrice: number;
  noPrice: number;
  volume: string;
  category: string;
  outcomes: Outcome[];
  resolutionDate: string;
  about: string;
}

type OrderType = 'market' | 'limit';
type TradeSide = 'buy' | 'sell';

export default function MarketDetailPage() {
  const params = useParams();
  const marketId = params.id as string;
  const { address, isConnected, connectWallet, disconnectWallet, balance, isConnecting, isCorrectNetwork, switchToAmoy } = useWallet();
  const { balance: walletBalance, loading: balanceLoading } = useUserBalance(address || undefined);
  
  // Market state
  const [market, setMarket] = useState<MarketDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resolution state
  const [isMarketResolved, setIsMarketResolved] = useState(false);
  const [resolutionOutcome, setResolutionOutcome] = useState<'YES' | 'NO' | null>(null);
  const [userWinnings, setUserWinnings] = useState<string | null>(null);
  const [userWinningsFormatted, setUserWinningsFormatted] = useState<string | null>(null);
  const [isRedeemingWinnings, setIsRedeemingWinnings] = useState(false);
  const [isLoadingWinnings, setIsLoadingWinnings] = useState(false);
  const [safeTxSignature, setSafeTxSignature] = useState<string | null>(null);
  const [redeemTxData, setRedeemTxData] = useState<any>(null);

  // Trading state
  const [tradeSide, setTradeSide] = useState<TradeSide>('buy');
  const [selectedOutcome, setSelectedOutcome] = useState<string>('yes');
  const [orderType, setOrderType] = useState<OrderType>('market');
  const [amount, setAmount] = useState<string>('');
  const [shares, setShares] = useState<string>('');
  const [limitPrice, setLimitPrice] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [multisigAddress, setMultisigAddress] = useState<string | null>(null);
  const [marketCondition, setMarketCondition] = useState<{ yesTokenId: string; noTokenId: string } | null>(null);
  const [marketOutcomeBalances, setMarketOutcomeBalances] = useState<{ yesBalance: string; noBalance: string; yesBalanceFormatted: string; noBalanceFormatted: string } | null>(null);
  const [outcomeBalancesLoading, setOutcomeBalancesLoading] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
  const formatTokenBalance = (balance: string): string => {
    const num = parseFloat(balance);
    if (isNaN(num)) return '0';
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 6 });
  };

  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  const getCurrentPrice = () => {
    return selectedOutcome === 'yes' 
      ? market!.yesPrice / 100 
      : market!.noPrice / 100;
  };
  
    const marketProbabilities = market
      ? {
          yes: (market.yesPrice / 100) || 0,
          no: (market.noPrice / 100) || 0,
        }
      : { yes: 0.5, no: 0.5 };

  const resetInputs = () => {
    setAmount('');
    setShares('');
    setLimitPrice('');
  };

  // Fetch market data
  useEffect(() => {
    const fetchMarket = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await axios.get(`${BACKEND_URL}/api/markets/${marketId}`, {
          timeout: 10000,
        });

        if (response.data.success && response.data.market) {
          const backendMarket = response.data.market;
          const resolutionDate = new Date(backendMarket.endTime * 1000).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });

          // Fetch live prices for this market
          let yesPrice = 50;
          let noPrice = 50;

          try {
            const priceRes = await axios.get(`${BACKEND_URL}/api/orders/market/${backendMarket.id}/prices`, {
              timeout: 8000,
            });
            if (priceRes.data?.success && priceRes.data.prices) {
              yesPrice = Math.round((priceRes.data.prices.yes?.midPrice ?? 0.5) * 100);
              noPrice = Math.round((priceRes.data.prices.no?.midPrice ?? 0.5) * 100);
            }
          } catch (err) {
            console.warn('[MarketDetail] Failed to fetch prices for market', backendMarket.id);
          }

          const formattedMarket: MarketDetail = {
            id: backendMarket.id,
            conditionId: backendMarket.conditionId,
            title: backendMarket.question,
            image: backendMarket.image || '❓',
            yesPrice,
            noPrice,
            volume: '$0',
            category: backendMarket.category,
            description: backendMarket.description,
            resolutionDate,
            about: backendMarket.description,
            outcomes: [
              { name: 'yes', probability: yesPrice },
              { name: 'no', probability: noPrice }
            ]
          };

          setMarket(formattedMarket);
        } else {
          setError('Market not found');
        }
      } catch (err: any) {
        console.error('[MarketDetail] Failed to fetch market:', err);
        setError(err.response?.data?.error || err.message || 'Failed to load market');
      } finally {
        setIsLoading(false);
      }
    };

    if (marketId) {
      fetchMarket();
    }
  }, [marketId, BACKEND_URL]);

  // Check market resolution status
  useEffect(() => {
    if (marketId) {
      const checkResolution = async () => {
        try {
          const response = await axios.get(`${BACKEND_URL}/api/markets/${marketId}/resolution-status`, {
            timeout: 10000,
          });

          if (response.data.success) {
            setIsMarketResolved(response.data.resolved);
            setResolutionOutcome(response.data.outcome);

            // If market is resolved and user is connected, check for winnings
            if (response.data.resolved && response.data.outcome && isConnected && address) {
              const userAddress = address;

              try {
                const winningsResponse = await axios.post(`${BACKEND_URL}/api/wallet/redeem-winnings`, {
                  userAddress,
                  marketId,
                });

                if (winningsResponse.data.success) {
                  setUserWinnings(winningsResponse.data.redeemData.redeemableAmount);
                  setUserWinningsFormatted(winningsResponse.data.redeemData.redeemableAmountFormatted);
                }
              } catch (err) {
                console.log('[MarketDetail] No winnings to redeem:', err);
              }
            }
          }
        } catch (err: any) {
          console.warn('[MarketDetail] Failed to fetch resolution status:', err);
        }
      };

      checkResolution();
    }
  }, [marketId, isConnected, address, BACKEND_URL]);

  // Fetch winnings when market is resolved and user connects
  useEffect(() => {
    if (isMarketResolved && resolutionOutcome && isConnected && address && marketId) {
      setIsLoadingWinnings(true);
      const fetchWinnings = async () => {
        try {
          // Use multisig address if available, otherwise use EOA address
          const walletToCheck = multisigAddress || address;
          
          console.log('[MarketDetail] Fetching winnings for:', {
            walletToCheck,
            marketId,
            multisigAddress,
            address,
            resolutionOutcome,
          });

          const winningsResponse = await axios.post(`${BACKEND_URL}/api/wallet/redeem-winnings`, {
            userAddress: walletToCheck,
            marketId,
          });

          console.log('[MarketDetail] Winnings response:', winningsResponse.data);

          if (winningsResponse.data.success && winningsResponse.data.redeemData) {
            const amount = winningsResponse.data.redeemData.redeemableAmount;
            console.log('[MarketDetail] Setting winnings:', {
              amount,
              formatted: winningsResponse.data.redeemData.redeemableAmountFormatted,
            });
            // Only set if amount is greater than 0
            if (amount && amount !== '0') {
              setUserWinnings(amount);
              setUserWinningsFormatted(winningsResponse.data.redeemData.redeemableAmountFormatted);
            } else {
              console.log('[MarketDetail] Redeemable amount is 0');
              setUserWinnings(null);
              setUserWinningsFormatted(null);
            }
          } else {
            console.log('[MarketDetail] Winnings response not successful:', winningsResponse.data);
            setUserWinnings(null);
            setUserWinningsFormatted(null);
          }
        } catch (err: any) {
          console.log('[MarketDetail] Error fetching winnings:', err.response?.data || err.message);
          setUserWinnings(null);
          setUserWinningsFormatted(null);
        } finally {
          setIsLoadingWinnings(false);
        }
      };

      fetchWinnings();
    }
  }, [isMarketResolved, resolutionOutcome, isConnected, address, multisigAddress, marketId, BACKEND_URL]);

  // Fetch multisig address
  useEffect(() => {
    if (isConnected && address) {
      const fetchMultisigAddress = async () => {
        try {
          const response = await fetch(`/api/wallet/check-deployment/${address}`);
          if (response.ok) {
            const data = await response.json();
            if (data.proxyAddress) {
              setMultisigAddress(data.proxyAddress);
            } else {
              setMultisigAddress(address);
            }
          }
        } catch (err) {
          console.warn('[MarketDetail] Failed to fetch multisig address:', err);
          setMultisigAddress(address);
        }
      };
      fetchMultisigAddress();
    } else if (!isConnected) {
      setMultisigAddress(null);
    }
  }, [isConnected, address]);

  // Fetch market condition
  useEffect(() => {
    setMarketCondition(null);
  }, [market?.id, market?.conditionId]);

  useEffect(() => {
    if (!market) return;
    
    const conditionKey = market.conditionId || market.id;

    if (conditionKey && !marketCondition) {
      const fetchMarketCondition = async () => {
        try {
          const response = await fetch(`/api/market-conditions/condition/${conditionKey}`);
          if (response.ok) {
            const data = await response.json();
            if (data.marketCondition) {
              setMarketCondition({
                yesTokenId: data.marketCondition.yesTokenId,
                noTokenId: data.marketCondition.noTokenId,
              });
            }
          }
        } catch (err) {
          console.warn('[MarketDetail] Failed to fetch market condition:', err);
        }
      };
      fetchMarketCondition();
    }
  }, [market?.id, market?.conditionId, marketCondition]);

  // Fetch outcome balances
  useEffect(() => {
    if (isConnected && address && market?.id && multisigAddress) {
      const fetchOutcomeBalances = async () => {
        try {
          setOutcomeBalancesLoading(true);
          const walletToCheck = multisigAddress || address;
          const response = await fetch(`/api/wallet/market-balances/${address}/${market.id}?walletAddress=${walletToCheck}`);
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              setMarketOutcomeBalances({
                yesBalance: data.yesBalance,
                noBalance: data.noBalance,
                yesBalanceFormatted: data.yesBalanceFormatted,
                noBalanceFormatted: data.noBalanceFormatted,
              });
            }
          }
        } catch (err) {
          console.warn('[MarketDetail] Failed to fetch outcome balances:', err);
        } finally {
          setOutcomeBalancesLoading(false);
        }
      };
      fetchOutcomeBalances();
    }
  }, [isConnected, address, market?.id, multisigAddress]);

  // Calculate shares/USDC for market order
  useEffect(() => {
    if (orderType === 'market' && amount && market) {
      const price = getCurrentPrice();
      if (tradeSide === 'buy') {
        const calculatedShares = (parseFloat(amount) / price).toFixed(2);
        setShares(calculatedShares);
      } else {
        setShares(amount);
      }
    }
  }, [amount, selectedOutcome, orderType, tradeSide, market]);

  // Calculate amount for limit order
  useEffect(() => {
    if (orderType === 'limit' && shares && limitPrice) {
      const calculatedAmount = (parseFloat(shares) * parseFloat(limitPrice)).toFixed(2);
      setAmount(calculatedAmount);
    }
  }, [shares, limitPrice, orderType]);

  const handleTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrderError(null);
    setOrderSuccess(null);

    if (!isConnected || !address || !market) {
      setOrderError('Please connect your wallet first');
      return;
    }

    // Validate inputs
    if (orderType === 'market') {
      if (!amount || parseFloat(amount) <= 0) {
        setOrderError('Please enter a valid amount');
        return;
      }
    } else {
      if (!shares || parseFloat(shares) <= 0) {
        setOrderError('Please enter valid number of shares');
        return;
      }
      if (!limitPrice || parseFloat(limitPrice) <= 0 || parseFloat(limitPrice) > 1) {
        setOrderError('Please enter a valid limit price (0.01 - 0.99)');
        return;
      }
    }

    // Check balance
    if (walletBalance && parseFloat(amount) > parseFloat(walletBalance.collateralBalanceFormatted)) {
      setOrderError(`Insufficient balance. Available: ${walletBalance.collateralBalanceFormatted} USDC`);
      return;
    }

    // Check SELL tokens
    if (tradeSide === 'sell') {
      const availableStr = selectedOutcome.toLowerCase() === 'yes'
        ? marketOutcomeBalances?.yesBalanceFormatted
        : marketOutcomeBalances?.noBalanceFormatted;
      const available = parseFloat(availableStr || '0');
      if (parseFloat(shares) > available) {
        setOrderError(
          `Insufficient ${selectedOutcome.toUpperCase()} tokens. Available: ${available.toFixed(6)}`
        );
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const orderPrice = orderType === 'market' ? getCurrentPrice() : parseFloat(limitPrice);
      const orderAmount = parseFloat(shares);
      const side: 0 | 1 = tradeSide === 'buy' ? 0 : 1;

      const provider = (window as any).ethereum;
      if (!provider) {
        throw new Error('Web3 wallet provider not found. Please install MetaMask or another Web3 wallet.');
      }

      setOrderError('Waiting for signature approval...');

      if (!marketCondition) {
        throw new Error('Market condition not available. Unable to determine tokenId for order.');
      }

      const finalTokenId = selectedOutcome.toLowerCase() === 'yes' 
        ? marketCondition.yesTokenId 
        : marketCondition.noTokenId;
      
      const makerAddress = multisigAddress || address;
      
      const { message, signature } = await createAndSignOrder(
        provider,
        side,
        orderAmount,
        orderPrice,
        finalTokenId,
        makerAddress
      );

      setOrderError(null);

      const response = await fetch('/api/orders/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketId: market.id,
          orderData: message,
          signature,
          outcome: selectedOutcome.toUpperCase()
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to place order');
      }

      const matchInfo = data.matches > 0 
        ? ` (${data.matches} match${data.matches > 1 ? 'es' : ''} found!)` 
        : ' (added to order book)';
      
      setOrderSuccess(
        `${orderType === 'market' ? 'Market' : 'Limit'} order placed successfully${matchInfo}\n` +
        `${orderAmount.toFixed(2)} ${selectedOutcome.toUpperCase()} shares @ $${orderPrice.toFixed(2)}`
      );

      setTimeout(() => {
        resetInputs();
        setOrderSuccess(null);
      }, 3000);

    } catch (error: any) {
      console.error('[MarketDetail] Order submission error:', error);
      
      if (error.message?.includes('User rejected') || error.code === 4001) {
        setOrderError('Signature request was rejected by user');
      } else if (error.message?.includes('Web3')) {
        setOrderError(error.message);
      } else {
        setOrderError(error.message || 'Failed to place order. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
          <p>Loading market details...</p>
        </div>
      </div>
    );
  }

  if (error || !market) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Market Not Found</h1>
          <p className="text-gray-400 mb-6">{error || 'Unable to load market details'}</p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            Back to Markets
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-700/50 sticky top-0 z-40 bg-slate-950/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top Navigation */}
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <Link 
                href="/"
                className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent hover:opacity-80 transition-opacity"
              >
                Polymarket
              </Link>
              <Link 
                href="/admin"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Admin
              </Link>
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
                  <div className="text-right">
                    <div className="text-xs text-gray-500">
                      Connected
                    </div>
                    <div className="text-sm font-semibold text-white">
                      {formatAddress(address)}
                    </div>
                    {balance && (
                      <div className="text-xs text-gray-500">
                        {balance} ETH
                      </div>
                    )}
                  </div>
                  <button
                    onClick={disconnectWallet}
                    className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition-colors text-sm shadow-lg"
                  >
                    Disconnect
                  </button>
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
        </div>
      </header>

      {/* Market Header with Back Button */}
      <div className="border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Markets
          </Link>
          <div className="text-sm text-gray-400">
            {market?.category}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Market Details */}
          <div className="lg:col-span-2">
            {/* Market Title and Image */}
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6 mb-6">
              <div className="flex gap-4 mb-6">
                <div className="text-6xl">{market.image}</div>
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-white mb-2">{market.title}</h1>
                  <div className="flex items-center gap-2 text-gray-400">
                    <span className="text-sm">Resolution Date:</span>
                    <span className="text-sm font-semibold text-white">{market.resolutionDate}</span>
                  </div>
                </div>
              </div>

              {/* Price Chart Placeholder */}
              <div className="bg-slate-900/50 rounded-lg p-6 mb-6 border border-slate-700">
                <div className="h-64 flex items-center justify-center text-gray-500">
                  <p>Market price chart would display here</p>
                </div>
              </div>

              {/* Outcomes */}
              <div className="grid grid-cols-2 gap-4">
                {market.outcomes.map((outcome) => (
                  <div
                    key={outcome.name}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      outcome.name === 'yes'
                        ? 'border-green-500/30 bg-green-500/10'
                        : 'border-red-500/30 bg-red-500/10'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-300 capitalize text-sm font-semibold">{outcome.name}</span>
                      <span
                        className={`text-lg font-bold ${
                          outcome.name === 'yes' ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {outcome.probability}%
                      </span>
                    </div>
                    <div className={`w-full h-2 rounded-full ${
                      outcome.name === 'yes' ? 'bg-green-500/20' : 'bg-red-500/20'
                    }`}>
                      <div
                        className={`h-full rounded-full ${
                          outcome.name === 'yes' ? 'bg-green-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${outcome.probability}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6 mb-6">
              <h2 className="text-xl font-bold text-white mb-4">About This Market</h2>
              <p className="text-gray-300 leading-relaxed">{market.about}</p>
            </div>

            {/* Order Book */}
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6 mb-6">
              <OrderBook marketId={market.id} outcome={selectedOutcome === 'yes' ? 'YES' : 'NO'} />
            </div>

            {/* User Orders */}
            {isConnected && (
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
                <MyMarketOrders marketId={market.id} />
              </div>
            )}
          </div>

          {/* Right Column - Trading Panel */}
          <div className="lg:col-span-1">
            {/* Market Resolution Alert */}
            {isMarketResolved && (
              <div className="bg-gradient-to-br from-amber-900/40 to-orange-900/40 border border-amber-500/50 rounded-xl p-6 mb-6 backdrop-blur">
                <div className="flex items-start gap-3">
                  <div className="text-3xl">✓</div>
                  <div>
                    <h3 className="text-lg font-bold text-amber-300 mb-2">Market Resolved</h3>
                    <p className="text-amber-200/80 text-sm mb-3">
                      This market has been resolved. {resolutionOutcome ? `${resolutionOutcome} won!` : 'Outcome pending.'}
                    </p>

                    {/* Winning Display */}
                    {userWinnings && userWinningsFormatted && (
                      <div className="bg-amber-900/30 rounded-lg p-4 mb-4 border border-amber-500/30">
                        <p className="text-xs text-amber-300 mb-2">YOUR WINNINGS</p>
                        <p className="text-2xl font-bold text-amber-200 mb-3">
                          {userWinningsFormatted} {resolutionOutcome} Tokens
                        </p>
                        {isConnected ? (
                          <div className="space-y-3">
                            {/* Step 1: Sign Safe Transaction */}
                            {!safeTxSignature ? (
                              <button
                                onClick={async () => {
                                  if (!address || !multisigAddress) {
                                    setOrderError('Multisig wallet not found');
                                    return;
                                  }

                                  setIsRedeemingWinnings(true);
                                  setOrderError(null);
                                  setOrderSuccess(null);

                                  try {
                                    // Get the redeemPositions call data from backend
                                    const redeemResponse = await axios.post(`${BACKEND_URL}/api/wallet/redeem-winnings`, {
                                      userAddress: multisigAddress,
                                      marketId,
                                    });

                                    if (!redeemResponse.data.success) {
                                      throw new Error(redeemResponse.data.error || 'Failed to prepare redemption');
                                    }

                                    const redeemData = redeemResponse.data.redeemData;
                                    if (!redeemData || !redeemData.safeTxData) {
                                      throw new Error('Invalid redemption data from server');
                                    }

                                    setRedeemTxData(redeemData);

                                    // Get user's signer
                                    const { ethers } = await import('ethers');
                                    if (!window.ethereum) {
                                      throw new Error('MetaMask not detected');
                                    }

                                    const provider = new ethers.BrowserProvider(window.ethereum);
                                    const signer = await provider.getSigner();

                                    // Prepare EIP712 domain and message for Safe transaction
                                    const domain = {
                                      chainId: 80002, // Polygon Amoy
                                      verifyingContract: multisigAddress,
                                    };

                                    const types = {
                                      SafeTx: [
                                        { name: 'to', type: 'address' },
                                        { name: 'value', type: 'uint256' },
                                        { name: 'data', type: 'bytes' },
                                        { name: 'operation', type: 'uint8' },
                                        { name: 'safeTxGas', type: 'uint256' },
                                        { name: 'baseGas', type: 'uint256' },
                                        { name: 'gasPrice', type: 'uint256' },
                                        { name: 'gasToken', type: 'address' },
                                        { name: 'refundReceiver', type: 'address' },
                                        { name: 'nonce', type: 'uint256' },
                                      ],
                                    };

                                    const message = {
                                      to: redeemData.safeTxData.to,
                                      value: redeemData.safeTxData.value,
                                      data: redeemData.safeTxData.data,
                                      operation: redeemData.safeTxData.operation,
                                      safeTxGas: redeemData.safeTxData.safeTxGas,
                                      baseGas: redeemData.safeTxData.baseGas,
                                      gasPrice: redeemData.safeTxData.gasPrice,
                                      gasToken: redeemData.safeTxData.gasToken,
                                      refundReceiver: redeemData.safeTxData.refundReceiver,
                                      nonce: redeemData.safeTxData.nonce,
                                    };

                                    // Sign the Safe transaction with EIP712
                                    const signature = await signer.signTypedData(domain, types, message);
                                    setSafeTxSignature(signature);
                                    setOrderSuccess('✓ Transaction signed! Now click "Execute Redemption" to complete.');
                                  } catch (err: any) {
                                    console.error('[MarketDetail] Signing error:', err);
                                    setOrderError(
                                      err.message?.includes('user rejected')
                                        ? 'Signature cancelled'
                                        : err.response?.data?.error || err.message || 'Failed to sign transaction'
                                    );
                                  } finally {
                                    setIsRedeemingWinnings(false);
                                  }
                                }}
                                disabled={isRedeemingWinnings}
                                className="w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                              >
                                {isRedeemingWinnings ? 'Signing...' : '1. Sign Transaction'}
                              </button>
                            ) : (
                              /* Step 2: Execute Safe Transaction */
                              <button
                                onClick={async () => {
                                  if (!address || !multisigAddress || !safeTxSignature || !redeemTxData) {
                                    setOrderError('Missing signature or transaction data');
                                    return;
                                  }

                                  setIsRedeemingWinnings(true);
                                  setOrderError(null);
                                  setOrderSuccess(null);

                                  try {
                                    const { ethers } = await import('ethers');
                                    if (!window.ethereum) {
                                      throw new Error('MetaMask not detected');
                                    }

                                    const provider = new ethers.BrowserProvider(window.ethereum);
                                    const signer = await provider.getSigner();

                                    // Safe contract ABI for execTransaction
                                    const safeABI = [
                                      'function execTransaction(address to, uint256 value, bytes calldata data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address payable refundReceiver, bytes memory signatures) external payable returns (bool success)'
                                    ];

                                    const safeContract = new ethers.Contract(multisigAddress, safeABI, signer);

                                    const txData = redeemTxData.safeTxData;
                                    const tx = await safeContract.execTransaction(
                                      txData.to,
                                      txData.value,
                                      txData.data,
                                      txData.operation,
                                      txData.safeTxGas,
                                      txData.baseGas,
                                      txData.gasPrice,
                                      txData.gasToken,
                                      txData.refundReceiver,
                                      safeTxSignature
                                    );

                                    const receipt = await tx.wait();
                                    setOrderSuccess(`✓ Redemption successful! Tx: ${receipt?.transactionHash?.substring(0, 10)}...`);
                                    
                                    // Reset and reload after successful redemption
                                    setTimeout(() => {
                                      setSafeTxSignature(null);
                                      setRedeemTxData(null);
                                      window.location.reload();
                                    }, 2000);
                                  } catch (err: any) {
                                    console.error('[MarketDetail] Execution error:', err);
                                    setOrderError(
                                      err.message?.includes('user denied')
                                        ? 'Transaction cancelled'
                                        : err.message || 'Failed to execute redemption'
                                    );
                                  } finally {
                                    setIsRedeemingWinnings(false);
                                  }
                                }}
                                disabled={isRedeemingWinnings}
                                className="w-full px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-amber-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                              >
                                {isRedeemingWinnings ? 'Executing...' : '2. Execute Redemption'}
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={connectWallet}
                            className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg transition-colors"
                          >
                            Connect Wallet to Claim Winnings
                          </button>
                        )}
                      </div>
                    )}

                    {isConnected && !userWinnings && isLoadingWinnings && (
                      <p className="text-sm text-amber-200/70 mb-3">Loading winnings...</p>
                    )}

                    {isConnected && !userWinnings && !isLoadingWinnings && (
                      <p className="text-sm text-amber-200/70 mb-3">You do not have any winning tokens from this market.</p>
                    )}

                    {!isConnected && !userWinnings && (
                      <button
                        onClick={connectWallet}
                        className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg transition-colors"
                      >
                        Connect Wallet to Check Winnings
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!isMarketResolved && (
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6 sticky top-32">
              <h2 className="text-xl font-bold text-white mb-4">
                Place Order
              </h2>

              {/* Your Market Position */}
              {isConnected && marketOutcomeBalances && (
                <div className="mb-6 p-4 bg-slate-900/50 rounded-lg border border-slate-600">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">Your Market Position</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">YES Tokens</span>
                      <span className="text-green-400 font-semibold">{formatTokenBalance(marketOutcomeBalances.yesBalanceFormatted)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">NO Tokens</span>
                      <span className="text-red-400 font-semibold">{formatTokenBalance(marketOutcomeBalances.noBalanceFormatted)}</span>
                    </div>
                    {multisigAddress && (
                      <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-slate-600">
                        <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded">Multisig Wallet</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Buy/Sell Tabs */}
              <div className="flex gap-2 mb-6">
                <button 
                  onClick={() => setTradeSide('buy')}
                  disabled={isMarketResolved}
                  className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-colors ${
                    isMarketResolved 
                      ? 'bg-slate-700 border border-slate-600 text-gray-500 cursor-not-allowed opacity-50'
                      : tradeSide === 'buy'
                      ? 'bg-green-600/20 border border-green-500 text-green-400'
                      : 'bg-slate-700 border border-slate-600 text-gray-400 hover:bg-slate-600'
                  }`}
                >
                  Buy
                </button>
                <button 
                  onClick={() => setTradeSide('sell')}
                  disabled={isMarketResolved}
                  className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-colors ${
                    isMarketResolved
                      ? 'bg-slate-700 border border-slate-600 text-gray-500 cursor-not-allowed opacity-50'
                      : tradeSide === 'sell'
                      ? 'bg-red-600/20 border border-red-500 text-red-400'
                      : 'bg-slate-700 border border-slate-600 text-gray-400 hover:bg-slate-600'
                  }`}
                >
                  Sell
                </button>
              </div>

              {/* Order Type Toggle */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">Order Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { setOrderType('market'); resetInputs(); }}
                    className={`py-2 px-3 rounded-lg border transition-colors font-medium text-sm ${
                      orderType === 'market'
                        ? 'border-blue-500 bg-blue-600/20 text-blue-300'
                        : 'border-slate-600 bg-slate-700 text-gray-400 hover:bg-slate-600'
                    }`}
                  >
                    Market
                  </button>
                  <button
                    onClick={() => { setOrderType('limit'); resetInputs(); }}
                    className={`py-2 px-3 rounded-lg border transition-colors font-medium text-sm ${
                      orderType === 'limit'
                        ? 'border-blue-500 bg-blue-600/20 text-blue-300'
                        : 'border-slate-600 bg-slate-700 text-gray-400 hover:bg-slate-600'
                    }`}
                  >
                    Limit
                  </button>
                </div>
              </div>

              {/* Outcome Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-3">Select Outcome</label>
                <div className="space-y-2">
                  <button 
                    onClick={() => { setSelectedOutcome('yes'); resetInputs(); }}
                    className={`w-full p-3 rounded-lg border transition-colors font-semibold capitalize ${
                      selectedOutcome === 'yes'
                        ? 'border-green-500 bg-green-500/10 text-green-400 hover:bg-green-500/20'
                        : 'border-slate-600 bg-slate-700 text-gray-400 hover:bg-slate-600'
                    }`}
                  >
                    Yes
                  </button>
                  <button 
                    onClick={() => { setSelectedOutcome('no'); resetInputs(); }}
                    className={`w-full p-3 rounded-lg border transition-colors font-semibold capitalize ${
                      selectedOutcome === 'no'
                        ? 'border-red-500 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                        : 'border-slate-600 bg-slate-700 text-gray-400 hover:bg-slate-600'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>

              {/* Market Order Inputs */}
              {orderType === 'market' && (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {tradeSide === 'buy' ? 'Amount (USDC)' : 'Amount (Shares)'}
                    </label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                          e.preventDefault();
                        }
                      }}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none no-spinner"
                    />
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {tradeSide === 'buy' ? "You'll Receive (Shares)" : "You'll Receive (USDC)"}
                    </label>
                    <input
                      type="text"
                      value={tradeSide === 'buy' ? shares : (parseFloat(amount || '0') * getCurrentPrice()).toFixed(2)}
                      readOnly
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-900 text-gray-400 placeholder-gray-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Market price: ${getCurrentPrice().toFixed(2)} per share
                    </p>
                  </div>
                </>
              )}

              {/* Limit Order Inputs */}
              {orderType === 'limit' && (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {tradeSide === 'buy' ? 'Number of Shares' : 'Shares to Sell'}
                    </label>
                    <input
                      type="number"
                      value={shares}
                      onChange={(e) => setShares(e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                          e.preventDefault();
                        }
                      }}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none no-spinner"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Limit Price (per share)
                    </label>
                    <input
                      type="number"
                      value={limitPrice}
                      onChange={(e) => setLimitPrice(e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                          e.preventDefault();
                        }
                      }}
                      placeholder="0.00"
                      step="0.01"
                      min="0.01"
                      max="0.99"
                      className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none no-spinner"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Current market: ${getCurrentPrice().toFixed(2)} | Range: $0.01 - $0.99
                    </p>
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {tradeSide === 'buy' ? 'Total Cost (USDC)' : "You'll Receive (USDC)"}
                    </label>
                    <input
                      type="text"
                      value={amount}
                      readOnly
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-900 text-gray-400 placeholder-gray-500"
                    />
                  </div>
                </>
              )}

              {/* Price Info */}
              {amount && parseFloat(amount) > 0 && (
                <div className="mb-6 p-3 bg-blue-500/10 rounded-lg text-sm text-gray-300 border border-blue-500/30">
                  {tradeSide === 'buy' ? (
                    <>
                      <div className="flex justify-between mb-1">
                        <span>Amount:</span>
                        <span className="font-semibold">${parseFloat(amount).toFixed(2)} USDC</span>
                      </div>
                      <div className="flex justify-between mb-1">
                        <span>Shares:</span>
                        <span className="font-semibold">{shares}</span>
                      </div>
                      {orderType === 'market' && (
                        <div className="flex justify-between">
                          <span>Avg. Price:</span>
                          <span className="font-semibold">${getCurrentPrice().toFixed(2)}</span>
                        </div>
                      )}
                      {orderType === 'limit' && limitPrice && (
                        <div className="flex justify-between">
                          <span>Limit Price:</span>
                          <span className="font-semibold">${parseFloat(limitPrice).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between mt-2 pt-2 border-t border-blue-500/30">
                        <span>Total Cost:</span>
                        <span className="font-semibold text-green-400">${parseFloat(amount).toFixed(2)} USDC</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between mb-1">
                        <span>Shares to Sell:</span>
                        <span className="font-semibold">{amount}</span>
                      </div>
                      <div className="flex justify-between mb-1">
                        <span>USDC Received:</span>
                        <span className="font-semibold">${(parseFloat(amount) * getCurrentPrice()).toFixed(2)}</span>
                      </div>
                      {orderType === 'market' && (
                        <div className="flex justify-between">
                          <span>Avg. Price:</span>
                          <span className="font-semibold">${getCurrentPrice().toFixed(2)}</span>
                        </div>
                      )}
                      {orderType === 'limit' && limitPrice && (
                        <div className="flex justify-between">
                          <span>Limit Price:</span>
                          <span className="font-semibold">${parseFloat(limitPrice).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between mt-2 pt-2 border-t border-blue-500/30">
                        <span>Total Proceeds:</span>
                        <span className="font-semibold text-green-400">${parseFloat(shares).toFixed(2)} USDC</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Error/Success Messages */}
              {orderError && (
                <div className="mb-4 p-3 bg-red-900/20 border border-red-700/50 rounded-lg text-sm text-red-400">
                  {orderError}
                </div>
              )}
              {orderSuccess && (
                <div className="mb-4 p-3 bg-green-900/20 border border-green-700/50 rounded-lg text-sm text-green-400 whitespace-pre-line">
                  {orderSuccess}
                </div>
              )}

              {/* Trade Button */}
              <form onSubmit={handleTrade}>
                <button
                  type="submit"
                  disabled={!isConnected || !amount || parseFloat(amount) <= 0 || isSubmitting || isMarketResolved}
                  className={`w-full py-3 rounded-lg font-semibold transition-all ${
                    isConnected && amount && parseFloat(amount) > 0 && !isSubmitting
                      ? selectedOutcome === 'yes'
                        ? tradeSide === 'buy'
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-red-600 text-white hover:bg-red-700'
                        : tradeSide === 'buy'
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {isSubmitting
                    ? 'Submitting...'
                    : !isConnected
                    ? 'Connect Wallet to Trade'
                    : `${tradeSide === 'buy' ? 'Buy' : 'Sell'} ${selectedOutcome.toUpperCase()}`}
                </button>
              </form>

              <p className="text-xs text-gray-500 mt-4 text-center">
                No fees on this market
              </p>
            </div>
            )}
          </div>
        </div>
      </div>

      {/* Local styles to hide numeric input spinners */}
      <style jsx>{`
        /* Chrome, Safari, Edge, Opera */
        input.no-spinner::-webkit-outer-spin-button,
        input.no-spinner::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        /* Firefox */
        input.no-spinner[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>

      {/* Deposit Modal */}
      <DepositModal
        isOpen={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
      />
    </div>
  );
}
