import { Router, Request, Response } from 'express';
import { getEventListenerService } from '../services/eventListenerService';
import { getMarketsStore } from '../services/marketsStore';
import { getTokenIdsForMarket } from '../utils/ctfCalculations';

const router = Router();
const eventListener = getEventListenerService();

/**
 * Get market condition metadata (conditionId, tokenIds, etc.)
 * This information comes from CTF ConditionPreparation events
 */
router.get('/condition/:conditionIdOrMarketId', async (req: Request, res: Response) => {
  try {
    const { conditionIdOrMarketId } = req.params;

    if (!conditionIdOrMarketId) {
      return res.status(400).json({
        success: false,
        error: 'conditionId or marketId is required',
      });
    }

    // Try to get market condition by conditionId
    let marketCondition = eventListener.getMarketCondition(conditionIdOrMarketId);

    // Fallback to markets store if event listener does not have it (e.g., server restart before replay)
    if (!marketCondition) {
      const store = getMarketsStore();
      const marketById = store.getMarket(conditionIdOrMarketId);
      const marketByCondition = store.getMarketByConditionId(conditionIdOrMarketId);
      const market = marketById || marketByCondition;

      if (market) {
        const conditionId = market.conditionId;
        const tokenIds = market.tokenIds;
        const yesNo = tokenIds?.yesTokenId && tokenIds?.noTokenId
          ? tokenIds
          : (() => {
              if (!process.env.COLLATERAL_TOKEN_ADDRESS) return undefined;
              return getTokenIdsForMarket(conditionId, process.env.COLLATERAL_TOKEN_ADDRESS);
            })();

        if (yesNo) {
          marketCondition = {
            marketId: market.id,
            conditionId,
            questionId: market.id,
            yesTokenId: yesNo.yesTokenId,
            noTokenId: yesNo.noTokenId,
            timestamp: market.createdAt,
          } as any;

          // Cache in event listener map for future lookups
          eventListener.storeMarketCondition(market.id, conditionId, market.id);
        }
      }
    }

    if (!marketCondition) {
      return res.status(404).json({
        success: false,
        error: 'Market condition not found',
      });
    }

    return res.json({
      success: true,
      marketCondition,
    });
  } catch (error: any) {
    console.error('[Markets] Error in condition endpoint:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * Store market condition manually (for testing or manual setup)
 */
router.post('/condition', async (req: Request, res: Response) => {
  try {
    const { marketId, conditionId, questionId } = req.body;

    if (!marketId || !conditionId || !questionId) {
      return res.status(400).json({
        success: false,
        error: 'marketId, conditionId, and questionId are required',
      });
    }

    const marketCondition = eventListener.storeMarketCondition(marketId, conditionId, questionId);

    return res.json({
      success: true,
      marketCondition,
    });
  } catch (error: any) {
    console.error('[Markets] Error storing condition:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

export default router;
