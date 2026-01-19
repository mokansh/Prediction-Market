/**
 * Settlement Retry Service
 * 
 * Automatically retries settlement for orders that are marked as FULLY_FILLED
 * at the backend level but may not have settled on-chain.
 * 
 * This service is useful when:
 * - Token registration was delayed
 * - On-chain settlement failed due to temporary issues
 * - System needs to recover from failures
 */

import { getOrderBookService } from './orderBookService';
import { settlementQueue } from './settlementQueue';
import { Order, OrderSide, OrderStatus } from '../types/orders';
import { SettlementJob } from './settlementExecutor';

export class SettlementRetryService {
  /**
   * Find all FULLY_FILLED orders that might need settlement retry
   */
  static findUnprocessedMatches(): { order1: Order; order2: Order }[] {
    const orderBookService = getOrderBookService();
    const allOrders = orderBookService.getAllOrders();
    
    // Find all FULLY_FILLED BUY orders that haven't been settled on-chain yet
    const fullyFilledBuyOrders = allOrders.filter(
      order => 
        order.status === OrderStatus.FULLY_FILLED && 
        order.side === OrderSide.BUY &&
        !order.settledOnChain &&  // Only retry if not settled on-chain
        !order.settlementTxHash   // And no settlement tx hash recorded
    );
    
    const matches: { order1: Order; order2: Order }[] = [];
    const processedOrderIds = new Set<string>();
    
    // Find complementary matches (BUY YES + BUY NO at complementary prices)
    for (const order1 of fullyFilledBuyOrders) {
      if (processedOrderIds.has(order1.id)) continue;
      
      for (const order2 of fullyFilledBuyOrders) {
        if (processedOrderIds.has(order2.id)) continue;
        if (order1.id === order2.id) continue;
        if (order1.marketId !== order2.marketId) continue;
        
        // Check if complementary match
        if (
          order1.outcome !== order2.outcome &&
          Math.abs((order1.price + order2.price) - 1.0) < 0.001 &&
          order1.createdAt < Date.now() - 5000 // At least 5 seconds old
        ) {
          matches.push({ order1, order2 });
          processedOrderIds.add(order1.id);
          processedOrderIds.add(order2.id);
          break;
        }
      }
    }
    
    return matches;
  }
  
  /**
   * Enqueue settlement jobs for matched orders
   */
  static enqueueRetryJobs(matches: { order1: Order; order2: Order }[]) {
    let enqueued = 0;
    
    for (const { order1, order2 } of matches) {
      const takerOrder = order1.createdAt > order2.createdAt ? order1 : order2;
      const makerOrder = order1.createdAt > order2.createdAt ? order2 : order1;
      
      const fillAmount = Math.min(takerOrder.amount, makerOrder.amount);
      const takerFillInMakerTerms = Math.floor(fillAmount * takerOrder.price).toString();
      const takerReceiveInTakerTerms = fillAmount.toString();
      const makerFillInMakerTerms = Math.floor(fillAmount * makerOrder.price).toString();
      
      const job: SettlementJob = {
        takerOrder,
        makerOrders: [makerOrder],
        takerFillAmount: takerFillInMakerTerms,
        takerReceiveAmount: takerReceiveInTakerTerms,
        makerFillAmounts: [makerFillInMakerTerms],
        takerFeeAmount: '0',
        makerFeeAmounts: ['0'],
        marketId: takerOrder.marketId,
      };
      
      settlementQueue.enqueue(job);
      enqueued++;
      
      console.log(`[SettlementRetry] Enqueued job for orders ${takerOrder.id} ↔ ${makerOrder.id}`);
    }
    
    return enqueued;
  }
  
  /**
   * Check for unprocessed matches and retry settlement
   */
  static async retryUnprocessedMatches(): Promise<number> {
    console.log('[SettlementRetry] Checking for unprocessed matches...');
    
    const matches = this.findUnprocessedMatches();
    
    if (matches.length === 0) {
      console.log('[SettlementRetry] No unprocessed matches found');
      return 0;
    }
    
    console.log(`[SettlementRetry] Found ${matches.length} unprocessed match(es)`);
    
    const enqueued = this.enqueueRetryJobs(matches);
    
    console.log(`[SettlementRetry] Enqueued ${enqueued} settlement job(s)`);
    
    return enqueued;
  }
}
