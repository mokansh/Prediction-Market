import { Router, Request, Response } from 'express';
import { getMarketsStore } from '../services/marketsStore';
import { getEventListenerService } from '../services/eventListenerService';
import { getTokenIdsForMarket } from '../utils/ctfCalculations';
import { ethers } from 'ethers';

const UmaCtfAdapterABI = require('../abis/UmaCtfAdapter.json');

const router = Router();

/**
 * GET /api/markets
 * Gets all markets with correct token IDs
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const store = getMarketsStore();
    const eventListener = getEventListenerService();
    let markets = store.getAllMarkets();

    // Ensure each market has correct token IDs from event listener or recalculate them
    markets = markets.map(market => {
      // Try to get token IDs from event listener first
      const marketCondition = eventListener.getMarketCondition(market.conditionId) || 
                              eventListener.getMarketCondition(market.id);
      
      if (marketCondition?.yesTokenId && marketCondition?.noTokenId) {
        // Update market with event listener token IDs if different
        if (marketCondition.yesTokenId !== market.tokenIds.yesTokenId || 
            marketCondition.noTokenId !== market.tokenIds.noTokenId) {
          console.log(`[Markets] Updating token IDs for market ${market.id}:`, {
            old: market.tokenIds,
            new: { yesTokenId: marketCondition.yesTokenId, noTokenId: marketCondition.noTokenId }
          });
          market.tokenIds = {
            yesTokenId: marketCondition.yesTokenId,
            noTokenId: marketCondition.noTokenId,
          };
          // Persist the update
          store.updateMarket(market.id, { tokenIds: market.tokenIds });
        }
      } else if (!market.tokenIds?.yesTokenId || !market.tokenIds?.noTokenId) {
        // Recalculate token IDs if missing
        if (process.env.COLLATERAL_TOKEN_ADDRESS) {
          const calculated = getTokenIdsForMarket(market.conditionId, process.env.COLLATERAL_TOKEN_ADDRESS);
          console.log(`[Markets] Recalculating token IDs for market ${market.id}:`, calculated);
          market.tokenIds = calculated;
          // Persist the update
          store.updateMarket(market.id, { tokenIds: calculated });
        }
      }
      
      return market;
    });

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
 * Gets a specific market by ID with correct token IDs
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const store = getMarketsStore();
    const eventListener = getEventListenerService();
    let market = store.getMarket(id);

    if (!market) {
      return res.status(404).json({
        success: false,
        error: 'Market not found',
      });
    }

    // Ensure market has correct token IDs from event listener or recalculate them
    const marketCondition = eventListener.getMarketCondition(market.conditionId) || 
                            eventListener.getMarketCondition(market.id);
    
    if (marketCondition?.yesTokenId && marketCondition?.noTokenId) {
      // Update market with event listener token IDs if different
      if (marketCondition.yesTokenId !== market.tokenIds.yesTokenId || 
          marketCondition.noTokenId !== market.tokenIds.noTokenId) {
        console.log(`[Markets] Updating token IDs for market ${market.id}:`, {
          old: market.tokenIds,
          new: { yesTokenId: marketCondition.yesTokenId, noTokenId: marketCondition.noTokenId }
        });
        market.tokenIds = {
          yesTokenId: marketCondition.yesTokenId,
          noTokenId: marketCondition.noTokenId,
        };
        // Persist the update
        store.updateMarket(market.id, { tokenIds: market.tokenIds });
      }
    } else if (!market.tokenIds?.yesTokenId || !market.tokenIds?.noTokenId) {
      // Recalculate token IDs if missing
      if (process.env.COLLATERAL_TOKEN_ADDRESS) {
        const calculated = getTokenIdsForMarket(market.conditionId, process.env.COLLATERAL_TOKEN_ADDRESS);
        console.log(`[Markets] Recalculating token IDs for market ${market.id}:`, calculated);
        market.tokenIds = calculated;
        // Persist the update
        store.updateMarket(market.id, { tokenIds: calculated });
      }
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
