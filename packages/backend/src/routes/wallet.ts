import { Router, Request, Response } from 'express';
import { WalletDeploymentService } from '../services/walletDeploymentService';
import { WalletBalanceService } from '../services/walletBalanceService';
import { getMarketsStore } from '../services/marketsStore';
import { getEventListenerService } from '../services/eventListenerService';
import { ethers } from 'ethers';

const router = Router();

// Lazy initialization of service (will be created on first request after env is loaded)
let walletDeploymentService: WalletDeploymentService | null = null;
let balanceService: WalletBalanceService | null = null;

function getWalletService(): WalletDeploymentService {
  if (!walletDeploymentService) {
    walletDeploymentService = new WalletDeploymentService();
  }
  return walletDeploymentService;
}

function getBalanceService(): WalletBalanceService {
  if (!balanceService) {
    balanceService = WalletBalanceService.getInstance();
  }
  return balanceService;
}

/**
 * Get the multisig address for a user (if deployed)
 */
router.get('/multisig', async (req: Request, res: Response) => {
  try {
    const { address } = req.query;

    if (!address || typeof address !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or missing address parameter',
      });
    }

    // Check if user has a deployed multisig wallet
    const deployment = await getWalletService().checkWalletDeployment(address);

    if (deployment.isDeployed && deployment.proxyAddress) {
      return res.json({
        success: true,
        multisigAddress: deployment.proxyAddress,
      });
    }

    // If no deployed multisig, return the user's address (fallback to EOA)
    return res.json({
      success: true,
      multisigAddress: address,
    });
  } catch (error: any) {
    console.error('[Wallet Multisig] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * Check if a multisig wallet is deployed for a given user address
 */
router.get('/check-deployment/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Ethereum address',
      });
    }

    const result = await getWalletService().checkWalletDeployment(address);

    // If wallet is deployed, update the balance mapping
    if (result.isDeployed && result.proxyAddress) {
      try {
        getBalanceService().updateWalletMapping(address, result.proxyAddress);
      } catch (error) {
        console.warn('[Wallet Check] Could not update balance mapping:', error);
      }
    }

    return res.json({
      success: true,
      isDeployed: result.isDeployed,
      proxyAddress: result.proxyAddress,
    });
  } catch (error: any) {
    console.error('Error in check-deployment endpoint:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * Deploy a multisig wallet for a user using their signature
 */
router.post('/deploy', async (req: Request, res: Response) => {
  try {
    const { userAddress, signature, paymentToken, payment, paymentReceiver } = req.body;

    // Validate inputs
    if (!userAddress || !/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user address',
      });
    }

    if (!signature || !signature.r || !signature.s || !signature.v) {
      return res.status(400).json({
        success: false,
        error: 'Invalid signature',
      });
    }

    if (!paymentToken || !/^0x[a-fA-F0-9]{40}$/.test(paymentToken)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment token address',
      });
    }

    if (!paymentReceiver || !/^0x[a-fA-F0-9]{40}$/.test(paymentReceiver)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment receiver address',
      });
    }

    // Deploy the wallet
    const result = await getWalletService().deployWallet({
      userAddress,
      signature,
      paymentToken,
      payment: payment || 0,
      paymentReceiver,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Update wallet mapping for balance tracking
    if (result.proxyAddress) {
      try {
        getBalanceService().updateWalletMapping(userAddress, result.proxyAddress);
        console.log(`[Wallet Deploy] Updated balance mapping: ${userAddress} -> ${result.proxyAddress}`);
      } catch (error) {
        console.warn('[Wallet Deploy] Could not update balance mapping:', error);
      }
    }

    return res.json(result);
  } catch (error: any) {
    console.error('Error in deploy endpoint:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * Get the admin wallet address (for verification)
 */
router.get('/admin-address', (_req: Request, res: Response) => {
  try {
    const adminAddress = getWalletService().getAdminAddress();
    return res.json({
      success: true,
      adminAddress,
    });
  } catch (error: any) {
    console.error('Error in admin-address endpoint:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/wallet/balance/batch
 * Get balances for multiple users
 * Query: addresses=0x1111...,0x2222...
 * NOTE: This must come BEFORE /balance/:userAddress to avoid route conflicts
 */
router.get('/balance/batch', async (req: Request, res: Response) => {
  try {
    const { addresses } = req.query;

    if (!addresses || typeof addresses !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid addresses parameter',
      });
    }

    // Parse addresses
    const addressArray = addresses.split(',').map(a => a.trim());

    // Validate all addresses
    for (const addr of addressArray) {
      if (!ethers.isAddress(addr)) {
        return res.status(400).json({
          success: false,
          error: `Invalid address: ${addr}`,
        });
      }
    }

    // Get balances
    const balances = await getBalanceService().getBatchBalances(addressArray);

    return res.json({
      success: true,
      count: balances.length,
      balances,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Wallet Balance] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get balances',
    });
  }
});

/**
 * GET /api/wallet/balance/:userAddress
 * Get user's collateral token balance from their multisig wallet
 */
router.get('/balance/:userAddress', async (req: Request, res: Response) => {
  try {
    const { userAddress } = req.params;
    const { walletAddress } = req.query;

    // Validate user address
    if (!ethers.isAddress(userAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user address format',
      });
    }

    // Get balance
    const balance = await getBalanceService().getUserBalance(
      userAddress,
      walletAddress as string | undefined
    );

    return res.json({
      success: true,
      balance,
      message: 'User collateral balance retrieved successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Wallet Balance] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get balance',
    });
  }
});

/**
 * POST /api/wallet/check-sufficient
 * Check if user has sufficient balance for an order
 */
router.post('/check-sufficient', async (req: Request, res: Response) => {
  try {
    const { userAddress, requiredAmount, walletAddress } = req.body;

    // Validate input
    if (!userAddress || !ethers.isAddress(userAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user address',
      });
    }

    if (!requiredAmount || isNaN(parseFloat(requiredAmount))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid required amount',
      });
    }

    // Check balance
    const hasSufficient = await getBalanceService().hasSufficientBalance(
      userAddress,
      requiredAmount,
      walletAddress
    );

    // Get actual balance for response
    const balance = await getBalanceService().getUserBalance(userAddress, walletAddress);

    return res.json({
      success: true,
      userAddress,
      requiredAmount,
      availableBalance: balance.collateralBalanceFormatted,
      hasSufficientBalance: hasSufficient,
      message: hasSufficient
        ? 'User has sufficient balance for this order'
        : 'Insufficient balance for this order',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Wallet Balance] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to check balance',
    });
  }
});

