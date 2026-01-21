/**
 * Wallet Balance Components for Polymarket Frontend
 * Ready-to-use React components for displaying and validating user collateral balance
 */

import React, { useState, useEffect } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface UserBalance {
  userAddress: string;
  walletAddress: string;
  collateralBalance: string;
  collateralBalanceFormatted: string;
  availableForOrders: string;
  lockedInOrders: string;
  lastUpdated: number;
}

export interface BalanceCheckResponse {
  success: boolean;
  hasSufficientBalance: boolean;
  availableBalance: string;
  requiredAmount: string;
  message: string;
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook to fetch and manage user balance
 * Automatically refreshes every 30 seconds
 */
export function useUserBalance(userAddress?: string) {
  const [balance, setBalance] = useState<UserBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchBalance = React.useCallback(async () => {
    if (!userAddress) return;

    setLoading(true);
    try {
      console.log('[WalletBalance] Fetching balance for:', userAddress);
      const response = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL +`/api/wallet/balance/${userAddress}`);
      console.log('[WalletBalance] Response status:', response.status);
      const data = await response.json();
      console.log('[WalletBalance] Response data:', data);

      if (data.success) {
        setBalance(data.balance);
        setError(null);
        setLastRefresh(new Date());
        console.log('[WalletBalance] Balance set:', data.balance.collateralBalanceFormatted);
      } else {
        setError(data.error || 'Failed to fetch balance');
        console.error('[WalletBalance] Error in response:', data.error);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Network error';
      setError(errorMsg);
      console.error('[WalletBalance] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [userAddress]);

  // Initial fetch
  useEffect(() => {
    fetchBalance();
  }, [userAddress, fetchBalance]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!userAddress) return;
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [userAddress, fetchBalance]);

  return {
    balance,
    loading,
    error,
    lastRefresh,
    refetch: fetchBalance
  };
}

/**
 * Hook to check if user has sufficient balance for an order
 */
export function useBalanceCheck(userAddress?: string) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<BalanceCheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkBalance = React.useCallback(async (requiredAmount: string) => {
    if (!userAddress) {
      setError('User address not provided');
      return false;
    }

    setChecking(true);
    setError(null);

    try {
      const response = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL + '/api/wallet/check-sufficient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress,
          requiredAmount
        })
      });

      const data = await response.json();
      setResult(data);
      return data.hasSufficientBalance;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Network error';
      setError(errorMsg);
      return false;
    } finally {
      setChecking(false);
    }
  }, [userAddress]);

  return { checkBalance, checking, result, error };
}

/**
 * Hook to manage wallet address mapping
 */
export function useWalletMapping() {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateMapping = React.useCallback(async (
    userAddress: string,
    walletAddress: string
  ) => {
    setUpdating(true);
    setError(null);

    try {
      const response = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL + '/api/wallet/update-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress, walletAddress })
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Failed to update mapping');
        return false;
      }

      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Network error';
      setError(errorMsg);
      return false;
    } finally {
      setUpdating(false);
    }
  }, []);

  return { updateMapping, updating, error };
}

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * WalletBalanceDisplay Component
 * Shows user's collateral balance with real-time updates
 */
