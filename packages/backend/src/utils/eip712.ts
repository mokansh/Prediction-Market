import { ethers } from 'ethers';

/**
 * EIP712 signature verification for Polymarket CTF Exchange
 * Matches Polymarket's exact domain and order structure
 */

// Polymarket CTF Exchange contract on Polygon
export const POLYMARKET_DOMAIN = {
  name: 'Polymarket CTF Exchange',
  version: '1',
  chainId: 80002, // Polygon Amoy testnet
  verifyingContract: '0x605921c2eC6E761945bEEA78D46b81f045dc0399',
};

// Order struct type definition matching Polymarket
export const ORDER_TYPES = {
  Order: [
    { name: 'salt', type: 'uint256' },
    { name: 'maker', type: 'address' },
    { name: 'signer', type: 'address' },
    { name: 'taker', type: 'address' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'makerAmount', type: 'uint256' },
    { name: 'takerAmount', type: 'uint256' },
    { name: 'expiration', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'feeRateBps', type: 'uint256' },
    { name: 'side', type: 'uint8' },
    { name: 'signatureType', type: 'uint8' },
  ],
};

/**
 * Order message for EIP712 signing
 * Represents the actual data being signed
 */
export interface EIP712OrderMessage {
  salt: string; // uint256
  maker: string; // address
  signer: string; // address - who can sign on behalf of maker
  taker: string; // address - specific taker or 0x00...00 for anyone
  tokenId: string; // uint256 - conditional token ID
  makerAmount: string; // uint256 - amount offered by maker
  takerAmount: string; // uint256 - amount required from taker
  expiration: string; // uint256 - when order expires (0 = no expiry)
  nonce: string; // uint256 - order nonce for replay protection
  feeRateBps: string; // uint256 - fee rate in basis points
  side: number; // uint8 - 0 = buy, 1 = sell
  signatureType: number; // uint8 - signature scheme
}

/**
 * Signed order including the EIP712 signature
 */
export interface SignedOrder extends EIP712OrderMessage {
  signature: string;
  signingHash: string; // The EIP712 hash that was signed
}

/**
 * Creates an EIP712 message hash for an order
 * This can be signed by a wallet using eth_signTypedData
 */
export function createOrderHash(message: EIP712OrderMessage): string {
  // ethers v6 expects only primary types here (no EIP712Domain key)
  const hash = ethers.TypedDataEncoder.hash(POLYMARKET_DOMAIN, { Order: ORDER_TYPES.Order }, message);
  return hash;
}

/**
 * Verifies that a signature was created for the given order message
 * and that it was signed by the expected signer
 */
export function verifyOrderSignature(
  message: EIP712OrderMessage,
  signature: string,
  expectedSigner: string
): boolean {
  try {
    // Recover the signer from the signature
    const recoveredSigner = ethers.verifyTypedData(
      POLYMARKET_DOMAIN,
      { Order: ORDER_TYPES.Order },
      message,
      signature
    );

    // Compare with expected signer (case-insensitive)
    return recoveredSigner.toLowerCase() === expectedSigner.toLowerCase();
  } catch (error) {
    console.error('[EIP712] Signature verification failed:', error);
    return false;
  }
}

/**
 * Validates an order message structure
 */
export function validateOrderMessage(message: any): { valid: boolean; error?: string } {
  // Check required fields
  const requiredFields = [
    'salt',
    'maker',
    'signer',
    'taker',
    'tokenId',
    'makerAmount',
    'takerAmount',
    'expiration',
    'nonce',
    'feeRateBps',
    'side',
    'signatureType',
  ];

  for (const field of requiredFields) {
    if (message[field] === undefined || message[field] === null) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }

  // Validate addresses
  if (!ethers.isAddress(message.maker)) {
    return { valid: false, error: 'Invalid maker address' };
  }
  if (!ethers.isAddress(message.signer)) {
    return { valid: false, error: 'Invalid signer address' };
  }
  if (!ethers.isAddress(message.taker)) {
    return { valid: false, error: 'Invalid taker address' };
  }

  // Validate numeric fields are strings (BigInt representation)
  const numericFields = [
    'salt',
    'tokenId',
    'makerAmount',
    'takerAmount',
    'expiration',
    'nonce',
    'feeRateBps',
  ];
  for (const field of numericFields) {
    if (typeof message[field] !== 'string') {
      return { valid: false, error: `Field ${field} must be a string (BigInt)` };
    }
    // Try to parse as BigInt
    try {
      BigInt(message[field]);
    } catch {
      return { valid: false, error: `Field ${field} is not a valid number` };
    }
  }

  // Validate side (0 = buy, 1 = sell)
  if (message.side !== 0 && message.side !== 1) {
    return { valid: false, error: 'Side must be 0 (buy) or 1 (sell)' };
  }

  // Validate signatureType (2 = EIP712)
  if (message.signatureType !== 2) {
    return { valid: false, error: 'Only EIP712 signatures (type 2) are supported' };
  }

  return { valid: true };
}

/**
 * Converts Polymarket order format to internal order representation
 */
export function convertEIP712ToOrderData(
  message: EIP712OrderMessage,
  marketId: string
): any {
  const makerAmount = BigInt(message.makerAmount);
  const takerAmount = BigInt(message.takerAmount);
  const isBuy = message.side === 0;

  // Based on CTF Exchange Order struct:
  // - BUY: makerAmount = USDC to pay, takerAmount = tokens to receive
  // - SELL: makerAmount = tokens to sell, takerAmount = USDC to receive
  // Price is always USDC per token

  return {
    marketId,
    makerAddress: message.maker,
    signerAddress: message.signer,
    tokenId: message.tokenId,
    side: isBuy ? 'BUY' : 'SELL',
    // Amount is always in tokens
    amount: isBuy ? Number(takerAmount) : Number(makerAmount),
    // Price is always USDC per token
    price: isBuy 
      ? Number(makerAmount) / Number(takerAmount)  // BUY: USDC / tokens
      : Number(takerAmount) / Number(makerAmount), // SELL: USDC / tokens
    // Collateral required (USDC for buy, tokens for sell)
    collateral: Number(makerAmount),
    expiresAt: message.expiration === '0' ? Infinity : parseInt(message.expiration) * 1000,
    nonce: message.nonce,
  };
}
