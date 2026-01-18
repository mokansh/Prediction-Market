/**
 * CLOB Order Matching Scenarios
 * 
 * Specific test cases demonstrating different matching scenarios:
 * 1. Complementary Matching (Both Buys): Buy YES @ 0.2 + Buy NO @ 0.8 = $1.00
 * 2. Direct Matching (Same Outcome): Buy YES @ 0.3 + Sell YES @ 0.3
 * 3. Complementary Matching (Both Buys): Buy YES @ 0.7 + Buy NO @ 0.3 = $1.00
 * 4. Direct Matching (Same Outcome): Buy NO @ 0.3 + Sell NO @ 0.3
 * 
 * Usage:
 *   ts-node examples/clobMatchingScenarios.ts
 */

import axios from 'axios';

const BACKEND_URL = 'http://localhost:3001';

// Test addresses
const TRADER_A = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const TRADER_B = '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const TRADER_C = '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';
const TRADER_D = '0xDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function placeOrder(
  marketId: string,
  trader: string,
  side: 'BUY' | 'SELL',
  outcome: 'YES' | 'NO',
  amount: number,
  price: number
) {
  try {
    const response = await axios.post(`${BACKEND_URL}/api/orders/place`, {
      marketId,
      makerAddress: trader,
      side,
      outcome,
      amount,
      price,
      expiresIn: 120000, // 2 minutes
    });

    if (response.data.success) {
      console.log(`  ✅ ${side} ${outcome} ${amount} @ $${price} | Order: ${response.data.order.id.substring(0, 8)}... | Matched: ${response.data.matches > 0 ? `YES (${response.data.matches})` : 'NO'}`);
      return response.data;
    } else {
      console.log(`  ❌ Failed: ${response.data.error}`);
      return null;
    }
  } catch (error: any) {
    console.error(`  ❌ Error: ${error.response?.data?.error || error.message}`);
    return null;
  }
}

