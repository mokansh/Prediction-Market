/**
 * Collateralization Validator Service
 * 
 * Ensures that: 1 YES token price + 1 NO token price = 1 USD
 * Reference: https://docs.polymarket.com/developers/CLOB/introduction
 */

import { Order, OrderSide, OutcomeType, CollateralizationCheck } from '../types/orders';
import { getOrderBookService } from './orderBookService';

export class CollateralizationValidator {
  /**
   * Check if a new order maintains collateralization across the market
   * 
   * Rule: YES_PRICE + NO_PRICE = 1.0
   * 
   * Tolerance: 0.95 <= sum <= 1.05
   * This allows for efficient market-making while preventing extreme imbalances
   */
  static validateOrderCollateralization(
    order: Order,
    marketId: string
  ): CollateralizationCheck {
    const orderBookService = getOrderBookService();
    const prices = orderBookService.getMarketPrices(marketId);

    const yesPrice = prices.yes.midPrice;
    const noPrice = prices.no.midPrice;

    const check: CollateralizationCheck = {
      isValid: true,
      yesPrice,
      noPrice,
      sum: yesPrice + noPrice,
    };

    // For a valid market, YES + NO should approximately equal 1.0
    // We use a tolerance of ±0.05 (5%) to allow for market dynamics
    const minSum = 0.95;
    const maxSum = 1.05;

    if (check.sum < minSum || check.sum > maxSum) {
      check.isValid = false;
      check.error = `Market imbalance: YES(${yesPrice.toFixed(3)}) + NO(${noPrice.toFixed(3)}) = ${check.sum.toFixed(3)}, expected ~1.0`;
    }

    return check;
  }

  /**
   * Calculate the complementary price (implied by collateralization)
   * If YES is trading at price P, NO must be trading at 1-P
   */
  static getComplementaryPrice(outcomePrice: number, outcome: OutcomeType): number {
    return 1.0 - outcomePrice;
  }

  /**
   * Validate that buy and sell orders don't create arbitrage
   * 
   * If someone is buying YES at P, and NO at 1-P is already being traded,
   * there should be no arbitrage opportunity
   */
  static checkArbitrage(
    order: Order,
    marketId: string
  ): { hasArbitrage: boolean; message?: string } {
    const orderBookService = getOrderBookService();
    const prices = orderBookService.getMarketPrices(marketId);

    // The complementary outcome's price
    const complementaryOutcome = order.outcome === OutcomeType.YES ? OutcomeType.NO : OutcomeType.YES;
    const complementaryPrice = orderBookService.getMarketPrices(marketId)[
      complementaryOutcome === OutcomeType.YES ? 'yes' : 'no'
    ];

    const expectedComplementaryPrice = 1.0 - order.price;

    // Check if there's an arbitrage opportunity
    // (prices diverge significantly from complementary relationship)
    const deviation = Math.abs(
      complementaryPrice.midPrice - expectedComplementaryPrice
    );

    if (deviation > 0.05) {
      // 5% deviation threshold
      return {
        hasArbitrage: true,
        message: `Potential arbitrage: ${order.outcome} @ ${order.price.toFixed(3)}, but ${complementaryOutcome} @ ${complementaryPrice.midPrice.toFixed(3)} (expected ${expectedComplementaryPrice.toFixed(3)})`,
      };
    }

    return { hasArbitrage: false };
  }

  /**
   * Calculate the fair price for a token given the other outcome's price
   * This ensures collateralization: YES_PRICE + NO_PRICE = 1.0
   */
  static calculateFairPrice(
    marketId: string,
    outcome: OutcomeType
  ): number {
    const orderBookService = getOrderBookService();
    const prices = orderBookService.getMarketPrices(marketId);

    const yesPrice = prices.yes.midPrice;
    const noPrice = prices.no.midPrice;

    // The fair price should make the sum equal to 1.0
    // If YES is priced at X, NO should be priced at 1-X
    if (outcome === OutcomeType.YES) {
      return noPrice > 0 ? 1.0 - noPrice : 0.5;
    } else {
      return yesPrice > 0 ? 1.0 - yesPrice : 0.5;
    }
  }

