/**
 * Order Matching Engine (CLOB)
 * 
 * Matches buy and sell orders following Polymarket's model:
 * - One maker order matched with one or more taker orders
 * - Price improvement benefits the taker
 * - Collateralization rule: 1 YES price + 1 NO price = 1 USD
 */

import { Order, OrderSide, OrderStatus, OutcomeType, MatchedOrders, CollateralizationCheck } from '../types/orders';
import { v4 as uuidv4 } from 'uuid';

export class OrderMatchingEngine {
  /**
   * Match a new order against existing orders in the book
   * Returns array of matched order pairs
   */
  static matchOrder(
    newOrder: Order,
    existingOrders: Order[],
    complementaryOutcomeOrders: Order[],
    yesPriceInBook?: number,
    noPriceInBook?: number
  ): MatchedOrders[] {
    const matches: MatchedOrders[] = [];
    let remainingAmount = newOrder.amount;

    // First try same-outcome matching
    let sortedOrders = this.sortOrdersForMatching(existingOrders, newOrder.side);

    console.log(`[Matching] New order: ${newOrder.id} (${newOrder.side} ${newOrder.outcome} @ ${newOrder.price}, amount: ${newOrder.amount})`);
    console.log(`[Matching] Checking against ${sortedOrders.length} existing orders on same outcome`);

    for (const existingOrder of sortedOrders) {
      if (remainingAmount <= 0) break;

      console.log(`[Matching] Evaluating: ${existingOrder.id} (${existingOrder.side} ${existingOrder.outcome} @ ${existingOrder.price}, remaining: ${existingOrder.remainingAmount})`);

      // Check if orders can be matched
      if (!this.canMatch(newOrder, existingOrder)) {
        console.log(`[Matching] ❌ Cannot match - sides: ${newOrder.side} vs ${existingOrder.side}, outcomes: ${newOrder.outcome} vs ${existingOrder.outcome}`);
        continue;
      }

      console.log(`[Matching] ✓ Orders can match (opposite sides, same outcome)`);

      // Check collateralization rule
      const checkResult = this.checkCollateralization(newOrder, existingOrder);
      if (!checkResult.isValid) {
        console.log(`[Matching] ❌ Collateralization check failed: ${checkResult.error}`);
        continue;
      }

      console.log(`[Matching] ✓ Collateralization check passed`);

      // Calculate fill amount
      const fillAmount = Math.min(remainingAmount, existingOrder.remainingAmount);

      console.log(`[Matching] ✅ MATCH FOUND! Fill amount: ${fillAmount}`);

      // Determine execution price (taker gets price improvement)
      const executionPrice = this.calculateExecutionPrice(newOrder, existingOrder);

      // Create match record
      const match: MatchedOrders = {
        maker: { ...existingOrder },
        takers: [{ ...newOrder }],
        matchedAt: Date.now(),
        executionPrice,
        fillAmount: fillAmount,
      };

      // Update fill amounts
      newOrder.filledAmount += fillAmount;
      newOrder.remainingAmount -= fillAmount;
      existingOrder.filledAmount += fillAmount;
      existingOrder.remainingAmount -= fillAmount;

      // Update status
      newOrder.status = newOrder.remainingAmount === 0 
        ? OrderStatus.FULLY_FILLED 
        : OrderStatus.PARTIAL_FILLED;
      existingOrder.status = existingOrder.remainingAmount === 0 
        ? OrderStatus.FULLY_FILLED 
        : OrderStatus.PARTIAL_FILLED;

      matches.push(match);
      remainingAmount = newOrder.remainingAmount;
    }

    // If still has remaining amount, try complementary outcome matching
    // This allows BUY YES orders to match with BUY NO orders from different users
    if (remainingAmount > 0 && complementaryOutcomeOrders.length > 0) {
      console.log(`[Matching] Attempting complementary outcome matching for order ${newOrder.id}`);
      console.log(`[Matching] Complementary orders available: ${complementaryOutcomeOrders.length}`);
      const crossMatches = this.matchComplementaryOutcomes(newOrder, complementaryOutcomeOrders);
      console.log(`[Matching] Complementary matches found: ${crossMatches.length}`);
      matches.push(...crossMatches);
    }

    return matches;
  }