/**
 * POST /api/wallet/update-mapping
 * Update wallet address mapping for a user
 */
router.post('/update-mapping', async (req: Request, res: Response) => {
  try {
    const { userAddress, walletAddress } = req.body;

    // Validate input
    if (!userAddress || !ethers.isAddress(userAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user address',
      });
    }

    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address',
      });
    }

    // Update mapping
    getBalanceService().updateWalletMapping(userAddress, walletAddress);

    // Get updated balance
    const balance = await getBalanceService().getUserBalance(userAddress, walletAddress);

    return res.json({
      success: true,
      message: 'Wallet mapping updated successfully',
      userAddress,
      walletAddress,
      balance,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Wallet Balance] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update mapping',
    });
  }
});

/**
 * GET /api/wallet/nonce/:proxyAddress
 * Get the current nonce for a proxy wallet
 */
router.get('/nonce/:proxyAddress', async (req: Request, res: Response) => {
  try {
    const { proxyAddress } = req.params;

    if (!ethers.isAddress(proxyAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid proxy address',
      });
    }

    const nonce = await getWalletService().getProxyNonce(proxyAddress);

    return res.json({
      success: true,
      proxyAddress,
      nonce,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Wallet Nonce] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get nonce',
    });
  }
});

/**
 * POST /api/wallet/approve-tokens
 * Execute token approvals for the proxy wallet
 */
