/**
 * Test Settlement Retry Service
 * 
 * This script tests the settlement retry service to verify it correctly
 * identifies orders that need retry vs those already settled on-chain.
 */

import { SettlementRetryService } from '../src/services/settlementRetryService';

async function testRetryService() {
  console.log('='.repeat(80));
  console.log('TESTING SETTLEMENT RETRY SERVICE');
  console.log('='.repeat(80));
  console.log('');
  
  console.log('Looking for unprocessed matches...');
  console.log('');
  
  const matches = SettlementRetryService.findUnprocessedMatches();
  
  console.log(`Found ${matches.length} unprocessed match(es)`);
  console.log('');
  
  if (matches.length > 0) {
    console.log('Unprocessed matches:');
    matches.forEach((match, index) => {
      console.log(`  ${index + 1}. ${match.order1.id} (${match.order1.side} ${match.order1.outcome} @ ${match.order1.price})`);
      console.log(`     ↔ ${match.order2.id} (${match.order2.side} ${match.order2.outcome} @ ${match.order2.price})`);
      console.log(`     Settled: order1=${!!match.order1.settledOnChain}, order2=${!!match.order2.settledOnChain}`);
    });
    console.log('');
  } else {
    console.log('✅ No unprocessed matches found.');
    console.log('   All matched orders have either:');
    console.log('   - Been settled on-chain (settledOnChain = true)');
    console.log('   - Have a settlement transaction hash');
    console.log('   - Are not FULLY_FILLED yet');
    console.log('');
  }
  
  console.log('='.repeat(80));
  console.log('TEST COMPLETE');
  console.log('='.repeat(80));
}

testRetryService()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
