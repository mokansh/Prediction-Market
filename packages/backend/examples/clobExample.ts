/**
 * CLOB Order Matching Example
 * 
 * This script demonstrates the order matching engine and collateralization rules
 * 
 * Usage:
 *   ts-node examples/clobExample.ts
 */

import axios from 'axios';

const BACKEND_URL = 'http://localhost:3001';

// Test addresses
const MAKER1 = '0x1111111111111111111111111111111111111111';
const MAKER2 = '0x2222222222222222222222222222222222222222';
const MAKER3 = '0x3333333333333333333333333333333333333333';
const MAKER4 = '0x4444444444444444444444444444444444444444';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function placeOrder(
  marketId: string,
  maker: string,
  side: 'BUY' | 'SELL',
  outcome: 'YES' | 'NO',
  amount: number,
  price: number
) {
  try {
    console.log(`\n📝 Placing ${side} order for ${outcome} @ $${price}`);
    
    const response = await axios.post(`${BACKEND_URL}/api/orders/place`, {
      marketId,
      makerAddress: maker,
      side,
      outcome,
      amount,
      price,
      expiresIn: 60000, // 1 minute
    });

    if (response.data.success) {
      console.log(`✅ Order placed: ${response.data.order.id}`);
      if (response.data.matches > 0) {
        console.log(`🎯 Matched with ${response.data.matches} order(s)`);
      }
      return response.data.order;
    } else {
      console.log(`❌ Failed: ${response.data.error}`);
      return null;
    }
  } catch (error: any) {
    console.error('❌ Error placing order:', error.response?.data?.error || error.message);
    return null;
  }
}

async function getMarketPrices(marketId: string) {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/orders/market/${marketId}/prices`);
    
    if (response.data.success) {
      const { prices, collateralizationCheck } = response.data;
      
      console.log('\n💹 Market Prices:');
      console.log(`  YES: $${prices.yes.midPrice.toFixed(3)} (bid: ${prices.yes.bestBid.toFixed(3)}, ask: ${prices.yes.bestAsk.toFixed(3)})`);
      console.log(`  NO:  $${prices.no.midPrice.toFixed(3)} (bid: ${prices.no.bestBid.toFixed(3)}, ask: ${prices.no.bestAsk.toFixed(3)})`);
      console.log(`  Collateralization: ${collateralizationCheck.sum.toFixed(3)} (${collateralizationCheck.isValid ? '✅ Valid' : '❌ Invalid'})`);
      
      return prices;
    }
  } catch (error: any) {
    console.error('Error fetching prices:', error.message);
  }
}

async function getOrderbook(marketId: string, outcome?: 'YES' | 'NO') {
  try {
    const url = outcome
      ? `${BACKEND_URL}/api/orders/market/${marketId}?outcome=${outcome}`
      : `${BACKEND_URL}/api/orders/market/${marketId}`;
    
    const response = await axios.get(url);
    
    if (response.data.success) {
      return response.data;
    }
  } catch (error: any) {
    console.error('Error fetching orderbook:', error.message);
  }
}

async function getUserOrders(address: string) {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/orders/user/${address}`);
    
    if (response.data.success) {
      return response.data.orders;
    }
  } catch (error: any) {
    console.error('Error fetching user orders:', error.message);
  }
}

async function runScenario1_BasicMatching() {
  console.log('\n' + '='.repeat(60));
  console.log('Scenario 1: Basic Order Matching');
  console.log('Rule: 1 YES + 1 NO = $1.00');
  console.log('='.repeat(60));

  const marketId = 'market-basic-test';

  // MAKER1 buys 100 YES @ $0.65
  await placeOrder(marketId, MAKER1, 'BUY', 'YES', 100, 0.65);
  await sleep(500);

  // MAKER2 sells 100 YES @ $0.65 (should match!)
  const order2 = await placeOrder(marketId, MAKER2, 'SELL', 'YES', 100, 0.65);
  await sleep(500);

  // Check prices after matching
  await getMarketPrices(marketId);

  // MAKER3 buys 50 NO @ $0.35 (complementary to YES @ $0.65)
  await placeOrder(marketId, MAKER3, 'BUY', 'NO', 50, 0.35);
  await sleep(500);

  // Check final prices
  await getMarketPrices(marketId);
  
  console.log('\n✅ Scenario 1 Complete');
}

