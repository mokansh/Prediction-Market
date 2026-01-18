const fs = require('fs');
const path = require('path');
const ethers = require('ethers');

const marketsFile = path.join(__dirname, '../.data/markets.json');
const collateralToken = '0x7006b5a13d347dab68b9c2caabee2e6bc11296fd';

function getCollectionId(parentCollectionId, conditionId, outcomeIndex) {
  const indexSet = 1 << (outcomeIndex - 1);
  return ethers.keccak256(
    ethers.solidityPacked(
      ['bytes32', 'bytes32', 'uint256'],
      [parentCollectionId, conditionId, indexSet]
    )
  );
}

function getPositionId(collateralTokenAddr, collectionId) {
  return ethers.keccak256(
    ethers.solidityPacked(['address', 'bytes32'], [collateralTokenAddr, collectionId])
  );
}

// Read markets
const markets = JSON.parse(fs.readFileSync(marketsFile, 'utf8'));

console.log(`Recalculating token IDs for ${markets.length} markets...`);

markets.forEach((market, idx) => {
  const conditionId = market.conditionId || market.id;
  const parentCollectionId = ethers.ZeroHash;
  
  const yesCollectionId = getCollectionId(parentCollectionId, conditionId, 1);
  const noCollectionId = getCollectionId(parentCollectionId, conditionId, 2);
  
  const yesTokenId = getPositionId(collateralToken, yesCollectionId);
  const noTokenId = getPositionId(collateralToken, noCollectionId);
  
  console.log(`\nMarket ${idx + 1}: ${market.question}`);
  console.log(`  Old YES: ${market.tokenIds.yesTokenId}`);
  console.log(`  New YES: ${yesTokenId}`);
  console.log(`  Old NO: ${market.tokenIds.noTokenId}`);
  console.log(`  New NO: ${noTokenId}`);
  
  market.tokenIds.yesTokenId = yesTokenId;
  market.tokenIds.noTokenId = noTokenId;
});

// Save updated markets
fs.writeFileSync(marketsFile, JSON.stringify(markets, null, 2));
console.log(`\n✅ Updated ${markets.length} markets in ${marketsFile}`);
