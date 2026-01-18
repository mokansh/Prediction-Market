'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { ethers } from 'ethers';

const AMOY_CHAIN_ID_HEX = '0x13882'; // 80002 decimal
const AMOY_CHAIN_PARAMS = {
  chainId: AMOY_CHAIN_ID_HEX,
  chainName: 'Polygon Amoy Testnet',
  nativeCurrency: {
    name: 'MATIC',
    symbol: 'MATIC',
    decimals: 18,
  },
  rpcUrls: ['https://rpc-amoy.polygon.technology/'],
  blockExplorerUrls: ['https://www.oklink.com/amoy'],
};

interface WalletContextType {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  balance: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  isCorrectNetwork: boolean;
  switchToAmoy: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState<boolean>(false);

  // Check if MetaMask wallet is already connected on mount
  useEffect(() => {
    const checkWalletConnection = async () => {
      if (typeof window !== 'undefined' && window.ethereum && (window.ethereum as any).isMetaMask) {
        try {
          // First check the network
          const chainId = await window.ethereum.request({ method: 'eth_chainId' });
          const isOnAmoy = chainId === AMOY_CHAIN_ID_HEX;
          
          if (isOnAmoy) {
            setIsCorrectNetwork(true);
          } else {
            setIsCorrectNetwork(false);
            setError('Wrong network. Please switch to Polygon Amoy testnet.');
          }

          // Then check for existing accounts
          const accounts = await window.ethereum.request({
            method: 'eth_accounts',
          });
          
          if (accounts.length > 0) {
            if (isOnAmoy) {
              setAddress(accounts[0]);
              setIsConnected(true);
              await fetchBalance(accounts[0]);
            } else {
              setAddress(null);
              setIsConnected(false);
              setBalance(null);
            }
          }
        } catch (err) {
          console.error('Error checking wallet connection:', err);
        }
      }
    };

    checkWalletConnection();
  }, []);

  // Listen for account changes
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum && (window.ethereum as any).isMetaMask) {
      const handleAccountsChanged = async (accounts: string[]) => {
        if (accounts.length > 0) {
          const onAmoy = await ensureAmoyNetwork();
          if (onAmoy) {
            setAddress(accounts[0]);
            setIsConnected(true);
            fetchBalance(accounts[0]);
          } else {
            setAddress(null);
            setIsConnected(false);
            setBalance(null);
          }
        } else {
          setAddress(null);
          setIsConnected(false);
          setBalance(null);
        }
      };

      const handleChainChanged = async () => {
        try {
          if (!window.ethereum) return;
          const chainId = await window.ethereum.request({ method: 'eth_chainId' });
          if (chainId === AMOY_CHAIN_ID_HEX) {
            setIsCorrectNetwork(true);
            setError(null);
            if (address) {
              fetchBalance(address);
            }
          } else {
            setIsCorrectNetwork(false);
            setError('Wrong network. Please switch to Polygon Amoy testnet.');
          }
        } catch (err) {
          console.error('Error checking chain:', err);
        }
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum?.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, []);

  const fetchBalance = async (addr: string) => {
    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const balanceWei = await provider.getBalance(addr);
        const balanceEth = ethers.formatEther(balanceWei);
        setBalance(parseFloat(balanceEth).toFixed(4));
      }
    } catch (err) {
      console.error('Error fetching balance:', err);
    }
  };

  const ensureAmoyNetwork = async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !window.ethereum || !(window.ethereum as any).isMetaMask) {
      setError('MetaMask is not installed. Please install MetaMask to connect.');
      return false;
    }

    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (chainId === AMOY_CHAIN_ID_HEX) {
        setIsCorrectNetwork(true);
        return true;
      }

      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: AMOY_CHAIN_ID_HEX }],
        });
        setIsCorrectNetwork(true);
        return true;
      } catch (switchError: any) {
        // If chain is not added, add it then retry
        if (switchError.code === 4902) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [AMOY_CHAIN_PARAMS],
            });
            setIsCorrectNetwork(true);
            return true;
          } catch (addError: any) {
            setError(addError.message || 'Failed to add Polygon Amoy testnet');
            return false;
          }
        }

        setError('Please switch to Polygon Amoy testnet in MetaMask.');
        setIsCorrectNetwork(false);
        return false;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify network');
      setIsCorrectNetwork(false);
      return false;
    }
  };

  const connectWallet = async () => {
    if (typeof window === 'undefined' || !window.ethereum || !(window.ethereum as any).isMetaMask) {
      setError('MetaMask is not installed. Please install MetaMask to connect.');
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);

      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (accounts.length > 0) {
        const onAmoy = await ensureAmoyNetwork();
        if (!onAmoy) {
          setIsConnected(false);
          return;
        }

        setAddress(accounts[0]);
        setIsConnected(true);
        await fetchBalance(accounts[0]);
      }
    } catch (err: any) {
      if (err.code === 4001) {
        setError('Connection rejected by user');
      } else {
        setError(err.message || 'Failed to connect wallet');
      }
      console.error('Error connecting wallet:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setAddress(null);
    setIsConnected(false);
    setBalance(null);
    setError(null);
    setIsCorrectNetwork(false);
  };

  const switchToAmoy = async () => {
    const success = await ensureAmoyNetwork();
    if (success && address) {
      setIsConnected(true);
      await fetchBalance(address);
    }
  };

  return (
    <WalletContext.Provider
      value={{
        address,
        isConnected,
        isConnecting,
        error,
        balance,
        connectWallet,
        disconnectWallet,
        isCorrectNetwork,
        switchToAmoy,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
