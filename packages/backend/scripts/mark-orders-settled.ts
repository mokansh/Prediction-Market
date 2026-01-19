/**
 * Mark Orders as Settled Script
 * 
 * This script marks specific orders as settled on-chain in the database.
 * Use this when orders were successfully settled on-chain but the database
 * wasn't updated (e.g., the first settlement before tracking was added).
 * 
 * Usage: npx ts-node scripts/mark-orders-settled.ts <tx-hash> <order-id-1> <order-id-2> ...
 */

import { getOrderBookService } from '../src/services/orderBookService';

async function markOrdersSettled(txHash: string, orderIds: string[]) {
  console.log('='.repeat(80));
  console.log('MARK ORDERS AS SETTLED ON-CHAIN');
  console.log('='.repeat(80));
  console.log(`Transaction Hash: ${txHash}`);
  console.log(`Order IDs: ${orderIds.join(', ')}`);
  console.log('');

  const orderBookService = getOrderBookService();
  
  let marked = 0;
  let notFound = 0;
  
  for (const orderId of orderIds) {
    const order = orderBookService.getOrder(orderId);
    
    if (!order) {
      console.log(`❌ Order ${orderId} not found`);
      notFound++;
      continue;
    }
    
    const success = orderBookService.markOrderSettled(orderId, txHash);
    
    if (success) {
      console.log(`✅ Marked order ${orderId} as settled on-chain`);
      marked++;
    } else {
      console.log(`❌ Failed to mark order ${orderId}`);
    }
  }
  
  console.log('');
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`✅ Marked: ${marked}`);
  console.log(`❌ Not found: ${notFound}`);
  console.log('');
  console.log('These orders will NOT be retried in future settlement attempts.');
  console.log('');
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: npx ts-node scripts/mark-orders-settled.ts <tx-hash> <order-id-1> [order-id-2] ...');
  console.error('');
  console.error('Example:');
  console.error('  npx ts-node scripts/mark-orders-settled.ts 0xbb63beaf4fbee18a5c6544bcf841bbc44f9bed8fae1ed102a21416e39db7ac54 1768800866174-3d4a0ebb 1768800974569-a085abda');
  process.exit(1);
}

const [txHash, ...orderIds] = args;

markOrdersSettled(txHash, orderIds)
  .then(() => {
    console.log('Done.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
