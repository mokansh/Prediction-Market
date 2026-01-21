'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/context/WalletContext';
import { ethers } from 'ethers';
import axios from 'axios';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SAFE_PROXY_FACTORY_ADDRESS = process.env.NEXT_PUBLIC_SAFE_PROXY_FACTORY_ADDRESS || '0x0000000000000000000000000000000000000000';
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://adorable-dream-production-8c58.up.railway.app';

// Contract addresses
const COLLATERAL_TOKEN = process.env.NEXT_PUBLIC_COLLATERAL_TOKEN || '0x7006b5a13d347dab68b9c2caabee2e6bc11296fd';
const CTF_CONTRACT = process.env.NEXT_PUBLIC_CTF_CONTRACT || '0x53dBaF3856166A512dA9A53c470A820b8cD7195c';
const CTF_EXCHANGE = process.env.NEXT_PUBLIC_CTF_EXCHANGE || '0x605921c2eC6E761945bEEA78D46b81f045dc0399';
const NEG_RISK_EXCHANGE = process.env.NEXT_PUBLIC_NEG_RISK_EXCHANGE || '0x53BBB0b44dd4216AD0e30bc7508F40f66CA7B503';
const NEG_RISK_ADAPTER = process.env.NEXT_PUBLIC_NEG_RISK_ADAPTER || '0x19DBBC593c2058A9536b8c46e08cb0aa6180c903';
const MULTI_SEND = process.env.NEXT_PUBLIC_MULTI_SEND || '0x38869bf66a61cF6bDB3095b56e0eb756eCec3d35';

// Log configuration for debugging
if (typeof window !== 'undefined') {
  console.log('[DepositModal] Backend URL:', BACKEND_URL);
  console.log('[DepositModal] Safe Proxy Factory:', SAFE_PROXY_FACTORY_ADDRESS);
  console.log('[DepositModal] Contract Addresses:', {
    COLLATERAL_TOKEN,
    CTF_CONTRACT,
    CTF_EXCHANGE,
    NEG_RISK_EXCHANGE,
    NEG_RISK_ADAPTER,
    MULTI_SEND,
  });
}

// EIP-712 domain and type definitions matching the SafeProxyFactory contract
const EIP712_DOMAIN = {
  name: 'Polymarket Contract Proxy Factory',
  chainId: 80002, // Amoy testnet
  verifyingContract: SAFE_PROXY_FACTORY_ADDRESS,
};

const CREATE_PROXY_TYPES = {
  CreateProxy: [
    { name: 'paymentToken', type: 'address' },
    { name: 'payment', type: 'uint256' },
    { name: 'paymentReceiver', type: 'address' },
  ],
};

