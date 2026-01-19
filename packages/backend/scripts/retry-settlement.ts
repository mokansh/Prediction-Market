/**
 * Retry Settlement Script
 * 
 * This script retries on-chain settlement for orders that were already matched
 * at the backend level but failed to settle on-chain (e.g., due to token registration issues).
 * 
 * Usage: npx ts-node scripts/retry-settlement.ts <order-id-1> <order-id-2>
 */

import * as fs from 'fs';
import * as path from 'path';
import { SettlementExecutor, SettlementJob } from '../src/services/settlementExecutor';
import { getOrderBookService } from '../src/services/orderBookService';
import { Order, OrderSide, OrderStatus } from '../src/types/orders';

async function retrySettlement(orderId1: string, orderId2: string) {
  console.log('='.repeat(80));
  console.log('RETRY SETTLEMENT FOR MATCHED ORDERS');
  console.log('='.repeat(80));
  console.log(`Order 1: ${orderId1}`);
  console.log(`Order 2: ${orderId2}`);
  console.log('');

  // Load orders from file
  const orderBookService = getOrderBookService();
  const order1 = orderBookService.getOrder(orderId1);
  const order2 = orderBookService.getOrder(orderId2);

  if (!order1) {
    console.error(`❌ Order ${orderId1} not found`);
    process.exit(1);
  }

  if (!order2) {
    console.error(`❌ Order ${orderId2} not found`);
    process.exit(1);
  }

  console.log(`Order 1 details:`);
  console.log(`  - ID: ${order1.id}`);
  console.log(`  - Side: ${order1.side}`);
  console.log(`  - Outcome: ${order1.outcome}`);
  console.log(`  - Price: ${order1.price}`);
  console.log(`  - Amount: ${order1.amount}`);
  console.log(`  - Status: ${order1.status}`);
  console.log(`  - Token ID: ${order1.tokenId}`);
  console.log('');

  console.log(`Order 2 details:`);
  console.log(`  - ID: ${order2.id}`);
  console.log(`  - Side: ${order2.side}`);
  console.log(`  - Outcome: ${order2.outcome}`);
  console.log(`  - Price: ${order2.price}`);
  console.log(`  - Amount: ${order2.amount}`);
  console.log(`  - Status: ${order2.status}`);
  console.log(`  - Token ID: ${order2.tokenId}`);
  console.log('');

  // Validate that these are complementary matches (BUY YES + BUY NO)
  const isComplementaryMatch = (
    order1.side === OrderSide.BUY &&
    order2.side === OrderSide.BUY &&
    order1.outcome !== order2.outcome &&
    order1.price + order2.price === 1.0
  );

  if (!isComplementaryMatch) {
    console.error('❌ These orders are not a valid complementary match (BUY YES @ price + BUY NO @ (1-price))');
    console.error(`   Order 1: ${order1.side} ${order1.outcome} @ ${order1.price}`);
    console.error(`   Order 2: ${order2.side} ${order2.outcome} @ ${order2.price}`);
    console.error(`   Price sum: ${order1.price + order2.price}`);
    process.exit(1);
  }

  console.log('✓ Complementary match validated');
  console.log('');

  // Determine which is taker and which is maker (use the newer order as taker)
  const takerOrder = order1.createdAt > order2.createdAt ? order1 : order2;
  const makerOrder = order1.createdAt > order2.createdAt ? order2 : order1;

  console.log(`Taker order: ${takerOrder.id} (newer, created at ${new Date(takerOrder.createdAt).toISOString()})`);
  console.log(`Maker order: ${makerOrder.id} (older, created at ${new Date(makerOrder.createdAt).toISOString()})`);
  console.log('');

  // Calculate fill amounts
  const fillAmount = Math.min(takerOrder.amount, makerOrder.amount);
  
  // For complementary matching:
  // - Taker BUY YES: makerAmount is USDC (price * tokens), takerAmount is YES tokens
  // - Taker BUY NO: makerAmount is USDC (price * tokens), takerAmount is NO tokens
  // - Both deposit USDC collateral and receive their respective tokens
  
  const takerFillInMakerTerms = Math.floor(fillAmount * takerOrder.price).toString();
  const takerReceiveInTakerTerms = fillAmount.toString();
  const makerFillInMakerTerms = Math.floor(fillAmount * makerOrder.price).toString();

  console.log('Settlement parameters:');
  console.log(`  - Fill amount: ${fillAmount} tokens`);
  console.log(`  - Taker fill (USDC): ${takerFillInMakerTerms}`);
  console.log(`  - Taker receive (tokens): ${takerReceiveInTakerTerms}`);
  console.log(`  - Maker fill (USDC): ${makerFillInMakerTerms}`);
  console.log('');

  // Create settlement job
  const settlementJob: SettlementJob = {
    takerOrder,
    makerOrders: [makerOrder],
    takerFillAmount: takerFillInMakerTerms,
    takerReceiveAmount: takerReceiveInTakerTerms,
    makerFillAmounts: [makerFillInMakerTerms],
    takerFeeAmount: '0',
    makerFeeAmounts: ['0'],
    marketId: takerOrder.marketId,
  };

  // Execute settlement
  console.log('Executing on-chain settlement...');
  console.log('');

  try {
    const executor = new SettlementExecutor();
    const txHash = await executor.settle(settlementJob);
    
    console.log('');
    console.log('='.repeat(80));
    console.log('✅ SETTLEMENT SUCCESSFUL');
    console.log('='.repeat(80));
    console.log(`Transaction hash: ${txHash}`);
    console.log('');
    
    // Mark orders as settled on-chain
    orderBookService.markOrderSettled(takerOrder.id, txHash);
    orderBookService.markOrderSettled(makerOrder.id, txHash);
    
    console.log('Orders have been settled on-chain and marked as settled.');
    console.log('These orders will NOT be retried in future settlement attempts.');
    console.log('');
    
    return txHash;
  } catch (error: any) {
    console.log('');
    console.log('='.repeat(80));
    console.log('❌ SETTLEMENT FAILED');
    console.log('='.repeat(80));
    console.error('Error:', error.message || error);
    console.log('');
    
    if (error.message?.includes('token')) {
      console.log('💡 Possible reasons:');
      console.log('   1. Token IDs not registered on CTF Exchange contract');
      console.log('   2. Insufficient token balances');
      console.log('   3. Missing token approvals');
    }
    
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length !== 2) {
  console.error('Usage: npx ts-node scripts/retry-settlement.ts <order-id-1> <order-id-2>');
  console.error('');
  console.error('Example:');
  console.error('  npx ts-node scripts/retry-settlement.ts 1768800866174-3d4a0ebb 1768800974569-a085abda');
  process.exit(1);
}

const [orderId1, orderId2] = args;

retrySettlement(orderId1, orderId2)
  .then(() => {
    console.log('Done.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