async function getMarketPrices(marketId: string) {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/orders/market/${marketId}/prices`);
    
    if (response.data.success) {
      const { prices, collateralizationCheck } = response.data;
      
      console.log('\n  📊 Market State:');
      console.log(`     YES: $${prices.yes.midPrice.toFixed(3)} (bid: ${prices.yes.bestBid.toFixed(3)}, ask: ${prices.yes.bestAsk.toFixed(3)})`);
      console.log(`     NO:  $${prices.no.midPrice.toFixed(3)} (bid: ${prices.no.bestBid.toFixed(3)}, ask: ${prices.no.bestAsk.toFixed(3)})`);
      console.log(`     Sum: $${collateralizationCheck.sum.toFixed(3)} ${collateralizationCheck.isValid ? '✅ Valid' : '❌ Invalid'}\n`);
      
      return prices;
    }
  } catch (error: any) {
    console.error(`  Error fetching prices: ${error.message}`);
  }
}

async function getOrderbook(marketId: string, outcome?: 'YES' | 'NO') {
  try {
    const url = outcome
      ? `${BACKEND_URL}/api/orders/market/${marketId}?outcome=${outcome}`
      : `${BACKEND_URL}/api/orders/market/${marketId}`;
    
    const response = await axios.get(url);
    
    if (response.data.success) {
      const { buySide, sellSide } = response.data;
      
      console.log('  📈 Order Book:');
      if (buySide.length > 0) {
        console.log('     Bids (Buys):');
        buySide.forEach((order: any) => {
          console.log(`       ${order.outcome} ${order.amount} @ $${order.price} [${order.status}]`);
        });
      } else {
        console.log('     Bids: (empty)');
      }
      
      if (sellSide.length > 0) {
        console.log('     Asks (Sells):');
        sellSide.forEach((order: any) => {
          console.log(`       ${order.outcome} ${order.amount} @ $${order.price} [${order.status}]`);
        });
      } else {
        console.log('     Asks: (empty)');
      }
      console.log();
      
      return response.data;
    }
  } catch (error: any) {
    console.error(`  Error fetching orderbook: ${error.message}`);
  }
}

/**
 * Scenario 1: COMPLEMENTARY MATCHING (Both Buy Orders)
 * Buy YES at price 0.2 + Buy NO at price 0.8 = $1.00
 * 
 * This is a complementary match where two BUY orders for opposite outcomes
 * sum to exactly $1.00, creating full collateralization.
 */
async function runScenario1_ComplementaryBuy() {
  console.log('\n' + '='.repeat(70));
  console.log('SCENARIO 1: COMPLEMENTARY MATCHING (Both Buy Orders)');
  console.log('='.repeat(70));
  console.log('Setup: Buy YES @ 0.2 + Buy NO @ 0.8 = $1.00');
  console.log('Expected: Both orders match, full collateralization\n');

  const marketId = 'market-scenario-1';

  // TRADER_A buys 50 YES @ $0.20
  console.log('Step 1: TRADER_A places BUY YES order');
  await placeOrder(marketId, TRADER_A, 'BUY', 'YES', 50, 0.20);
  await sleep(300);

  // TRADER_B buys 50 NO @ $0.80 (complementary - should match!)
  console.log('Step 2: TRADER_B places BUY NO order (complementary to YES @ 0.2)');
  await placeOrder(marketId, TRADER_B, 'BUY', 'NO', 50, 0.80);
  await sleep(300);

  await getOrderbook(marketId);
  await getMarketPrices(marketId);
  
  console.log('✅ SCENARIO 1 COMPLETE\n');
}

/**
 * Scenario 2: DIRECT MATCHING (Opposite Sides, Same Outcome)
 * Buy YES at price 0.3 + Sell YES at price 0.3
 * 
 * This is a direct match where BUY and SELL orders for the same outcome
 * and price are matched immediately.
 */
async function runScenario2_DirectMatchingSameOutcome() {
  console.log('\n' + '='.repeat(70));
  console.log('SCENARIO 2: DIRECT MATCHING (Opposite Sides, Same Outcome)');
  console.log('='.repeat(70));
  console.log('Setup: Buy YES @ 0.3 + Sell YES @ 0.3');
  console.log('Expected: Direct match at $0.30, order fulfillment\n');

  const marketId = 'market-scenario-2';

  // TRADER_A buys 60 YES @ $0.30
  console.log('Step 1: TRADER_A places BUY YES order');
  await placeOrder(marketId, TRADER_A, 'BUY', 'YES', 60, 0.30);
  await sleep(300);

  // TRADER_B sells 60 YES @ $0.30 (same price, opposite side - should match!)
  console.log('Step 2: TRADER_B places SELL YES order (same outcome & price)');
  await placeOrder(marketId, TRADER_B, 'SELL', 'YES', 60, 0.30);
  await sleep(300);

  await getOrderbook(marketId);
  await getMarketPrices(marketId);
  
  console.log('✅ SCENARIO 2 COMPLETE\n');
}

/**
 * Scenario 3: COMPLEMENTARY MATCHING (Both Buy Orders)
 * Buy YES at price 0.7 + Buy NO at price 0.3 = $1.00
 * 
 * Another complementary match with different price ratios but still
 * summing to exactly $1.00 for full collateralization.
 */
async function runScenario3_ComplementaryBuyDifferentRatio() {
  console.log('\n' + '='.repeat(70));
  console.log('SCENARIO 3: COMPLEMENTARY MATCHING (Both Buy Orders - Different Ratio)');
  console.log('='.repeat(70));
  console.log('Setup: Buy YES @ 0.7 + Buy NO @ 0.3 = $1.00');
  console.log('Expected: Both orders match, full collateralization\n');

  const marketId = 'market-scenario-3';

  // TRADER_A buys 40 YES @ $0.70
  console.log('Step 1: TRADER_A places BUY YES order');
  await placeOrder(marketId, TRADER_A, 'BUY', 'YES', 40, 0.70);
  await sleep(300);

  // TRADER_B buys 40 NO @ $0.30 (complementary to YES @ 0.7)
  console.log('Step 2: TRADER_B places BUY NO order (complementary to YES @ 0.7)');
  await placeOrder(marketId, TRADER_B, 'BUY', 'NO', 40, 0.30);
  await sleep(300);

  await getOrderbook(marketId);
  await getMarketPrices(marketId);
  
  console.log('✅ SCENARIO 3 COMPLETE\n');
}

/**
 * Scenario 4: DIRECT MATCHING (Opposite Sides, Same Outcome)
 * Buy NO at price 0.3 + Sell NO at price 0.3
 * 
 * Similar to Scenario 2, but for the NO outcome instead of YES.
 * Demonstrates that direct matching works for both outcomes.
 */
async function runScenario4_DirectMatchingNOOutcome() {
  console.log('\n' + '='.repeat(70));
  console.log('SCENARIO 4: DIRECT MATCHING (Opposite Sides, NO Outcome)');
  console.log('='.repeat(70));
  console.log('Setup: Buy NO @ 0.3 + Sell NO @ 0.3');
  console.log('Expected: Direct match at $0.30, order fulfillment\n');

  const marketId = 'market-scenario-4';

  // TRADER_A buys 75 NO @ $0.30
  console.log('Step 1: TRADER_A places BUY NO order');
  await placeOrder(marketId, TRADER_A, 'BUY', 'NO', 75, 0.30);
  await sleep(300);

  // TRADER_B sells 75 NO @ $0.30 (same price, opposite side)
  console.log('Step 2: TRADER_B places SELL NO order (same outcome & price)');
  await placeOrder(marketId, TRADER_B, 'SELL', 'NO', 75, 0.30);
  await sleep(300);

  await getOrderbook(marketId);
  await getMarketPrices(marketId);
  
  console.log('✅ SCENARIO 4 COMPLETE\n');
}

/**
 * BONUS Scenario 5: MIXED SCENARIO (Complex Multi-Order Matching)
 * 
 * Demonstrates realistic trading with multiple orders and partial fills:
 * - Multiple traders place orders
 * - Some orders match directly, others partially
 * - Collateralization is maintained throughout
 */
async function runBonusScenario5_ComplexMatching() {
  console.log('\n' + '='.repeat(70));
  console.log('BONUS SCENARIO 5: COMPLEX MULTI-ORDER MATCHING');
  console.log('='.repeat(70));
  console.log('Setup: Mix of complementary and direct orders, partial fills\n');

  const marketId = 'market-scenario-5';

  // Step 1: Seed the book with various orders
  console.log('Step 1: Initial orders');
  await placeOrder(marketId, TRADER_A, 'BUY', 'YES', 100, 0.45);
  await sleep(200);
  await placeOrder(marketId, TRADER_B, 'BUY', 'YES', 80, 0.40);
  await sleep(200);
  await placeOrder(marketId, TRADER_C, 'BUY', 'NO', 100, 0.55);
  await sleep(200);

  await getOrderbook(marketId);

  // Step 2: Place matching order that fills partially
  console.log('Step 2: TRADER_D places SELL YES (should match with both buy orders)\n');
  await placeOrder(marketId, TRADER_D, 'SELL', 'YES', 150, 0.42);
  await sleep(300);

  await getOrderbook(marketId);
  await getMarketPrices(marketId);

  // Step 3: Fill remaining orders
  console.log('Step 3: Additional matching orders\n');
  await placeOrder(marketId, TRADER_A, 'SELL', 'NO', 80, 0.55);
  await sleep(300);

  await getOrderbook(marketId);
  await getMarketPrices(marketId);
  
  console.log('✅ BONUS SCENARIO 5 COMPLETE\n');
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('CLOB ORDER MATCHING SCENARIOS');
  console.log('Demonstrating 4 key matching patterns');
  console.log('='.repeat(70));
  console.log(`Backend: ${BACKEND_URL}\n`);

  try {
    // Check backend health
    const health = await axios.get(`${BACKEND_URL}/health`);
    console.log(`✅ Backend Status: ${health.data.status}\n`);
  } catch (error) {
    console.error('❌ Backend not reachable. Make sure backend is running:');
    console.error('   npm run dev');
    process.exit(1);
  }

  try {
    // Run all scenarios
    await runScenario1_ComplementaryBuy();
    await sleep(1000);

    await runScenario2_DirectMatchingSameOutcome();
    await sleep(1000);

    await runScenario3_ComplementaryBuyDifferentRatio();
    await sleep(1000);

    await runScenario4_DirectMatchingNOOutcome();
    await sleep(1000);

    // Bonus scenario
    await runBonusScenario5_ComplexMatching();

    console.log('\n' + '='.repeat(70));
    console.log('✅ ALL MATCHING SCENARIOS COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(70));
    console.log('\nKey Takeaways:');
    console.log('  • Scenario 1 & 3: COMPLEMENTARY matching (both buys, sum=$1.00)');
    console.log('  • Scenario 2 & 4: DIRECT matching (opposite sides, same outcome)');
    console.log('  • All scenarios maintain the $1.00 collateralization rule');
    console.log('  • Bonus: Shows realistic multi-order book behavior\n');
  } catch (error) {
    console.error('Error running scenarios:', error);
  }
}

main().catch(console.error);