router.post('/approve-tokens', async (req: Request, res: Response) => {
  try {
    const { proxyAddress, safeTx, signature } = req.body;

    // Validate inputs
    if (!ethers.isAddress(proxyAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid proxy address',
      });
    }

    if (!safeTx || !safeTx.to || !safeTx.data) {
      return res.status(400).json({
        success: false,
        error: 'Invalid SafeTx data',
      });
    }

    if (!signature || !signature.r || !signature.s || typeof signature.v !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Invalid signature',
      });
    }

    // Execute the approval through the wallet service
    const result = await getWalletService().executeTokenApprovals({
      proxyAddress,
      safeTx,
      signature,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error: any) {
    console.error('[Wallet Approve Tokens] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to approve tokens',
    });
  }
});

/**
 * GET /api/wallet/market-balances/:userAddress/:marketId
 * Get YES/NO outcome token balances for a specific market
 */
router.get('/market-balances/:userAddress/:marketId', async (req: Request, res: Response) => {
  try {
    const { userAddress, marketId } = req.params;
    const { walletAddress } = req.query;

    // Validate user address
    if (!ethers.isAddress(userAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user address format',
      });
    }

    // Get conditional tokens contract address from env
    const conditionalTokensAddress = process.env.CONDITIONAL_TOKENS_ADDRESS;
    if (!conditionalTokensAddress || !ethers.isAddress(conditionalTokensAddress)) {
      return res.status(500).json({
        success: false,
        error: 'Conditional tokens contract not configured',
      });
    }

    // Get market condition with correct tokenIds (from event listener)
    const eventListener = getEventListenerService();
    let marketCondition = eventListener.getMarketCondition(marketId);

    if (!marketCondition) {
      // Fallback to markets store if event listener doesn't have it
      const marketsStore = getMarketsStore();
      const market = marketsStore.getMarket(marketId);
      
      if (!market) {
        return res.status(404).json({
          success: false,
          error: 'Market not found',
        });
      }
      
      // Try to get tokenIds from market
      if (!market.tokenIds || !market.tokenIds.yesTokenId || !market.tokenIds.noTokenId) {
        return res.status(400).json({
          success: false,
          error: 'Market tokenIds not available. Please ensure market conditions have been prepared.',
        });
      }
      
      marketCondition = {
        marketId: market.id,
        conditionId: market.conditionId,
        questionId: market.id,
        yesTokenId: market.tokenIds.yesTokenId,
        noTokenId: market.tokenIds.noTokenId,
        timestamp: Date.now(),
      };
    }

    // Determine which wallet address to check
    // Priority: 1. Query param walletAddress, 2. Balance service lookup, 3. userAddress directly
    let targetWallet = walletAddress as string | undefined;
    
    if (!targetWallet) {
      try {
        const balance = await getBalanceService().getUserBalance(userAddress);
        // Check if balance service returned a wallet address
        if (balance.walletAddress && ethers.isAddress(balance.walletAddress)) {
          targetWallet = balance.walletAddress;
        } else {
          // No wallet in balance service, use userAddress directly
          targetWallet = userAddress;
        }
      } catch (e) {
        // If balance service fails, use userAddress directly
        // This handles cases where the address provided IS the multisig/wallet
        targetWallet = userAddress;
      }
    }

    if (!targetWallet || !ethers.isAddress(targetWallet)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address',
      });
    }

    // Get balances from ConditionalTokens contract
    const ConditionalTokensABI = require('../abis/ConditionalTokens.json');
    const ctfContract = new ethers.Contract(
      conditionalTokensAddress,
      ConditionalTokensABI,
      getBalanceService()['provider'] || new ethers.JsonRpcProvider(process.env.RPC_URL || 'https://rpc-amoy.polygon.technology/')
    );

    // Fetch balances for YES and NO tokens using correct tokenIds from market condition
    const [yesBalance, noBalance] = await Promise.all([
      ctfContract.balanceOf(targetWallet, marketCondition.yesTokenId),
      ctfContract.balanceOf(targetWallet, marketCondition.noTokenId),
    ]);

    // Format balances with 6 decimals (divide by 10^6)
    const yesBalanceFormatted = ethers.formatUnits(yesBalance, 6);
    const noBalanceFormatted = ethers.formatUnits(noBalance, 6);

    return res.json({
      success: true,
      yesBalance: yesBalance.toString(),
      noBalance: noBalance.toString(),
      yesBalanceFormatted,
      noBalanceFormatted,
      yesTokenId: marketCondition.yesTokenId,
      noTokenId: marketCondition.noTokenId,
      walletAddress: targetWallet,
      message: 'Market outcome token balances retrieved successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Market Balances] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get market outcome balances',
    });
  }
});