// SafeTx EIP712 types for token approval
const SAFE_TX_TYPES = {
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

export function DepositModal({ isOpen, onClose }: DepositModalProps) {
  const { address, isConnected } = useWallet();
  const [isWalletDeployed, setIsWalletDeployed] = useState<boolean | null>(null);
  const [isCheckingDeployment, setIsCheckingDeployment] = useState(false);
  const [isEnablingTrading, setIsEnablingTrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proxyAddress, setProxyAddress] = useState<string | null>(null);
  const [approvalsCompleted, setApprovalsCompleted] = useState<Set<string>>(new Set());
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);
  const [currentApprovalStep, setCurrentApprovalStep] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [isDepositing, setIsDepositing] = useState(false);
  const [isCheckingApprovals, setIsCheckingApprovals] = useState(false);

  // Check if multisig wallet is deployed when modal opens
  useEffect(() => {
    if (isOpen && address && isConnected) {
      checkWalletDeployment();
    }
  }, [isOpen, address, isConnected]);

  // Check approval status when wallet is deployed
  useEffect(() => {
    if (isOpen && isWalletDeployed && proxyAddress && window.ethereum) {
      checkApprovalStatus();
    }
  }, [isOpen, isWalletDeployed, proxyAddress]);

  // Utility function to safely get checksummed address
  const getSafeAddress = (address: string): string => {
    try {
      // Convert to lowercase first to strip any bad checksum, then normalize
      return ethers.getAddress(address.toLowerCase());
    } catch {
      // Fallback: return lowercase if normalization fails
      return address.toLowerCase();
    }
  };

  // Utility function to encode ERC20 approve function
  const encodeApprove = (spender: string, amount: string): string => {
    const iface = new ethers.Interface(['function approve(address spender, uint256 amount)']);
    return iface.encodeFunctionData('approve', [getSafeAddress(spender), amount]);
  };

  // Utility function to encode setApprovalForAll function
  const encodeSetApprovalForAll = (operator: string, approved: boolean): string => {
    const iface = new ethers.Interface(['function setApprovalForAll(address operator, bool approved)']);
    return iface.encodeFunctionData('setApprovalForAll', [getSafeAddress(operator), approved]);
  };

  // Utility function to encode MultiSend transactions
  const encodeMultiSendTransactions = (): string => {
    const maxUint256 = ethers.MaxUint256.toString();
    
    // All transactions for multi-send - ensure all addresses are checksummed
    const transactions = [
      {
        to: getSafeAddress(COLLATERAL_TOKEN),
        data: encodeApprove(CTF_CONTRACT, maxUint256),
      },
      {
        to: getSafeAddress(COLLATERAL_TOKEN),
        data: encodeApprove(CTF_EXCHANGE, maxUint256),
      },
      {
        to: getSafeAddress(CTF_CONTRACT),
        data: encodeSetApprovalForAll(CTF_EXCHANGE, true),
      },
      {
        to: getSafeAddress(COLLATERAL_TOKEN),
        data: encodeApprove(NEG_RISK_EXCHANGE, maxUint256),
      },
      {
        to: getSafeAddress(COLLATERAL_TOKEN),
        data: encodeApprove(NEG_RISK_ADAPTER, maxUint256),
      },
      {
        to: getSafeAddress(CTF_CONTRACT),
        data: encodeSetApprovalForAll(NEG_RISK_EXCHANGE, true),
      },
      {
        to: getSafeAddress(CTF_CONTRACT),
        data: encodeSetApprovalForAll(NEG_RISK_ADAPTER, true),
      },
    ];

    // Encode transactions for MultiSend.multiSend
    let encoded = '';
    for (const tx of transactions) {
      // operation = 0 (CALL), value = 0
      encoded += '00'; // operation
      encoded += tx.to.slice(2).padStart(40, '0'); // to address
      encoded += '0000000000000000000000000000000000000000000000000000000000000000'; // value = 0
      
      const dataBytes = tx.data.slice(2);
      const dataLength = (dataBytes.length / 2).toString(16).padStart(64, '0');
      encoded += dataLength; // data length
      encoded += dataBytes; // data
    }

    const multiSendData = '0x' + encoded;
    
    // Now encode the multiSend function call itself
    // multiSend(bytes transactions) has signature 8d80ff0a
    const iface = new ethers.Interface(['function multiSend(bytes transactions)']);
    return iface.encodeFunctionData('multiSend', [multiSendData]);
  };

  // Utility function to get SafeTx domain for signature
  const getSafeTxDomain = (proxyAddr: string) => {
    return {
      chainId: 80002,
      verifyingContract: proxyAddr,
    };
  };

  const checkWalletDeployment = async () => {
    if (!address) return;

    setIsCheckingDeployment(true);
    setError(null);

    try {
      console.log('[DepositModal] Checking deployment for:', address);
      // Call backend to check if wallet is deployed
      const response = await axios.get(`${BACKEND_URL}/api/wallet/check-deployment/${address}`, {
        timeout: 10000, // 10 second timeout
      });
      console.log('[DepositModal] Deployment check response:', response.data);
      setIsWalletDeployed(response.data.isDeployed);
      if (response.data.proxyAddress) {
        setProxyAddress(response.data.proxyAddress);
      }
    } catch (err: any) {
      console.error('[DepositModal] Deployment check error:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Failed to check wallet deployment status';
      setError(errorMsg);
      setIsWalletDeployed(false);
    } finally {
      setIsCheckingDeployment(false);
    }
  };

  const checkApprovalStatus = async () => {
    if (!proxyAddress || !window.ethereum) return;

    setIsCheckingApprovals(true);
    try {
      console.log('[DepositModal] Checking approval status for:', proxyAddress);
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      
      // Check USDC approval for CTF Exchange
      const usdcContract = new ethers.Contract(
        COLLATERAL_TOKEN,
        ['function allowance(address owner, address spender) view returns (uint256)'],
        provider
      );

      const ctfContract = new ethers.Contract(
        CTF_CONTRACT,
        ['function isApprovedForAll(address account, address operator) view returns (bool)'],
        provider
      );

      // Check all necessary approvals
      const [
        usdcToCTFAllowance,
        usdcToCTFExchangeAllowance,
        ctfToExchangeApproval,
        usdcToNegRiskAllowance,
        usdcToAdapterAllowance,
        ctfToNegRiskApproval,
        ctfToAdapterApproval,
      ] = await Promise.all([
        usdcContract.allowance(proxyAddress, CTF_CONTRACT),
        usdcContract.allowance(proxyAddress, CTF_EXCHANGE),
        ctfContract.isApprovedForAll(proxyAddress, CTF_EXCHANGE),
        usdcContract.allowance(proxyAddress, NEG_RISK_EXCHANGE),
        usdcContract.allowance(proxyAddress, NEG_RISK_ADAPTER),
        ctfContract.isApprovedForAll(proxyAddress, NEG_RISK_EXCHANGE),
        ctfContract.isApprovedForAll(proxyAddress, NEG_RISK_ADAPTER),
      ]);

      console.log('[DepositModal] Approval status:', {
        usdcToCTF: usdcToCTFAllowance.toString(),
        usdcToCTFExchange: usdcToCTFExchangeAllowance.toString(),
        ctfToExchange: ctfToExchangeApproval,
        usdcToNegRisk: usdcToNegRiskAllowance.toString(),
        usdcToAdapter: usdcToAdapterAllowance.toString(),
        ctfToNegRisk: ctfToNegRiskApproval,
        ctfToAdapter: ctfToAdapterApproval,
      });

      // Check if all approvals are set (allowances > 0 and approvedForAll = true)
      const allApproved = 
        usdcToCTFAllowance > 0n &&
        usdcToCTFExchangeAllowance > 0n &&
        ctfToExchangeApproval &&
        usdcToNegRiskAllowance > 0n &&
        usdcToAdapterAllowance > 0n &&
        ctfToNegRiskApproval &&
        ctfToAdapterApproval;

      if (allApproved) {
        console.log('[DepositModal] All approvals already set');
        setApprovalsCompleted(new Set(['ctf', 'ctfExchange', 'negRisk']));
      } else {
        console.log('[DepositModal] Approvals not complete');
        setApprovalsCompleted(new Set());
      }
    } catch (err: any) {
      console.error('[DepositModal] Error checking approval status:', err);
      // Don't set error state here, just assume approvals not done
      setApprovalsCompleted(new Set());
    } finally {
      setIsCheckingApprovals(false);
    }
  };

  const handleEnableTrading = async () => {
    if (!address || !window.ethereum) return;

    setIsEnablingTrading(true);
    setError(null);

    try {
      console.log('[DepositModal] Starting Enable Trading for:', address);
      console.log('[DepositModal] Backend URL:', BACKEND_URL);
      
      // Prepare the message to sign (EIP-712)
      const message = {
        paymentToken: ethers.ZeroAddress, // No payment token (native token)
        payment: 0, // No payment
        paymentReceiver: ethers.ZeroAddress, // No payment receiver
      };

      console.log('[DepositModal] Message to sign:', message);
      console.log('[DepositModal] Domain:', EIP712_DOMAIN);

      // Request signature from user using EIP-712
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // Sign the typed data
      console.log('[DepositModal] Requesting signature from user...');
      const signature = await signer.signTypedData(
        EIP712_DOMAIN,
        CREATE_PROXY_TYPES,
        message
      );

      console.log('[DepositModal] Signature received:', signature);

      // Split signature into r, s, v components
      const sig = ethers.Signature.from(signature);
      console.log('[DepositModal] Signature components - r:', sig.r, 's:', sig.s, 'v:', sig.v);

      // Send signature to backend
      console.log('[DepositModal] Sending deploy request to:', `${BACKEND_URL}/api/wallet/deploy`);
      const response = await axios.post(`${BACKEND_URL}/api/wallet/deploy`, {
        userAddress: address,
        signature: {
          r: sig.r,
          s: sig.s,
          v: sig.v,
        },
        paymentToken: message.paymentToken,
        payment: message.payment,
        paymentReceiver: message.paymentReceiver,
      }, {
        timeout: 30000, // 30 second timeout for deployment
      });

      console.log('[DepositModal] Deploy response:', response.data);

      if (response.data.success) {
        setProxyAddress(response.data.proxyAddress);
        setIsWalletDeployed(true);
        alert(`Trading enabled! Your multisig wallet has been deployed at: ${response.data.proxyAddress}`);
      } else {
        setError(response.data.error || 'Failed to deploy wallet');
      }
    } catch (err: any) {
      console.error('[DepositModal] Enable trading error:', err);
      if (err.code === 'ACTION_REJECTED') {
        setError('Signature request was rejected');
      } else if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else if (err.message?.includes('Network Error') || err.code === 'ECONNABORTED') {
        setError('Backend server is not accessible. Make sure backend is running at: ' + BACKEND_URL);
      } else {
        setError(err.message || 'Failed to enable trading');
      }
    } finally {
      setIsEnablingTrading(false);
    }
  };

  const handleApproveTokens = async () => {
    if (!address || !proxyAddress || !window.ethereum) return;

    setIsProcessingApproval(true);
    setCurrentApprovalStep('Preparing transactions...');
    setError(null);

    try {
      console.log('[DepositModal] Starting token approval for:', proxyAddress);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // Get the nonce from the backend
      const nonceResponse = await axios.get(
        `${BACKEND_URL}/api/wallet/nonce/${proxyAddress}`,
        { timeout: 10000 }
      );
      const nonce = nonceResponse.data.nonce;
      console.log('[DepositModal] Current nonce:', nonce);

      // Encode the MultiSend transactions data
      setCurrentApprovalStep('Encoding transactions...');
      const multiSendData = encodeMultiSendTransactions();
      console.log('[DepositModal] MultiSend data encoded, length:', multiSendData.length);

      // Create SafeTx object - ensure all addresses are properly checksummed
      const safeTx = {
        to: getSafeAddress(MULTI_SEND),
        value: 0,
        data: multiSendData,
        operation: 1, // DelegateCall
        safeTxGas: 0,
        baseGas: 0,
        gasPrice: 0,
        gasToken: getSafeAddress(ethers.ZeroAddress),
        refundReceiver: getSafeAddress(ethers.ZeroAddress),
        nonce: nonce,
      };

      console.log('[DepositModal] SafeTx object created:', {
        to: safeTx.to,
        value: safeTx.value,
        operation: safeTx.operation,
        safeTxGas: safeTx.safeTxGas,
        baseGas: safeTx.baseGas,
        gasPrice: safeTx.gasPrice,
        gasToken: safeTx.gasToken,
        refundReceiver: safeTx.refundReceiver,
        nonce: safeTx.nonce,
        dataLength: multiSendData.length,
      });

      // Request signature for SafeTx
      setCurrentApprovalStep('Requesting signature...');
      const safeTxDomain = getSafeTxDomain(proxyAddress);
      console.log('[DepositModal] Signing SafeTx with domain:', safeTxDomain);

      const signature = await signer.signTypedData(
        safeTxDomain,
        SAFE_TX_TYPES,
        safeTx
      );

      console.log('[DepositModal] SafeTx signature received:', signature);

      // Split signature into r, s, v components
      const sig = ethers.Signature.from(signature);
      console.log('[DepositModal] Signature components - r:', sig.r, 's:', sig.s, 'v:', sig.v);

      // Send to backend for execution
      setCurrentApprovalStep('Executing approvals...');
      console.log('[DepositModal] Sending approval request to backend');

      const response = await axios.post(
        `${BACKEND_URL}/api/wallet/approve-tokens`,
        {
          proxyAddress,
          safeTx: {
            to: safeTx.to,
            value: safeTx.value,
            data: safeTx.data,
            operation: safeTx.operation,
            safeTxGas: safeTx.safeTxGas,
            baseGas: safeTx.baseGas,
            gasPrice: safeTx.gasPrice,
            gasToken: safeTx.gasToken,
            refundReceiver: safeTx.refundReceiver,
            nonce: safeTx.nonce,
          },
          signature: {
            r: sig.r,
            s: sig.s,
            v: sig.v,
          },
        },
        { timeout: 60000 }
      );

      console.log('[DepositModal] Approval response:', response.data);

      if (response.data.success) {
        setApprovalsCompleted(new Set(['ctf', 'ctfExchange', 'negRisk']));
        setCurrentApprovalStep(null);
        alert('Token approvals completed successfully!');
      } else {
        setError(response.data.error || 'Failed to approve tokens');
      }
    } catch (err: any) {
      console.error('[DepositModal] Token approval error:', err);
      if (err.code === 'ACTION_REJECTED') {
        setError('Signature request was rejected');
      } else if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else if (err.message?.includes('Network Error') || err.code === 'ECONNABORTED') {
        setError('Backend server is not accessible');
      } else {
        setError(err.message || 'Failed to approve tokens');
      }
    } finally {
      setIsProcessingApproval(false);
      setCurrentApprovalStep(null);
    }
  };

  const handleDeposit = async () => {
    if (!depositAmount || !proxyAddress || !window.ethereum) {
      setError('Please enter an amount');
      return;
    }

    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setIsDepositing(true);
    setError(null);

    try {
      console.log('[DepositModal] Starting deposit for:', proxyAddress);
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // ERC20 Token contract (USDC-like token on Amoy)
      const tokenContract = new ethers.Contract(
        COLLATERAL_TOKEN,
        [
          'function mint(address to, uint256 amount) public',
          'function decimals() view returns (uint8)',
        ],
        signer
      );

      // Get token decimals (typically 6 for USDC)
      const decimals = await tokenContract.decimals();
      console.log('[DepositModal] Token decimals:', decimals);

      // Calculate amount with decimals
      const amountWithDecimals = ethers.parseUnits(depositAmount, decimals);
      console.log('[DepositModal] Minting', amountWithDecimals.toString(), 'tokens to', proxyAddress);

      // Call mint function
      const tx = await tokenContract.mint(proxyAddress, amountWithDecimals);
      console.log('[DepositModal] Mint transaction sent:', tx.hash);

      // Wait for confirmation
      const receipt = await tx.wait();
      console.log('[DepositModal] Mint transaction confirmed:', receipt.hash);

      alert(`Successfully deposited ${depositAmount} USDC to your Polymarket wallet!`);
      setDepositAmount('');
      
      // Close modal after successful deposit
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('[DepositModal] Deposit error:', err);
      if (err.code === 'ACTION_REJECTED') {
        setError('Transaction was rejected');
      } else {
        setError(err.message || 'Failed to deposit');
      }
    } finally {
      setIsDepositing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1a1b1f] border border-gray-700 rounded-lg max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-white">Deposit</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {!isConnected ? (
            <div className="text-center py-8">
              <p className="text-gray-400 mb-4">Please connect your wallet first</p>
            </div>
          ) : isCheckingDeployment ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              <p className="text-gray-400 mt-4">Checking wallet status...</p>
            </div>
          ) : isWalletDeployed === false ? (
            <div className="space-y-4">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <p className="text-blue-300 text-sm">
                  To start trading, you need to enable your trading wallet. This is a one-time setup.
                </p>
              </div>
              
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              )}

              <button
                onClick={handleEnableTrading}
                disabled={isEnablingTrading}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg transition-all duration-200 flex items-center justify-center"
              >
                {isEnablingTrading ? (
                  <>
                    <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Enabling Trading...
                  </>
                ) : (
                  'Enable Trading'
                )}
              </button>

              <div className="text-xs text-gray-500 text-center">
                You'll be asked to sign a message to create your trading wallet
              </div>
            </div>
          ) : isWalletDeployed === true ? (
            <div className="space-y-4">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <p className="text-green-300 text-sm font-semibold mb-2">
                  ✓ Trading Enabled
                </p>
                {proxyAddress && (
                  <p className="text-gray-400 text-xs break-all">
                    Wallet: {proxyAddress}
                  </p>
                )}
              </div>

              {isCheckingApprovals ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <p className="text-gray-400 mt-4 text-sm">Checking approval status...</p>
                </div>
              ) : (
                <>
                  {/* Token Approval Section */}
                  {approvalsCompleted.size === 0 && (
                    <div className="border border-gray-600 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">Token Approvals</h3>
                  </div>

                  <p className="text-xs text-gray-400">
                    Approve tokens for trading on CTF Exchange and Neg Risk Exchange
                  </p>

                  {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                      <p className="text-red-300 text-xs">{error}</p>
                    </div>
                  )}

                  {currentApprovalStep && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                      <div className="flex items-center space-x-2">
                        <div className="inline-block animate-spin rounded-full h-3 w-3 border-b-2 border-blue-400"></div>
                        <p className="text-blue-300 text-xs">{currentApprovalStep}</p>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleApproveTokens}
                    disabled={isProcessingApproval}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center text-sm"
                  >
                    {isProcessingApproval ? (
                      <>
                        <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Approving...
                      </>
                    ) : (
                      'Approve Tokens'
                    )}
                  </button>
                </div>
              )}

              {/* Deposit Section */}
              <div className="space-y-3">
                {approvalsCompleted.size > 0 && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-3">
                    <p className="text-green-300 text-xs">
                      ✓ Token approvals completed
                    </p>
                  </div>
                )}
                
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                  <p className="text-blue-300 text-xs">
                    💡 You can mint dummy USDC for testing
                  </p>
                </div>
                
                <label className="block text-sm font-medium text-gray-300">
                  Amount (USDC)
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  disabled={approvalsCompleted.size === 0}
                  className="w-full bg-[#0f1014] border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                    <p className="text-red-300 text-xs">{error}</p>
                  </div>
                )}
              </div>

              <button
                onClick={handleDeposit}
                disabled={approvalsCompleted.size === 0 || isDepositing || !depositAmount}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg transition-all duration-200 disabled:opacity-50 flex items-center justify-center"
              >
                {isDepositing ? (
                  <>
                    <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Depositing...
                  </>
                ) : (
                  'Deposit'
                )}
              </button>
              </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