  /**
   * Calculate the spread (bid-ask difference) with consideration for collateralization
   * The spread should reflect the market's confidence in the outcome
   */
  static calculateSpread(
    marketId: string,
    outcome: OutcomeType
  ): { spread: number; percentage: number } {
    const orderBookService = getOrderBookService();
    const book = orderBookService.getOrderBook(marketId, outcome);

    if (!book || book.buySide.length === 0 || book.sellSide.length === 0) {
      return { spread: 0, percentage: 0 };
    }

    const bestBid = book.buySide[0].price;
    const bestAsk = book.sellSide[0].price;
    const spread = bestAsk - bestBid;
    const percentage = (spread / ((bestBid + bestAsk) / 2)) * 100;

    return { spread, percentage };
  }

  /**
   * Simulate the impact of an order on market prices
   * Returns the new expected prices after the order is filled
   */
  static simulateOrderImpact(
    order: Order,
    marketId: string
  ): { newYesPrice: number; newNoPrice: number; slippage: number } {
    const orderBookService = getOrderBookService();
    const prices = orderBookService.getMarketPrices(marketId);

    let newYesPrice = prices.yes.midPrice;
    let newNoPrice = prices.no.midPrice;

    // Simulate price movement based on order size and current prices
    // This is a simplified model; production systems would use more sophisticated pricing
    
    if (order.outcome === OutcomeType.YES) {
      if (order.side === OrderSide.BUY) {
        // Buying YES drives YES price up, NO price down
        const impact = Math.min(order.amount / 1000, 0.05); // Max 5% impact
        newYesPrice = Math.min(newYesPrice + impact, 1.0);
        newNoPrice = 1.0 - newYesPrice;
      } else {
        // Selling YES drives YES price down, NO price up
        const impact = Math.min(order.amount / 1000, 0.05);
        newYesPrice = Math.max(newYesPrice - impact, 0);
        newNoPrice = 1.0 - newYesPrice;
      }
    } else {
      if (order.side === OrderSide.BUY) {
        // Buying NO drives NO price up, YES price down
        const impact = Math.min(order.amount / 1000, 0.05);
        newNoPrice = Math.min(newNoPrice + impact, 1.0);
        newYesPrice = 1.0 - newNoPrice;
      } else {
        // Selling NO drives NO price down, YES price up
        const impact = Math.min(order.amount / 1000, 0.05);
        newNoPrice = Math.max(newNoPrice - impact, 0);
        newYesPrice = 1.0 - newNoPrice;
      }
    }

    // Ensure collateralization
    const sum = newYesPrice + newNoPrice;
    if (Math.abs(sum - 1.0) > 0.001) {
      const scale = 1.0 / sum;
      newYesPrice *= scale;
      newNoPrice *= scale;
    }

    // Calculate slippage (difference from order price to new midpoint)
    const newMidPrice = order.outcome === OutcomeType.YES ? newYesPrice : newNoPrice;
    const slippage = Math.abs(order.price - newMidPrice);

    return { newYesPrice, newNoPrice, slippage };
  }

  /**
   * Get collateralization status for a market
   */
  static getCollateralizationStatus(marketId: string): {
    isValid: boolean;
    yesPrice: number;
    noPrice: number;
    sum: number;
    balance: number;
    status: 'BALANCED' | 'YES_HEAVY' | 'NO_HEAVY';
  } {
    const orderBookService = getOrderBookService();
    const prices = orderBookService.getMarketPrices(marketId);

    const yesPrice = prices.yes.midPrice;
    const noPrice = prices.no.midPrice;
    const sum = yesPrice + noPrice;

    let status: 'BALANCED' | 'YES_HEAVY' | 'NO_HEAVY' = 'BALANCED';
    if (yesPrice > 0.55) {
      status = 'YES_HEAVY';
    } else if (noPrice > 0.55) {
      status = 'NO_HEAVY';
    }

    return {
      isValid: Math.abs(sum - 1.0) <= 0.05,
      yesPrice,
      noPrice,
      sum,
      balance: yesPrice - noPrice,
      status,
    };
  }
}