/**
 * GET /api/wallet/token-balance/:walletAddress/:tokenId
 * 
 * Get ERC1155 token balance for any token ID
 * This is useful for checking YES/NO token balances when the token ID is known
 */
router.get('/token-balance/:walletAddress/:tokenId', async (req: Request, res: Response) => {
  try {
    const { walletAddress, tokenId } = req.params;

    // Validate addresses
    if (!ethers.isAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address format',
      });
    }

    // Validate token ID (should be 32 bytes hex)
    if (!/^0x[0-9a-fA-F]{64}$/.test(tokenId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid token ID format (must be 32 bytes hex)',
      });
    }

    // Get conditional tokens contract address from env
    const conditionalTokensAddress = process.env.CONDITIONAL_TOKENS_ADDRESS;
    if (!conditionalTokensAddress || !ethers.isAddress(conditionalTokensAddress)) {
      return res.status(500).json({
        success: false,
        error: 'Conditional tokens contract not configured',
      });
    }

    // Get balance from ConditionalTokens contract
    const ConditionalTokensABI = require('../abis/ConditionalTokens.json');
    const ctfContract = new ethers.Contract(
      conditionalTokensAddress,
      ConditionalTokensABI,
      getBalanceService()['provider'] || new ethers.JsonRpcProvider(process.env.RPC_URL || 'https://rpc-amoy.polygon.technology/')
    );

    const balance = await ctfContract.balanceOf(walletAddress, tokenId);
    const balanceFormatted = ethers.formatUnits(balance, 0);

    return res.json({
      success: true,
      balance: balance.toString(),
      balanceFormatted,
      tokenId,
      walletAddress,
      message: 'Token balance retrieved successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[wallet/token-balance] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get token balance',
    });
  }
});

/**
 * POST /api/wallet/redeem-winnings
 * Prepares redeemPositions call data for user to sign with their wallet
 * 
 * Body:
 * {
 *   "userAddress": "0x...",
 *   "marketId": "0x..."
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "redeemData": {
 *     "to": "0x... (CTF address)",
 *     "data": "0x... (encoded redeemPositions call)",
 *     "value": "0",
 *     "redeemableAmount": "1000000",
 *     "redeemableAmountFormatted": "1.000000"
 *   }
 * }
 */