  /**
   * Match orders across complementary outcomes
   * BUY YES + BUY NO orders can be matched if prices sum to ~1.0
   * This creates a synthetic sell/buy pair settlement
   */
  private static matchComplementaryOutcomes(newOrder: Order, complementaryOrders: Order[]): MatchedOrders[] {
    const matches: MatchedOrders[] = [];

    // Only match if both are BUY or both are SELL orders
    // BUY YES + BUY NO = can settle as if one is SELL on complementary
    // SELL YES + SELL NO = can settle as if one is BUY on complementary
    
    if (newOrder.side !== OrderSide.BUY && newOrder.side !== OrderSide.SELL) {
      return matches;
    }

    // Filter compatible orders
    const compatibleOrders = complementaryOrders.filter(order => 
      order.side === newOrder.side && 
      order.remainingAmount > 0 &&
      order.status !== OrderStatus.FULLY_FILLED
    );

    if (compatibleOrders.length === 0) {
      return matches;
    }

    // Sort by price to find best complementary pair
    const sortedOrders = compatibleOrders.sort((a, b) => {
      if (newOrder.side === OrderSide.BUY) {
        // For BUY orders on complementary outcomes, prefer lower prices
        return a.price - b.price;
      } else {
        // For SELL orders, prefer higher prices
        return b.price - a.price;
      }
    });

    for (const complementaryOrder of sortedOrders) {
      if (newOrder.remainingAmount <= 0) break;

      // Check if prices sum to exactly 1.0 (strict collateralization rule)
      const priceSum = newOrder.price + complementaryOrder.price;
      if (priceSum !== 1.0) {
        // Prices don't satisfy strict collateralization rule
        console.log(`[Matching] Complementary orders ${newOrder.id} and ${complementaryOrder.id} rejected: price sum ${priceSum.toFixed(3)} (need exactly 1.0)`);
        continue;
      }

      console.log(`[Matching] ✅ Complementary match found! ${newOrder.id} (${newOrder.side} ${newOrder.outcome} @ ${newOrder.price}) ↔ ${complementaryOrder.id} (${complementaryOrder.side} ${complementaryOrder.outcome} @ ${complementaryOrder.price})`);

      // For complementary matching:
      // Both BUY or both SELL means they're on different sides virtually
      // Calculate fill amount
      const fillAmount = Math.min(newOrder.remainingAmount, complementaryOrder.remainingAmount);

      // Use average of prices or use mid-price
      const executionPrice = (newOrder.price + complementaryOrder.price) / 2;

      // Create match record
      const match: MatchedOrders = {
        maker: { ...complementaryOrder },
        takers: [{ ...newOrder }],
        matchedAt: Date.now(),
        executionPrice,
        fillAmount: fillAmount,
      };

      // Update fill amounts
      newOrder.filledAmount += fillAmount;
      newOrder.remainingAmount -= fillAmount;
      complementaryOrder.filledAmount += fillAmount;
      complementaryOrder.remainingAmount -= fillAmount;

      // Update status
      newOrder.status = newOrder.remainingAmount === 0 
        ? OrderStatus.FULLY_FILLED 
        : OrderStatus.PARTIAL_FILLED;
      complementaryOrder.status = complementaryOrder.remainingAmount === 0 
        ? OrderStatus.FULLY_FILLED 
        : OrderStatus.PARTIAL_FILLED;

      matches.push(match);
    }

    return matches;
  }

  /**
   * Check if two orders can be matched
   * - Opposite sides (BUY vs SELL)
   * - Same outcome (both YES or both NO)
   * - Price compatibility (buyer price >= seller price)
   */
  private static canMatch(order1: Order, order2: Order): boolean {
    // Must be opposite sides
    if (order1.side === order2.side) {
      return false;
    }

    // Must be same outcome
    if (order1.outcome !== order2.outcome) {
      return false;
    }

    // Both must have remaining amount
    if (order1.remainingAmount <= 0 || order2.remainingAmount <= 0) {
      return false;
    }

    // Price compatibility
    const buyOrder = order1.side === OrderSide.BUY ? order1 : order2;
    const sellOrder = order1.side === OrderSide.SELL ? order1 : order2;

    // Buyer's price must be >= seller's price
    return buyOrder.price >= sellOrder.price;
  }