async function runScenario2_PartialFill() {
  console.log('\n' + '='.repeat(60));
  console.log('Scenario 2: Partial Order Fill');
  console.log('='.repeat(60));

  const marketId = 'market-partial-test';

  // MAKER1 buys 100 YES @ $0.60
  await placeOrder(marketId, MAKER1, 'BUY', 'YES', 100, 0.60);
  await sleep(500);

  // MAKER2 sells only 60 YES @ $0.55 (less than buy order)
  await placeOrder(marketId, MAKER2, 'SELL', 'YES', 60, 0.55);
  await sleep(500);

  console.log('\nCheck remaining orders:');
  const orders = await getUserOrders(MAKER1);
  console.log('MAKER1 orders:', orders?.map(o => ({
    id: o.id.substring(0, 8),
    side: o.side,
    amount: o.amount,
    filled: o.filledAmount,
    remaining: o.remainingAmount,
    status: o.status
  })));

  // MAKER3 sells remaining 40 YES @ $0.60
  await placeOrder(marketId, MAKER3, 'SELL', 'YES', 40, 0.60);
  await sleep(500);

  await getMarketPrices(marketId);
  
  console.log('\n✅ Scenario 2 Complete');
}

async function runScenario3_Collateralization() {
  console.log('\n' + '='.repeat(60));
  console.log('Scenario 3: Collateralization Check');
  console.log('YES Price + NO Price must = $1.00');
  console.log('='.repeat(60));

  const marketId = 'market-collateral-test';

  // Place balanced orders
  await placeOrder(marketId, MAKER1, 'BUY', 'YES', 100, 0.60);
  await sleep(300);

  await placeOrder(marketId, MAKER2, 'SELL', 'YES', 100, 0.60);
  await sleep(300);

  await placeOrder(marketId, MAKER3, 'BUY', 'NO', 100, 0.40);
  await sleep(300);

  await placeOrder(marketId, MAKER4, 'SELL', 'NO', 100, 0.40);
  await sleep(300);

  const prices = await getMarketPrices(marketId);

  // Verify collateralization
  if (prices) {
    const yesPrice = prices.yes.midPrice;
    const noPrice = prices.no.midPrice;
    const sum = yesPrice + noPrice;
    
    console.log(`\n🔍 Collateralization Analysis:`);
    console.log(`   YES Price: $${yesPrice.toFixed(3)}`);
    console.log(`   NO Price:  $${noPrice.toFixed(3)}`);
    console.log(`   Sum:       $${sum.toFixed(3)}`);
    console.log(`   Status:    ${Math.abs(sum - 1.0) < 0.05 ? '✅ VALID' : '❌ INVALID'}`);
  }

  console.log('\n✅ Scenario 3 Complete');
}

async function runScenario4_PriceImprovement() {
  console.log('\n' + '='.repeat(60));
  console.log('Scenario 4: Price Improvement for Takers');
  console.log('Takers get better prices than their orders');
  console.log('='.repeat(60));

  const marketId = 'market-improvement-test';

  // MAKER1 sells YES @ $0.62 (willing to sell at this price)
  const makerOrder = await placeOrder(marketId, MAKER1, 'SELL', 'YES', 100, 0.62);
  await sleep(500);

  // MAKER2 buys YES @ $0.65 (willing to pay this much)
  // Should execute at $0.62 (better for MAKER2!)
  const takerOrder = await placeOrder(marketId, MAKER2, 'BUY', 'YES', 100, 0.65);
  await sleep(500);

  console.log('\n📊 Price Improvement Analysis:');
  if (makerOrder && takerOrder) {
    console.log(`  Maker (SELL) offered:  $${makerOrder.price.toFixed(3)}`);
    console.log(`  Taker (BUY) willing:   $${takerOrder.price.toFixed(3)}`);
    console.log(`  Execution should be:   $${Math.min(makerOrder.price, takerOrder.price).toFixed(3)}`);
    console.log(`  Taker saves:           $${(takerOrder.price - Math.min(makerOrder.price, takerOrder.price)).toFixed(3)} per token`);
  }

  console.log('\n✅ Scenario 4 Complete');
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('CLOB (Central Limit Order Book) Examples');
  console.log('='.repeat(60));
  console.log('Backend: ' + BACKEND_URL);

  try {
    // Check backend health
    const health = await axios.get(`${BACKEND_URL}/health`);
    console.log(`✅ Backend Status: ${health.data.status}`);
  } catch (error) {
    console.error('❌ Backend not reachable. Make sure backend is running:');
    console.error('   npm run dev');
    process.exit(1);
  }

  // Run scenarios
  await runScenario1_BasicMatching();
  await sleep(1000);

  await runScenario2_PartialFill();
  await sleep(1000);

  await runScenario3_Collateralization();
  await sleep(1000);

  await runScenario4_PriceImprovement();

  console.log('\n' + '='.repeat(60));
  console.log('✅ All scenarios completed!');
  console.log('='.repeat(60));
}

main().catch(console.error);