router.post('/redeem-winnings', async (req: Request, res: Response) => {
  try {
    const { userAddress, marketId } = req.body;

    if (!userAddress || !/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user address',
      });
    }

    if (!marketId) {
      return res.status(400).json({
        success: false,
        error: 'Market ID is required',
      });
    }

    const rpcUrl = process.env.RPC_URL;
    const conditionalTokensAddress = process.env.CONDITIONAL_TOKENS_ADDRESS;

    if (!rpcUrl || !conditionalTokensAddress) {
      return res.status(500).json({
        success: false,
        error: 'Backend not configured for redemption',
      });
    }

    const ConditionalTokensABI = require('../abis/ConditionalTokens.json');

    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const ctf = new ethers.Contract(
        conditionalTokensAddress,
        ConditionalTokensABI,
        provider
      );

      // Get the market to find token IDs and outcome
      const store = getMarketsStore();
      const market = store.getMarket(marketId);

      if (!market) {
        return res.status(404).json({
          success: false,
          error: 'Market not found',
        });
      }

      if (!market.resolved || !market.resolutionOutcome) {
        return res.status(400).json({
          success: false,
          error: 'Market is not resolved or has no outcome',
        });
      }

      // Get the winning token ID based on resolution outcome
      const winningTokenId = market.resolutionOutcome === 'YES' 
        ? market.tokenIds.yesTokenId 
        : market.tokenIds.noTokenId;

      // Get user's winning token balance
      const userBalance = await ctf.balanceOf(userAddress, winningTokenId);

      if (userBalance === 0n) {
        return res.status(400).json({
          success: false,
          error: 'User has no winning tokens to redeem',
        });
      }

      console.log('[Wallet] Preparing redemption:', {
        userAddress,
        marketId,
        winningOutcome: market.resolutionOutcome,
        winningTokenId,
        balance: userBalance.toString(),
      });

      // Prepare redeemPositions call
      // redeemPositions(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] indexSets)
      // For a binary market with two outcomes (YES/NO):
      // - If YES wins: indexSets = [1] (redeem YES tokens)
      // - If NO wins: indexSets = [2] (redeem NO tokens)
      // parentCollectionId is bytes32(0) for the root collection

      const collateralToken = process.env.COLLATERAL_TOKEN_ADDRESS || process.env.COLLATERAL_TOKEN;
      if (!collateralToken) {
        throw new Error('Collateral token address not configured');
      }

      const indexSet = market.resolutionOutcome === 'YES' ? 1 : 2;
      const parentCollectionId = '0x0000000000000000000000000000000000000000000000000000000000000000'; // Root collection

      // Encode the redeemPositions function call
      const encodedData = ctf.interface.encodeFunctionData('redeemPositions', [
        collateralToken,
        parentCollectionId,
        market.conditionId,
        [indexSet],
      ]);

      console.log('[Wallet] Encoded redeemPositions:', {
        collateral: collateralToken,
        parentCollectionId,
        conditionId: market.conditionId,
        indexSet,
        encodedData,
      });

      // Prepare Safe transaction data
      const safeAddress = userAddress; // This should be the multisig address
      
      // Fetch current nonce from Safe contract
      const SafeABI = [
        'function nonce() external view returns (uint256)'
      ];
      const safeContract = new ethers.Contract(safeAddress, SafeABI, provider);
      const nonce = await safeContract.nonce();
      
      const to = conditionalTokensAddress;
      const value = 0;
      const data = encodedData;
      const operation = 0; // 0 = Call, 1 = DelegateCall
      const safeTxGas = 0;
      const baseGas = 0;
      const gasPrice = 0;
      const gasToken = '0x0000000000000000000000000000000000000000';
      const refundReceiver = '0x0000000000000000000000000000000000000000';

      // Calculate Safe transaction hash for EIP712 signing
      const safeTxHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['address', 'uint256', 'bytes', 'uint8', 'uint256', 'uint256', 'uint256', 'address', 'address', 'uint256'],
          [to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, nonce]
        )
      );

      return res.json({
        success: true,
        redeemData: {
          // Data for calling redeemPositions directly (not used in Safe flow)
          ctfAddress: conditionalTokensAddress,
          encodedRedeemCall: encodedData,
          
          // Safe transaction data
          safeAddress,
          safeTxData: {
            to,
            value: value.toString(),
            data,
            operation,
            safeTxGas: safeTxGas.toString(),
            baseGas: baseGas.toString(),
            gasPrice: gasPrice.toString(),
            gasToken,
            refundReceiver,
            nonce: nonce.toString(),
          },
          safeTxHash,
          
          // User info
          redeemableAmount: userBalance.toString(),
          redeemableAmountFormatted: (Number(userBalance) / 1e6).toFixed(6),
          winningOutcome: market.resolutionOutcome,
        },
      });
    } catch (err: any) {
      console.error('[Wallet] Error preparing redemption:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Failed to prepare redemption',
      });
    }
  } catch (error: any) {
    console.error('[wallet/redeem-winnings] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to redeem winnings',
    });
  }
});

export default router;
