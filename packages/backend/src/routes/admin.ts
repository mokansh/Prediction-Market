import { Router, Request, Response } from 'express';
import { ethers } from 'ethers';
import { getMarketCreationService } from '../services/marketCreationService';
import { getMarketResolutionService } from '../services/marketResolutionService';
import { getMarketsStore } from '../services/marketsStore';

const router = Router();

/**
 * POST /api/admin/create-market
 * Creates a new prediction market
 * 
 * Body:
 * {
 *   "question": "Will BTC hit $150K by end of July 31, 2026?",
 *   "description": "This market will resolve to Yes if...",
 *   "category": "Crypto",
 *   "resolutionSource": "https://coinmarketcap.com",
 *   "endTime": 1753920000,
 *   "image": "₿"
 * }
 */
router.post('/create-market', async (req: Request, res: Response) => {
  try {
    const { question, description, category, resolutionSource, endTime, image } = req.body;

    // Validation
    if (!question || typeof question !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Question is required and must be a string',
      });
    }

    if (!description || typeof description !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Description is required and must be a string',
      });
    }

    if (!category || typeof category !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Category is required and must be a string',
      });
    }

    if (!endTime || typeof endTime !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'End time is required and must be a Unix timestamp (number)',
      });
    }

    // Validate endTime is in the future
    const now = Math.floor(Date.now() / 1000);
    if (endTime <= now) {
      return res.status(400).json({
        success: false,
        error: 'End time must be in the future',
      });
    }

    console.log('[Admin] Creating market:', { question, category, endTime });

    const service = getMarketCreationService();
    const result = await service.createMarket({
      question,
      description,
      category,
      resolutionSource,
      endTime,
      image,
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    console.log('[Admin] Market created successfully:', result.questionId);

    return res.json(result);
  } catch (err: any) {
    console.error('[Admin] Error in create-market endpoint:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/admin/info
 * Gets admin service information
 */
router.get('/info', async (_req: Request, res: Response) => {
  try {
    const service = getMarketCreationService();
    const adminAddress = await service.getAdminAddress();

    return res.json({
      success: true,
      adminAddress,
      config: {
        umaAdapter: process.env.UMA_CTF_ADAPTER_ADDRESS || 'Not configured',
        conditionalTokens: process.env.CONDITIONAL_TOKENS_ADDRESS || 'Not configured',
        rewardToken: process.env.REWARD_TOKEN_ADDRESS || ethers.ZeroAddress,
      },
    });
  } catch (err: any) {
    console.error('[Admin] Error in info endpoint:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/admin/debug/markets
 * Debug endpoint to check markets in store
 */
router.get('/debug/markets', async (_req: Request, res: Response) => {
  try {
    const store = getMarketsStore();
    const markets = store.getAllMarkets();

    console.log('[Admin Debug] Markets in store:', markets.length);

    return res.json({
      success: true,
      marketCount: markets.length,
      markets: markets.map(m => ({
        id: m.id,
        question: m.question,
        category: m.category,
        conditionId: m.conditionId,
        resolved: m.resolved,
      })),
    });
  } catch (err: any) {
    console.error('[Admin] Error in debug/markets endpoint:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  }
});

/**
 * POST /api/admin/resolve-market
 * Resolves a market manually
 * 
 * Body:
 * {
 *   "marketId": "0x...",
 *   "outcome": "YES" or "NO"
 * }
 */
router.post('/resolve-market', async (req: Request, res: Response) => {
  try {
    const { marketId, outcome } = req.body;

    // Validation
    if (!marketId || typeof marketId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Market ID is required and must be a string',
      });
    }

    if (!outcome || typeof outcome !== 'string' || !['YES', 'NO'].includes(outcome.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: 'Outcome is required and must be either YES or NO',
      });
    }

    console.log('[Admin] Resolving market:', { marketId, outcome });

    const service = getMarketResolutionService();
    const result = await service.resolveMarket(marketId, outcome.toUpperCase() as 'YES' | 'NO');

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to resolve market',
      });
    }

    return res.json({
      success: true,
      transactionHash: result.transactionHash,
      message: `Market resolved with ${outcome} outcome`,
    });
  } catch (err: any) {
    console.error('[Admin] Error in resolve-market endpoint:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  }
});

export default router;