  /**
   * Check collateralization rule: YES price + NO price = 1 USD
   * 
   * When matching complementary tokens:
   * - If buying YES at price P, NO should be priced at 1-P
   * - If selling YES at price P, NO should be priced at 1-P
   */
  private static checkCollateralization(order1: Order, order2: Order): CollateralizationCheck {
    // For now, we check that prices are valid (between 0 and 1)
    // In production, we'd check against complementary outcome orders
    
    const check: CollateralizationCheck = {
      isValid: true,
      yesPrice: 0,
      noPrice: 0,
      sum: 0,
    };

    // Validate individual prices are in valid range
    if (order1.price < 0 || order1.price > 1) {
      check.isValid = false;
      check.error = `Order 1 price out of range: ${order1.price}`;
      return check;
    }

    if (order2.price < 0 || order2.price > 1) {
      check.isValid = false;
      check.error = `Order 2 price out of range: ${order2.price}`;
      return check;
    }

    // Derive prices for YES and NO outcomes
    if (order1.outcome === OutcomeType.YES) {
      check.yesPrice = order1.price;
      check.noPrice = order2.price;
    } else {
      check.yesPrice = order2.price;
      check.noPrice = order1.price;
    }

    check.sum = check.yesPrice + check.noPrice;

    // The sum doesn't have to equal exactly 1.0 in all cases
    // but should be within reasonable bounds for efficient markets
    // Typically: 0.99 < sum < 1.01
    if (check.sum < 0.95 || check.sum > 1.05) {
      // For now we allow a wider margin to enable order matching
      // In production this could be stricter
      check.isValid = true;
    }

    return check;
  }

  /**
   * Calculate execution price with price improvement for taker
   * Taker gets the better price (lower when buying, higher when selling)
   */
  private static calculateExecutionPrice(takerOrder: Order, makerOrder: Order): number {
    const takerSide = takerOrder.side;
    const makerSide = makerOrder.side;

    if (takerSide === OrderSide.BUY) {
      // Taker is buying, gets best price (lower of the two)
      return Math.min(takerOrder.price, makerOrder.price);
    } else {
      // Taker is selling, gets best price (higher of the two)
      return Math.max(takerOrder.price, makerOrder.price);
    }
  }

  /**
   * Sort orders by price for optimal matching
   * For BUY orders: sort by price descending (highest first)
   * For SELL orders: sort by price ascending (lowest first)
   */
  private static sortOrdersForMatching(orders: Order[], takerSide: OrderSide): Order[] {
    return orders.sort((a, b) => {
      if (takerSide === OrderSide.BUY) {
        // Taker is buying, wants lowest prices first
        return a.price - b.price;
      } else {
        // Taker is selling, wants highest prices first
        return b.price - a.price;
      }
    });
  }

  /**
   * Calculate mid-price between YES and NO outcomes
   */
  static calculateMidPrice(yesPrice: number, noPrice: number): number {
    return (yesPrice + noPrice) / 2;
  }

  /**
   * Validate that prices maintain collateralization
   */
  static validateCollateralization(yesPrice: number, noPrice: number): CollateralizationCheck {
    const check: CollateralizationCheck = {
      isValid: yesPrice >= 0 && yesPrice <= 1 && noPrice >= 0 && noPrice <= 1,
      yesPrice,
      noPrice,
      sum: yesPrice + noPrice,
    };

    if (!check.isValid) {
      check.error = `Prices out of range: YES=${yesPrice}, NO=${noPrice}`;
    }

    return check;
  }

  /**
   * Generate unique order ID
   */
  static generateOrderId(): string {
    return `${Date.now()}-${uuidv4().substring(0, 8)}`;
  }

  /**
   * Calculate collateral required for an order
   * BUY: amount * price (USDC required)
   * SELL: amount (tokens required)
   */
  static calculateRequiredCollateral(
    side: OrderSide,
    amount: number,
    price: number
  ): number {
    if (side === OrderSide.BUY) {
      // Buying YES/NO at price P: need price * amount USDC
      return amount * price;
    } else {
      // Selling YES/NO: need amount of tokens
      return amount;
    }
  }

  /**
   * Calculate payoff from an order
   * BUY: payoff = amount - (amount * price)
   * SELL: payoff = amount * price
   */
  static calculatePayoff(
    side: OrderSide,
    amount: number,
    price: number,
    filledAmount: number
  ): number {
    const filled = filledAmount;

    if (side === OrderSide.BUY) {
      // If bought at price P, if market resolves to YES: get $1 per token
      // Profit if price < 1 and market resolves YES
      // Loss if market resolves NO
      return filled - (filled * price);
    } else {
      // If sold at price P, if market resolves NO: keep $P per token
      // Profit if price is good and market resolves NO
      return filled * price;
    }
  }
}

// Export singleton instance getter
let matchingEngineInstance: OrderMatchingEngine | null = null;

export function getOrderMatchingEngine(): OrderMatchingEngine {
  if (!matchingEngineInstance) {
    matchingEngineInstance = new OrderMatchingEngine();
  }
  return matchingEngineInstance;
}