export function WalletBalanceDisplay({ userAddress }: { userAddress?: string }) {
  const { balance, loading, error, lastRefresh, refetch } = useUserBalance(userAddress);

  if (!userAddress) {
    return <p style={{ color: '#999' }}>No user address provided</p>;
  }

  if (loading && !balance) {
    return <p>Loading balance...</p>;
  }

  if (error) {
    return (
      <div style={{ color: 'red', padding: '8px', backgroundColor: '#f8d7da', borderRadius: '4px' }}>
        <p>Error: {error}</p>
        <button onClick={() => refetch()} style={{ marginTop: '8px' }}>
          Retry
        </button>
      </div>
    );
  }

  if (!balance) {
    return (
      <div style={{ padding: '8px', backgroundColor: '#e2e3e5', borderRadius: '4px' }}>
        <p>No balance data available</p>
      </div>
    );
  }

  return (
    <div style={{
      padding: '16px',
      border: '1px solid #dee2e6',
      borderRadius: '8px',
      backgroundColor: '#f8f9fa'
    }}>
      <h3 style={{ margin: '0 0 12px 0' }}>💰 Wallet Balance</h3>

      <div style={{ display: 'grid', gap: '12px' }}>
        <div>
          <p style={{ margin: '0 0 4px 0', fontSize: '0.9em', color: '#666' }}>Total Balance</p>
          <p style={{ margin: 0, fontSize: '1.4em', fontWeight: 'bold' }}>
            {balance.collateralBalanceFormatted} USDC
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <p style={{ margin: '0 0 4px 0', fontSize: '0.9em', color: '#666' }}>Available</p>
            <p style={{ margin: 0, fontSize: '1.2em', color: '#28a745', fontWeight: 'bold' }}>
              {balance.availableForOrders}
            </p>
          </div>

          <div>
            <p style={{ margin: '0 0 4px 0', fontSize: '0.9em', color: '#666' }}>Locked</p>
            <p style={{ margin: 0, fontSize: '1.2em', color: '#ffc107', fontWeight: 'bold' }}>
              {balance.lockedInOrders}
            </p>
          </div>
        </div>

        <div style={{ paddingTop: '8px', borderTop: '1px solid #dee2e6' }}>
          <p style={{ margin: 0, fontSize: '0.85em', color: '#999' }}>
            Last updated: {lastRefresh?.toLocaleTimeString()}
          </p>
          <button
            onClick={() => refetch()}
            disabled={loading}
            style={{
              marginTop: '8px',
              padding: '6px 12px',
              fontSize: '0.85em',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1
            }}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * OrderForm Component
 * Form to place orders with built-in balance validation
 */
export function OrderForm({ userAddress }: { userAddress?: string }) {
  const [orderSize, setOrderSize] = useState('0.1');
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [priceYes, setPriceYes] = useState('0.5');
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const { balance } = useUserBalance(userAddress);
  const { checkBalance, checking } = useBalanceCheck(userAddress);

  if (!userAddress) {
    return <p style={{ color: '#999' }}>No user address provided</p>;
  }

  async function handleSubmitOrder() {
    setLoading(true);
    setStatus(null);

    try {
      const requiredAmount = parseFloat(orderSize);

      // Validate input
      if (isNaN(requiredAmount) || requiredAmount <= 0) {
        setStatus({ type: 'error', message: 'Invalid order size' });
        setLoading(false);
        return;
      }

      // Check balance
      setStatus({ type: 'info', message: '🔍 Checking balance...' });
      const hasSufficientBalance = await checkBalance(requiredAmount.toString());

      if (!hasSufficientBalance) {
        setStatus({
          type: 'error',
          message: `❌ Insufficient balance. Available: ${balance?.collateralBalanceFormatted || '0'} USDC`
        });
        setLoading(false);
        return;
      }

      // Place order
      setStatus({ type: 'info', message: '📤 Placing order...' });

      const response = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL +'/api/orders/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress,
          orderSize: requiredAmount,
          orderType,
          priceYes: parseFloat(priceYes),
          priceNo: 1 - parseFloat(priceYes)
        })
      });

      const data = await response.json();

      if (data.success) {
        setStatus({
          type: 'success',
          message: `✅ Order placed! ID: ${data.orderId}`
        });
        // Reset form
        setOrderSize('0.1');
        setOrderType('buy');
        setPriceYes('0.5');
      } else {
        setStatus({
          type: 'error',
          message: `❌ ${data.error || 'Failed to place order'}`
        });
      }
    } catch (error) {
      setStatus({
        type: 'error',
        message: `❌ ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setLoading(false);
    }
  }

  const statusColors = {
    success: { bg: '#d4edda', color: '#155724' },
    error: { bg: '#f8d7da', color: '#721c24' },
    info: { bg: '#cce5ff', color: '#004085' }
  };

  return (
    <div style={{
      padding: '16px',
      border: '1px solid #dee2e6',
      borderRadius: '8px',
      backgroundColor: '#f8f9fa'
    }}>
      <h3 style={{ margin: '0 0 12px 0' }}>📊 Place Order</h3>

      <div style={{ display: 'grid', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
            Order Size (USDC)
          </label>
          <input
            type="number"
            value={orderSize}
            onChange={(e) => setOrderSize(e.target.value)}
            step="0.01"
            min="0"
            disabled={loading}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '1em'
            }}
          />
          {balance && (
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85em', color: '#666' }}>
              Available: {balance.availableForOrders} USDC
            </p>
          )}
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
            Order Type
          </label>
          <select
            value={orderType}
            onChange={(e) => setOrderType(e.target.value as 'buy' | 'sell')}
            disabled={loading}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '1em'
            }}
          >
            <option value="buy">Buy YES</option>
            <option value="sell">Sell YES</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
            Price (YES Token)
          </label>
          <input
            type="number"
            value={priceYes}
            onChange={(e) => setPriceYes(e.target.value)}
            step="0.01"
            min="0"
            max="1"
            disabled={loading}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '1em'
            }}
          />
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85em', color: '#666' }}>
            Price (NO Token): ${(1 - parseFloat(priceYes || '0')).toFixed(2)}
          </p>
        </div>

        <button
          onClick={handleSubmitOrder}
          disabled={loading || checking}
          style={{
            padding: '12px',
            fontSize: '1em',
            fontWeight: 'bold',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading || checking ? 'not-allowed' : 'pointer',
            opacity: loading || checking ? 0.6 : 1
          }}
        >
          {loading ? 'Processing...' : checking ? 'Checking Balance...' : 'Place Order'}
        </button>

        {status && (
          <div style={{
            padding: '12px',
            backgroundColor: statusColors[status.type].bg,
            color: statusColors[status.type].color,
            borderRadius: '4px',
            fontSize: '0.95em'
          }}>
            {status.message}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * WalletSetupForm Component
 * Form to link user address to multisig wallet
 */
export function WalletSetupForm() {
  const [userAddress, setUserAddress] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const { updateMapping, updating } = useWalletMapping();

  async function handleSetupWallet() {
    setLoading(true);
    setStatus(null);

    if (!userAddress || !walletAddress) {
      setStatus({ type: 'error', message: 'Please provide both addresses' });
      setLoading(false);
      return;
    }

    const success = await updateMapping(userAddress, walletAddress);
    setLoading(false);

    if (success) {
      setStatus({ type: 'success', message: '✅ Wallet mapping updated successfully' });
      setUserAddress('');
      setWalletAddress('');
    } else {
      setStatus({ type: 'error', message: '❌ Failed to update wallet mapping' });
    }
  }

  return (
    <div style={{
      padding: '16px',
      border: '1px solid #dee2e6',
      borderRadius: '8px',
      backgroundColor: '#f8f9fa'
    }}>
      <h3 style={{ margin: '0 0 12px 0' }}>🔗 Link Wallet to Account</h3>

      <div style={{ display: 'grid', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
            Your Address (EOA)
          </label>
          <input
            type="text"
            value={userAddress}
            onChange={(e) => setUserAddress(e.target.value)}
            placeholder="0x..."
            disabled={loading}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '0.9em',
              fontFamily: 'monospace'
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
            Multisig Wallet Address
          </label>
          <input
            type="text"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            placeholder="0x..."
            disabled={loading}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '0.9em',
              fontFamily: 'monospace'
            }}
          />
        </div>

        <button
          onClick={handleSetupWallet}
          disabled={loading || updating}
          style={{
            padding: '12px',
            fontSize: '1em',
            fontWeight: 'bold',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading || updating ? 'not-allowed' : 'pointer',
            opacity: loading || updating ? 0.6 : 1
          }}
        >
          {loading ? 'Linking...' : 'Link Wallet'}
        </button>

        {status && (
          <div style={{
            padding: '12px',
            backgroundColor: status.type === 'success' ? '#d4edda' : '#f8d7da',
            color: status.type === 'success' ? '#155724' : '#721c24',
            borderRadius: '4px'
          }}>
            {status.message}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// DASHBOARD
// ============================================================================

/**
 * Complete Wallet Dashboard Component
 * Shows balance, allows order placement, and wallet setup
 */
export function WalletDashboard({ userAddress }: { userAddress?: string }) {
  return (
    <div style={{
      padding: '20px',
      maxWidth: '600px',
      margin: '0 auto'
    }}>
      <h1>🏪 Trading Dashboard</h1>

      {!userAddress ? (
        <div style={{
          padding: '16px',
          backgroundColor: '#fff3cd',
          borderRadius: '8px',
          color: '#856404'
        }}>
          <p>No user address provided. Please connect your wallet.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '20px' }}>
          <WalletBalanceDisplay userAddress={userAddress} />
          <OrderForm userAddress={userAddress} />
          <WalletSetupForm />
        </div>
      )}
    </div>
  );
}

export default WalletDashboard;
