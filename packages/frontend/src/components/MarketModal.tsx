'use client';

import React, { useState, useEffect } from 'react';
import { useWallet } from '@/context/WalletContext';
import { useUserBalance } from './WalletBalance';
import { OrderBook } from './OrderBook';
import { MyMarketOrders } from './MyMarketOrders';
import { createAndSignOrder } from '@/utils/eip712Signing';

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

interface MarketModalProps {
  market: MarketDetail;
  isOpen: boolean;
  onClose: () => void;
}

type OrderType = 'market' | 'limit';
type TradeSide = 'buy' | 'sell';

export function MarketModal({ market, isOpen, onClose }: MarketModalProps) {
  const { isConnected, address } = useWallet();
  const { balance, loading: balanceLoading } = useUserBalance(address || undefined);
  
    // Helper function to format token balance to 6 decimal places max
    const formatTokenBalance = (balance: string): string => {
      const num = parseFloat(balance);
      if (isNaN(num)) return '0';
      // Format to 6 decimals and remove trailing zeros
      return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 6 });
    };
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

  // Get current market price for selected outcome (in decimal format 0.01 - 0.99)
  const getCurrentPrice = () => {
    return selectedOutcome === 'yes' 
      ? market.yesPrice / 100 
      : market.noPrice / 100;
  };

  // Fetch multisig wallet address for user when connected
  useEffect(() => {
    if (isConnected && address) {
      const fetchMultisigAddress = async () => {
        try {
          const response = await fetch(`/api/wallet/check-deployment/${address}`);
          if (response.ok) {
            const data = await response.json();
            if (data.proxyAddress) {
              setMultisigAddress(data.proxyAddress);
              console.log('[MarketModal] Fetched multisig address:', data.proxyAddress);
            } else {
              // No multisig deployed, use connected address
              setMultisigAddress(address);
            }
          }
        } catch (err) {
          console.warn('[MarketModal] Failed to fetch multisig address, using connected address:', err);
          setMultisigAddress(address);
        }
      };
      fetchMultisigAddress();
    } else if (!isConnected) {
      setMultisigAddress(null);
    }
  }, [isConnected, address]);

  // Fetch market condition (tokenIds) when market changes
  useEffect(() => {
    setMarketCondition(null);
  }, [market.id, market.conditionId]);

  // Fetch market condition (tokenIds) when market changes
  useEffect(() => {
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
              console.log('[MarketModal] Fetched market condition:', data.marketCondition);
            }
          }
        } catch (err) {
          console.warn('[MarketModal] Failed to fetch market condition:', err);
        }
      };
      fetchMarketCondition();
    }
  }, [market.id, market.conditionId, marketCondition]);

  // Fetch market outcome token balances (YES/NO) when market or user changes
  useEffect(() => {
    if (isConnected && address && market?.id && multisigAddress) {
      const fetchOutcomeBalances = async () => {
        try {
          setOutcomeBalancesLoading(true);
          // Use multisig address if available, otherwise use connected address
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
              console.log('[MarketModal] Fetched outcome balances for multisig wallet:', walletToCheck, data);
            }
          }
        } catch (err) {
          console.warn('[MarketModal] Failed to fetch outcome balances:', err);
        } finally {
          setOutcomeBalancesLoading(false);
        }
      };
      fetchOutcomeBalances();
    }
  }, [isConnected, address, market.id, multisigAddress]);

  // Calculate shares/USDC based on amount for market order
  useEffect(() => {
    if (orderType === 'market' && amount) {
      const price = getCurrentPrice();
      if (tradeSide === 'buy') {
        // When buying: amount is USDC, calculate shares
        const calculatedShares = (parseFloat(amount) / price).toFixed(2);
        setShares(calculatedShares);
      } else {
        // When selling: amount is shares, keep it as shares
        // Don't overwrite shares with USDC value
        setShares(amount);
      }
    }
  }, [amount, selectedOutcome, orderType, tradeSide]);

  // Calculate amount based on shares and price for limit order
  useEffect(() => {
    if (orderType === 'limit' && shares && limitPrice) {
      const calculatedAmount = (parseFloat(shares) * parseFloat(limitPrice)).toFixed(2);
      setAmount(calculatedAmount);
    }
  }, [shares, limitPrice, orderType]);

  if (!isOpen) return null;

  const handleTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrderError(null);
    setOrderSuccess(null);

    if (!isConnected || !address) {
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
    if (balance && parseFloat(amount) > parseFloat(balance.collateralBalanceFormatted)) {
      setOrderError(`Insufficient balance. Available: ${balance.collateralBalanceFormatted} USDC`);
      return;
    }

    setIsSubmitting(true);

    try {
      // Determine price and order details
      const orderPrice = orderType === 'market' ? getCurrentPrice() : parseFloat(limitPrice);
      const orderAmount = parseFloat(shares);
      
      // Side: 0 = BUY, 1 = SELL
      const side: 0 | 1 = tradeSide === 'buy' ? 0 : 1;

      // If selling, ensure user has enough YES/NO tokens available
      if (tradeSide === 'sell') {
        const availableStr = selectedOutcome.toLowerCase() === 'yes'
          ? marketOutcomeBalances?.yesBalanceFormatted
          : marketOutcomeBalances?.noBalanceFormatted;
        const available = parseFloat(availableStr || '0');
        if (orderAmount > available) {
          setOrderError(
            `Insufficient ${selectedOutcome.toUpperCase()} tokens. Available: ${available.toFixed(6)}`
          );
          return;
        }
      }
      
      // Check for Web3 provider
      const provider = (window as any).ethereum;
      if (!provider) {
        throw new Error('Web3 wallet provider not found. Please install MetaMask or another Web3 wallet.');
      }

      setOrderError('Waiting for signature approval...');

      // Create and sign order using EIP712
      // Must have market condition with actual tokenIds from event listener
      if (!marketCondition) {
        throw new Error('Market condition not available. Unable to determine tokenId for order.');
      }

      const finalTokenId = selectedOutcome.toLowerCase() === 'yes' 
        ? marketCondition.yesTokenId 
        : marketCondition.noTokenId;
      
      console.log('[MarketModal] Using market condition tokenId:', finalTokenId);

      // Use connected address as multisig maker address
      // The signer will be the metamask wallet signing the order
      const makerAddress = multisigAddress || address;
      
      const { message, signature } = await createAndSignOrder(
        provider,
        side,
        orderAmount,
        orderPrice,
        finalTokenId,
        makerAddress
      );

      setOrderError(null); // Clear the waiting message

      // Submit signed order to backend
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

      // Show success message
      const matchInfo = data.matches > 0 
        ? ` (${data.matches} match${data.matches > 1 ? 'es' : ''} found!)` 
        : ' (added to order book)';
      
      setOrderSuccess(
        `${orderType === 'market' ? 'Market' : 'Limit'} order placed successfully${matchInfo}\n` +
        `${orderAmount.toFixed(2)} ${selectedOutcome.toUpperCase()} shares @ $${orderPrice.toFixed(2)}`
      );

      // Reset form after short delay
      setTimeout(() => {
        resetInputs();
        setOrderSuccess(null);
      }, 3000);

    } catch (error: any) {
      console.error('[MarketModal] Order submission error:', error);
      
      // Handle specific wallet errors
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

  const resetInputs = () => {
    setAmount('');
    setShares('');
    setLimitPrice('');
  };

  const handleOutcomeChange = (outcome: string) => {
    setSelectedOutcome(outcome);
    resetInputs();
  };

  const handleOrderTypeChange = (type: OrderType) => {
    setOrderType(type);
    resetInputs();
  };

  const handleTradeSideChange = (side: TradeSide) => {
    setTradeSide(side);
    resetInputs();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4 sm:p-0">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-lg shadow-xl">
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              ✕
            </button>

            <div className="p-6 sm:p-8">
              {/* Header */}
              <div className="flex gap-6 mb-8">
                {market.image && (
                  <div className="text-6xl flex-shrink-0">
                    {market.image}
                  </div>
                )}
                <div className="flex-1">
                  <div className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">
                    {market.category}
                  </div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                    {market.title}
                  </h1>
                  <div className="flex gap-8">
                    <div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Resolution Date
                      </div>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {market.resolutionDate}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Volume
                      </div>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {market.volume}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main content */}
                <div className="lg:col-span-2">
                  {/* Probability display */}
                  <div className="mb-8 p-6 bg-gray-50 dark:bg-slate-800 rounded-lg">
                    <div className="text-center mb-4">
                      <div className="text-5xl font-bold text-gray-900 dark:text-white">
                        {market.yesPrice}%
                      </div>
                      <div className="text-gray-600 dark:text-gray-400">
                        Chance of YES
                      </div>
                    </div>

                    {/* Probability bars */}
                    <div className="space-y-4">
                      {market.outcomes.map((outcome) => (
                        <div key={outcome.name}>
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium text-gray-900 dark:text-white capitalize">
                              {outcome.name}
                            </span>
                            <span className="text-lg font-semibold text-gray-900 dark:text-white">
                              {outcome.probability}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                outcome.name === 'yes'
                                  ? 'bg-green-500'
                                  : 'bg-red-500'
                              }`}
                              style={{ width: `${outcome.probability}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* About section */}
                  <div className="mb-8">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                      About this market
                    </h2>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      {market.about}
                    </p>
                  </div>

                  {/* Description */}
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                      Market Details
                    </h2>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      {market.description}
                    </p>
                  </div>

                  {/* Your Orders */}
                  <div className="mt-8">
                    <MyMarketOrders marketId={market.id} userAddress={address || undefined} />
                  </div>

                  {/* Order Book */}
                  <div className="mt-8">
                    <OrderBook marketId={market.id} outcome={selectedOutcome.toUpperCase() as 'YES' | 'NO'} />
                  </div>
                </div>

                {/* Trading panel */}
                <div className="lg:col-span-1">
                  <div className="sticky top-6 p-6 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        Trade
                      </h3>
                      {isConnected && balance && (
                        <div className="text-right">
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            USDC Balance
                          </div>
                          <div className="text-sm font-bold text-green-600 dark:text-green-400">
                            {balanceLoading ? '...' : `${balance.collateralBalanceFormatted} USDC`}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Market Outcome Token Balances */}
                    {isConnected && marketOutcomeBalances && (
                      <div className="mb-6 p-4 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
                        <div className="flex justify-between items-start mb-3">
                          <div className="text-xs text-gray-500 dark:text-gray-400 font-semibold">
                            Your Market Position
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
                            {multisigAddress ? 'Multisig Wallet' : 'Connected Wallet'}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <div className="text-xs text-gray-600 dark:text-gray-300">YES Tokens</div>
                            <div className="text-sm font-bold text-green-600 dark:text-green-400">
                              {outcomeBalancesLoading ? '...' : formatTokenBalance(marketOutcomeBalances.yesBalanceFormatted)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-600 dark:text-gray-300">NO Tokens</div>
                            <div className="text-sm font-bold text-red-600 dark:text-red-400">
                              {outcomeBalancesLoading ? '...' : formatTokenBalance(marketOutcomeBalances.noBalanceFormatted)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Buy/Sell Toggle */}
                    <div className="mb-6">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleTradeSideChange('buy')}
                          className={`py-3 px-3 rounded-lg border-2 transition-colors font-bold text-sm ${
                            tradeSide === 'buy'
                              ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                              : 'border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white hover:border-gray-300 dark:hover:border-slate-500'
                          }`}
                        >
                          Buy
                        </button>
                        <button
                          onClick={() => handleTradeSideChange('sell')}
                          className={`py-3 px-3 rounded-lg border-2 transition-colors font-bold text-sm ${
                            tradeSide === 'sell'
                              ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                              : 'border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white hover:border-gray-300 dark:hover:border-slate-500'
                          }`}
                        >
                          Sell
                        </button>
                      </div>
                    </div>

                    {/* Order Type Toggle (Market/Limit) */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Order Type
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleOrderTypeChange('market')}
                          className={`py-2 px-3 rounded-lg border-2 transition-colors font-medium text-sm ${
                            orderType === 'market'
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                              : 'border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white hover:border-gray-300 dark:hover:border-slate-500'
                          }`}
                        >
                          Market
                        </button>
                        <button
                          onClick={() => handleOrderTypeChange('limit')}
                          className={`py-2 px-3 rounded-lg border-2 transition-colors font-medium text-sm ${
                            orderType === 'limit'
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                              : 'border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white hover:border-gray-300 dark:hover:border-slate-500'
                          }`}
                        >
                          Limit
                        </button>
                      </div>
                    </div>

                    {/* Outcome selection */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Select Outcome
                      </label>
                      <div className="space-y-2">
                        {market.outcomes.map((outcome) => (
                          <button
                            key={outcome.name}
                            onClick={() => handleOutcomeChange(outcome.name)}
                            className={`w-full p-3 rounded-lg border-2 transition-colors font-medium capitalize ${
                              selectedOutcome === outcome.name
                                ? outcome.name === 'yes'
                                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                                  : 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                                : 'border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white hover:border-gray-300 dark:hover:border-slate-500'
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <span>{outcome.name}</span>
                              <span className="text-sm">
                                ${(outcome.probability / 100).toFixed(2)}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Market Order Inputs */}
                    {orderType === 'market' && (
                      <>
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none no-spinner"
                          />
                        </div>

                        <div className="mb-6">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {tradeSide === 'buy' ? 'You\'ll Receive (Shares)' : 'You\'ll Receive (USDC)'}
                          </label>
                          <input
                            type="text"
                            value={tradeSide === 'buy' ? shares : (parseFloat(amount || '0') * getCurrentPrice()).toFixed(2)}
                            readOnly
                            placeholder="0.00"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Market price: ${getCurrentPrice().toFixed(2)} per share
                          </p>
                        </div>
                      </>
                    )}

                    {/* Limit Order Inputs */}
                    {orderType === 'limit' && (
                      <>
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none no-spinner"
                          />
                        </div>

                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none no-spinner"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Current market: ${getCurrentPrice().toFixed(2)} | Range: $0.01 - $0.99
                          </p>
                        </div>

                        <div className="mb-6">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {tradeSide === 'buy' ? 'Total Cost (USDC)' : 'You\'ll Receive (USDC)'}
                          </label>
                          <input
                            type="text"
                            value={amount}
                            readOnly
                            placeholder="0.00"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                          />
                        </div>
                      </>
                    )}

                    {/* Price info */}
                    {amount && parseFloat(amount) > 0 && (
                      <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-gray-700 dark:text-gray-300">
                        {tradeSide === 'buy' ? (
                          <>
                            <div className="flex justify-between mb-1">
                              <span>Amount:</span>
                              <span className="font-semibold">
                                ${parseFloat(amount).toFixed(2)} USDC
                              </span>
                            </div>
                            <div className="flex justify-between mb-1">
                              <span>Shares:</span>
                              <span className="font-semibold">
                                {shares}
                              </span>
                            </div>
                            {orderType === 'market' && (
                              <div className="flex justify-between">
                                <span>Avg. Price:</span>
                                <span className="font-semibold">
                                  ${getCurrentPrice().toFixed(2)}
                                </span>
                              </div>
                            )}
                            {orderType === 'limit' && limitPrice && (
                              <div className="flex justify-between">
                                <span>Limit Price:</span>
                                <span className="font-semibold">
                                  ${parseFloat(limitPrice).toFixed(2)}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between mt-2 pt-2 border-t border-blue-200 dark:border-blue-800">
                              <span>Total Cost:</span>
                              <span className="font-semibold text-green-600 dark:text-green-400">
                                ${parseFloat(amount).toFixed(2)} USDC
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex justify-between mb-1">
                              <span>Shares to Sell:</span>
                              <span className="font-semibold">
                                {amount}
                              </span>
                            </div>
                            <div className="flex justify-between mb-1">
                              <span>USDC Received:</span>
                              <span className="font-semibold">
                                ${(parseFloat(amount) * getCurrentPrice()).toFixed(2)}
                              </span>
                            </div>
                            {orderType === 'market' && (
                              <div className="flex justify-between">
                                <span>Avg. Price:</span>
                                <span className="font-semibold">
                                  ${getCurrentPrice().toFixed(2)}
                                </span>
                              </div>
                            )}
                            {orderType === 'limit' && limitPrice && (
                              <div className="flex justify-between">
                                <span>Limit Price:</span>
                                <span className="font-semibold">
                                  ${parseFloat(limitPrice).toFixed(2)}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between mt-2 pt-2 border-t border-blue-200 dark:border-blue-800">
                              <span>Total Proceeds:</span>
                              <span className="font-semibold text-green-600 dark:text-green-400">
                                ${parseFloat(shares).toFixed(2)} USDC
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Error/Success Messages */}
                    {orderError && (
                      <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
                        {orderError}
                      </div>
                    )}
                    {orderSuccess && (
                      <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-400 whitespace-pre-line">
                        {orderSuccess}
                      </div>
                    )}

                    {/* Trade button */}
                    <form onSubmit={handleTrade}>
                      <button
                        type="submit"
                        disabled={!isConnected || !amount || parseFloat(amount) <= 0 || isSubmitting}
                        className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                          isConnected && amount && parseFloat(amount) > 0 && !isSubmitting
                            ? selectedOutcome === 'yes'
                              ? tradeSide === 'buy'
                                ? 'bg-green-600 text-white hover:bg-green-700'
                                : 'bg-red-600 text-white hover:bg-red-700'
                              : tradeSide === 'buy'
                              ? 'bg-red-600 text-white hover:bg-red-700'
                              : 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-gray-400 text-white cursor-not-allowed'
                        }`}
                      >
                        {isSubmitting
                          ? 'Submitting...'
                          : !isConnected
                          ? 'Connect Wallet to Trade'
                          : `${tradeSide === 'buy' ? 'Buy' : 'Sell'} ${selectedOutcome.toUpperCase()}`}
                      </button>
                    </form>

                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
                      No fees on this market
                    </p>
                  </div>
                </div>
              </div>
            </div>
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
    </>
  );
}

 
