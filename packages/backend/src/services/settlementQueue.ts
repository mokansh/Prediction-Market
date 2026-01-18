import { SettlementJob } from './settlementExecutor';

// Minimal in-memory queue placeholder. Replace with Redis/DB for durability.
class InMemoryQueue {
  private queue: SettlementJob[] = [];

  enqueue(job: SettlementJob) {
    this.queue.push(job);
  }

  dequeue(): SettlementJob | undefined {
    return this.queue.shift();
  }

  size() {
    return this.queue.length;
  }
}

export const settlementQueue = new InMemoryQueue();
