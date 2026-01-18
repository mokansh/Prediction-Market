/**
 * EIP712 Signing utilities for Polymarket CTF Exchange
 * Uses ethers.js to sign messages with a Web3 wallet
 */

import { ethers } from 'ethers';

// Polymarket CTF Exchange domain configuration
export const POLYMARKET_DOMAIN = {
  name: 'Polymarket CTF Exchange',
  version: '1',
  chainId: 80002, // Polygon Amoy testnet
  verifyingContract: '0x605921c2eC6E761945bEEA78D46b81f045dc0399',
} as const;

// Order struct type definition
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
} as const;

export interface EIP712OrderMessage {
  salt: string;
  maker: string;
  signer: string;
  taker: string;
  tokenId: string;
  makerAmount: string;
  takerAmount: string;
  expiration: string;
  nonce: string;
  feeRateBps: string;
  side: number; // 0 = buy, 1 = sell
  signatureType: number; // 2 = EIP712
}

/**
 * Creates an EIP712 order message for signing
 * Side: 0 = buy, 1 = sell
 * Maker address can differ from signer (e.g., multisig maker with EOA signer)
 * Price and amount are used to calculate makerAmount and takerAmount
 */
export function createOrderMessage(
  maker: string | undefined,
  signer: string,
  side: 0 | 1,
  amount: number,
  price: number,
  tokenId: string
): EIP712OrderMessage {
  if (!signer) {
    throw new Error('Signer address is required');
  }

  const effectiveMaker = maker || signer;
  if (!effectiveMaker) {
    throw new Error('Maker address is required');
  }

  if (!tokenId) {
    throw new Error('tokenId is required');
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('amount must be a positive number');
  }

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('price must be a positive number');
  }

  const makerAddr = effectiveMaker.toString().toLowerCase();
  const signerAddr = signer.toString().toLowerCase();

  // Generate a random salt for replay protection
  const salt = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString();

  // Calculate amounts based on side and price
  // Multiply by 10^6 because collateral (USDC) has 6 decimals
  // 
  // For BUY orders:
  //   - Maker sells USDC (makerAmount), receives tokens (takerAmount)
  //   - makerAmount = amount * price * 1e6 (USDC)
  //   - takerAmount = amount * 1e6 (tokens)
  //
  // For SELL orders:
  //   - Maker sells tokens (makerAmount), receives USDC (takerAmount)
  //   - makerAmount = amount * 1e6 (tokens)
  //   - takerAmount = amount * price * 1e6 (USDC)
  
  let makerAmount: string;
  let takerAmount: string;
  
  if (side === 0) {
    // BUY: maker pays USDC, taker provides tokens
    makerAmount = Math.floor(amount * price * 1e6).toString(); // USDC
    takerAmount = Math.floor(amount * 1e6).toString(); // tokens
  } else {
    // SELL: maker provides tokens, taker pays USDC
    makerAmount = Math.floor(amount * 1e6).toString(); // tokens
    takerAmount = Math.floor(amount * price * 1e6).toString(); // USDC
  }

  if (!takerAmount || !makerAmount) {
    throw new Error('Calculated amounts are invalid');
  }

  return {
    salt,
    maker: makerAddr,
    signer: signerAddr,
    taker: '0x0000000000000000000000000000000000000000', // Anyone can fill
    tokenId,
    makerAmount,
    takerAmount,
    expiration: '0', // No expiration
    nonce: '0',
    feeRateBps: '0', // No fees
    side,
    signatureType: 2, // EIP712
  };
}

/**
 * Signs an EIP712 order message with a wallet
 * This uses the standard eth_signTypedData method
 */
export async function signOrderMessage(
  message: EIP712OrderMessage,
  signer: ethers.Signer
): Promise<string> {
  try {
    // Don't include EIP712Domain in types - it's derived from the domain parameter
    const types = {
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

    // Use ethers.js to sign the typed data
    const signature = await signer.signTypedData(POLYMARKET_DOMAIN, types, message);
    return signature;
  } catch (error: any) {
    console.error('[EIP712] Failed to sign message:', error);
    throw new Error(`Failed to sign order: ${error.message}`);
  }
}

/**
 * Gets the signer from a Web3 provider
 * This is typically called with injected providers like MetaMask
 */
export async function getSignerFromProvider(provider: any): Promise<ethers.Signer> {
  try {
    const ethersProvider = new ethers.BrowserProvider(provider);
    const signer = await ethersProvider.getSigner();
    return signer;
  } catch (error) {
    console.error('[EIP712] Failed to get signer:', error);
    throw new Error('Unable to get wallet signer. Please connect your wallet.');
  }
}

/**
 * Gets the signer address from a signer
 */
export async function getSignerAddress(signer: ethers.Signer): Promise<string> {
  try {
    const address = await signer.getAddress();
    return address;
  } catch (error) {
    console.error('[EIP712] Failed to get signer address:', error);
    throw new Error('Unable to get signer address');
  }
}

/**
 * Complete flow: Create and sign an order
 * Maker address can be a multisig; signer is the connected wallet (e.g., MetaMask EOA)
 * Returns the signed message and signature for submission
 */
export async function createAndSignOrder(
  walletProvider: any,
  side: 0 | 1,
  amount: number,
  price: number,
  tokenId: string,
  makerAddress?: string
): Promise<{ message: EIP712OrderMessage; signature: string }> {
  try {
    // Get signer from provider
    const signer = await getSignerFromProvider(walletProvider);
    const signerAddress = await getSignerAddress(signer);

    // Create order message
    const message = createOrderMessage(makerAddress, signerAddress, side, amount, price, tokenId);

    // Sign the message
    const signature = await signOrderMessage(message, signer);

    console.log('[EIP712] Order signed successfully:', {
      signer: signerAddress,
      side: side === 0 ? 'BUY' : 'SELL',
      amount,
      price,
      signature,
    });

    return { message, signature };
  } catch (error: any) {
    console.error('[EIP712] Failed to create and sign order:', error);
    throw error;
  }
}
