/**
 * Example script for creating a market using the admin API
 * 
 * Usage:
 *   ts-node examples/createMarket.ts
 */

import axios from 'axios';

const BACKEND_URL = 'http://localhost:3001';

async function createMarket() {
  try {
    console.log('Creating market...\n');

    // Calculate end time (July 31, 2026 UTC)
    const endTime = Math.floor(new Date('2026-07-31T23:59:59Z').getTime() / 1000);

    const marketData = {
      question: "Will BTC hit $150K by end of July 31, 2026?",
      description: "This market will resolve to 'Yes' if Bitcoin's price reaches $150,000 USD at any point before or on July 31, 2026, 11:59 PM UTC. The price will be determined by the average of major cryptocurrency exchanges (Coinbase, Binance, Kraken). Otherwise, it resolves to 'No'.",
      category: "Crypto",
      resolutionSource: "https://coinmarketcap.com",
      endTime: endTime,
      image: "₿"
    };

    console.log('Market data:', JSON.stringify(marketData, null, 2));
    console.log('\nSending request to:', `${BACKEND_URL}/api/admin/create-market`);
    console.log('\n⏳ This may take 15-30 seconds as it submits a transaction to the blockchain...\n');

    const response = await axios.post(`${BACKEND_URL}/api/admin/create-market`, marketData, {
      timeout: 60000, // 60 second timeout
    });

    if (response.data.success) {
      console.log('✅ Market created successfully!\n');
      console.log('Question ID:', response.data.questionId);
      console.log('Condition ID:', response.data.conditionId);
      console.log('\nToken IDs:');
      console.log('  YES Token:', response.data.tokenIds.yesTokenId);
      console.log('  NO Token:', response.data.tokenIds.noTokenId);
      console.log('\nTransaction Hash:', response.data.market.txHash);
      console.log('\nView on Polygon Scan:');
      console.log(`https://amoy.polygonscan.com/tx/${response.data.market.txHash}`);
    } else {
      console.error('❌ Market creation failed:', response.data.error);
    }
  } catch (error: any) {
    console.error('\n❌ Error creating market:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error:', error.response.data?.error || error.response.data);
    } else if (error.code === 'ECONNABORTED') {
      console.error('Request timed out. The transaction may still be processing.');
    } else {
      console.error(error.message);
    }
  }
}

async function getAdminInfo() {
  try {
    console.log('\nFetching admin info...\n');
    const response = await axios.get(`${BACKEND_URL}/api/admin/info`);
    
    if (response.data.success) {
      console.log('Admin Address:', response.data.adminAddress);
      console.log('\nContract Addresses:');
      console.log('  UMA Adapter:', response.data.config.umaAdapter);
      console.log('  Conditional Tokens:', response.data.config.conditionalTokens);
      console.log('  Reward Token:', response.data.config.rewardToken);
    }
  } catch (error: any) {
    console.error('Error getting admin info:', error.response?.data || error.message);
  }
}

// Run the example
(async () => {
  console.log('='.repeat(60));
  console.log('Polymarket Admin API - Create Market Example');
  console.log('='.repeat(60));

  // First, get admin info to verify configuration
  await getAdminInfo();

  console.log('\n' + '='.repeat(60));
  
  // Then create a market
  await createMarket();

  console.log('\n' + '='.repeat(60));
})();
