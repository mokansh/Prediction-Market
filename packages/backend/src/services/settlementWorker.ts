import { settlementQueue } from './settlementQueue';
import { SettlementExecutor } from './settlementExecutor';
import { getOrderBookService } from './orderBookService';
import { OrderStatus } from '../types/orders';

const POLL_INTERVAL_MS = 2000;

export class SettlementWorker {
  private executor: SettlementExecutor;
  private running = false;

  constructor() {
    this.executor = new SettlementExecutor();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.loop();
  }

  stop() {
    this.running = false;
  }

  private async loop() {
    while (this.running) {
      try {
        const job = settlementQueue.dequeue();
        if (job) {
          console.log('[SettlementWorker] Processing settlement job from queue');
          try {
            const txHash = await this.executor.settle(job);
            console.log('[SettlementWorker] ✅ Settled on-chain tx:', txHash);
            
            // Update order statuses and mark as settled on-chain
            const orderBookService = getOrderBookService();
            
            // Mark taker order as settled on-chain
            orderBookService.updateOrderStatus(job.takerOrder.id, OrderStatus.FULLY_FILLED);
            orderBookService.markOrderSettled(job.takerOrder.id, txHash);
            console.log(`[SettlementWorker] Marked taker order ${job.takerOrder.id} as settled on-chain`);
            
            // Mark all maker orders as settled on-chain
            for (const makerOrder of job.makerOrders) {
              orderBookService.updateOrderStatus(makerOrder.id, OrderStatus.FULLY_FILLED);
              orderBookService.markOrderSettled(makerOrder.id, txHash);
              console.log(`[SettlementWorker] Marked maker order ${makerOrder.id} as settled on-chain`);
            }
          } catch (err) {
            console.error('[SettlementWorker] ❌ Settlement failed:', err);
            // In a real system, re-enqueue or move to DLQ; for now, drop
          }
        } else {
          // Uncomment for verbose logging
          // console.log('[SettlementWorker] Settlement queue empty, waiting...');
        }
      } catch (err) {
        console.error('[SettlementWorker] Loop error:', err);
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
}

// Optional: start automatically if invoked directly
if (require.main === module) {
  const worker = new SettlementWorker();
  worker.start();
}
