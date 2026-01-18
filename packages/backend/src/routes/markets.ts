import { Router, Request, Response } from 'express';
import { getMarketsStore } from '../services/marketsStore';
import { ethers } from 'ethers';

const UmaCtfAdapterABI = require('../abis/UmaCtfAdapter.json');

const router = Router();

/**
 * GET /api/markets
 * Gets all markets
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const store = getMarketsStore();
    const markets = store.getAllMarkets();

    console.log('[Markets] GET /api/markets - Retrieved', markets.length, 'markets');
    if (markets.length > 0) {
      console.log('[Markets] Sample market:', markets[0]);
    }

    return res.json({
      success: true,
      markets,
    });
  } catch (err: any) {
    console.error('[Markets] Error fetching markets:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/markets/:id
 * Gets a specific market by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const store = getMarketsStore();
    const market = store.getMarket(id);

    if (!market) {
      return res.status(404).json({
        success: false,
        error: 'Market not found',
      });
    }

    return res.json({
      success: true,
      market,
    });
  } catch (err: any) {
    console.error('[Markets] Error fetching market:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/markets/:id/resolution-status
 * Gets the resolution status of a market
 */
router.get('/:id/resolution-status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const store = getMarketsStore();
    const market = store.getMarket(id);

    if (!market) {
      return res.status(404).json({
        success: false,
        error: 'Market not found',
      });
    }

    // Use market store data for resolution status
    // Don't call getExpectedPayouts on flagged markets as it will revert
    const isResolved = market.resolved;
    const outcome = market.resolutionOutcome || null;

    console.log('[Markets] Resolution status for', id, ':', { isResolved, outcome });

    return res.json({
      success: true,
      resolved: isResolved,
      outcome,
      market,
    });
  } catch (err: any) {
    console.error('[Markets] Error fetching resolution status:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  }
});

export default router;
