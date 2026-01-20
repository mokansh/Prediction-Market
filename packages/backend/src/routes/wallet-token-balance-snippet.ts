/**
 * GET /api/wallet/token-balance/:walletAddress/:tokenId
 * 
 * Get ERC1155 token balance for any token ID
 * This is useful for checking YES/NO token balances when the token ID is known
 * but not necessarily stored in the market data
 */
import { Router, Request, Response } from 'express';
import { ethers } from 'ethers';
import ConditionalTokensABI from '../abis/ConditionalTokens.json';
import WalletBalanceService from '../services/walletBalanceService';

const router = Router();

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


    // Use WalletBalanceService singleton to get provider
    const provider = WalletBalanceService.getInstance()['provider'] || new ethers.JsonRpcProvider(process.env.RPC_URL || 'https://rpc-amoy.polygon.technology/');
    const ctfContract = new ethers.Contract(
      conditionalTokensAddress,
      ConditionalTokensABI,
      provider
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

export default router;
