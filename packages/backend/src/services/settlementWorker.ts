import { settlementQueue } from './settlementQueue';
import { SettlementExecutor } from './settlementExecutor';

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
