/**
 * CTF (Conditional Token Framework) calculation utilities
 * Calculates tokenIds for conditional tokens based on conditionId and outcome index
 * Reference: https://gist.github.com/L-Kov/950bce141a9d1aa1ed3b1cfce6d30217
 */

import { solidityPacked, keccak256 } from 'ethers';
import BN from 'bn.js';

// Utility function to replicate solidityKeccak256 behavior in ethers v6
function solidityKeccak256(types: string[], values: any[]): string {
  return keccak256(solidityPacked(types, values));
}

const altBN128P = new BN('21888242871839275222246405745257275088696311157297823662689037894645226208583');
const altBN128PRed = BN.red(altBN128P);
const altBN128B = new BN(3).toRed(altBN128PRed);
const zeroPRed = new BN(0).toRed(altBN128PRed);
const onePRed = new BN(1).toRed(altBN128PRed);
const twoPRed = new BN(2).toRed(altBN128PRed);
const fourPRed = new BN(4).toRed(altBN128PRed);
const oddToggle = new BN(1).ushln(254);

/**
 * Calculate collectionId from conditionId and outcome index
 * For a binary market: indexSet 1 = YES, indexSet 2 = NO
 */
export function getCollectionId(conditionId: string, indexSet: number): string {
  const initHash = solidityKeccak256(['bytes32', 'uint256'], [conditionId, indexSet]);

  const odd = '89abcdef'.includes(initHash[2]);
  const x = new BN(initHash.slice(2), 'hex').toRed(altBN128PRed);

  let y: any;
  let yy: any;
  do {
    x.redIAdd(onePRed);
    yy = x.redSqr();
    yy.redIMul(x);
    yy = yy.mod(altBN128P);
    yy.redIAdd(altBN128B);
    y = yy.redSqrt();
  } while (!y.redSqr().eq(yy));

  const ecHash = x.fromRed();
  if (odd) ecHash.ixor(oddToggle);
  return `0x${ecHash.toString(16, 64)}`;
}

/**
 * Calculate positionId from collateral token address and collectionId
 * This is the tokenId used in ERC1155 contracts
 */
export function getPositionId(collateralTokenAddress: string, collectionId: string): string {
  return solidityKeccak256(['address', 'uint256'], [collateralTokenAddress, collectionId]);
}

/**
 * Get tokenId for a specific outcome in a binary market
 * For binary outcomes (YES/NO):
 * - outcome 0 (YES): indexSet = 1
 * - outcome 1 (NO): indexSet = 2
 */
export function getTokenIdForOutcome(
  conditionId: string,
  collateralTokenAddress: string,
  outcome: 'YES' | 'NO' | 0 | 1
): string {
  // Convert outcome to indexSet (1 = YES, 2 = NO)
  const indexSet = outcome === 'YES' || outcome === 0 ? 1 : 2;

  // Get collectionId for this outcome
  const collectionId = getCollectionId(conditionId, indexSet);

  // Get tokenId (positionId) from collectionId and collateral token
  const tokenId = getPositionId(collateralTokenAddress, collectionId);

  return tokenId;
}

/**
 * Get both YES and NO tokenIds for a market
 */
export function getTokenIdsForMarket(
  conditionId: string,
  collateralTokenAddress: string
): { yesTokenId: string; noTokenId: string } {
  return {
    yesTokenId: getTokenIdForOutcome(conditionId, collateralTokenAddress, 'YES'),
    noTokenId: getTokenIdForOutcome(conditionId, collateralTokenAddress, 'NO'),
  };
}
