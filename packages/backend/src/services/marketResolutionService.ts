import { ethers } from 'ethers';
import { getMarketsStore } from './marketsStore';

const UmaCtfAdapterABI = require('../abis/UmaCtfAdapter.json');

interface ResolutionConfig {
  rpcUrl: string;
  adminPrivateKey: string;
  umaCtfAdapterAddress: string;
}

interface ResolutionResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

export class MarketResolutionService {
  private provider: ethers.JsonRpcProvider | null = null;
  private adminWallet: ethers.Wallet | null = null;
  private umaAdapter: ethers.Contract | null = null;
  private initialized = false;

  constructor() {
    // Lazy initialization
  }

  private async initialize() {
    if (this.initialized) return;

    const config = this.getConfig();

    if (!config.rpcUrl) {
      throw new Error('RPC_URL not configured');
    }

    if (!config.adminPrivateKey) {
      throw new Error('ADMIN_PRIVATE_KEY not configured');
    }

    if (!config.umaCtfAdapterAddress) {
      throw new Error('UMA_CTF_ADAPTER_ADDRESS not configured');
    }

    console.log('[MarketResolution] Initializing with config:', {
      rpcUrl: config.rpcUrl,
      umaAdapter: config.umaCtfAdapterAddress,
    });

    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.adminWallet = new ethers.Wallet(config.adminPrivateKey, this.provider);

    console.log('[MarketResolution] Admin wallet address:', await this.adminWallet.getAddress());

    this.umaAdapter = new ethers.Contract(
      config.umaCtfAdapterAddress,
      UmaCtfAdapterABI,
      this.adminWallet
    );

    console.log('[MarketResolution] UmaCtfAdapter contract initialized');
    this.initialized = true;
  }

  private getConfig(): ResolutionConfig {
    return {
      rpcUrl: process.env.RPC_URL || '',
      adminPrivateKey: process.env.ADMIN_PRIVATE_KEY || '',
      umaCtfAdapterAddress: process.env.UMA_CTF_ADAPTER_ADDRESS || '',
    };
  }

  /**
   * Resolves a market manually by calling resolveManually on UmaCtfAdapter
   * @param marketId - Market ID (same as questionID)
   * @param outcome - 'YES' or 'NO' to determine payouts
   * @returns Resolution result with transaction hash
   */
  async resolveMarket(marketId: string, outcome: 'YES' | 'NO'): Promise<ResolutionResult> {
    try {
      await this.initialize();

      if (!this.umaAdapter) {
        throw new Error('UmaCtfAdapter contract not initialized');
      }

      // Get market from store to verify it exists
      const store = getMarketsStore();
      const market = store.getMarket(marketId);

      if (!market) {
        throw new Error(`Market not found: ${marketId}`);
      }

      console.log('[MarketResolution] Resolving market:', {
        marketId,
        outcome,
        questionId: marketId, // Using marketId as questionID
      });

      // Construct payouts based on outcome
      // Payouts: [YES, NO]
      const payouts = outcome === 'YES' ? [1, 0] : [0, 1];

      console.log('[MarketResolution] Calling resolveManually with:', {
        questionId: marketId,
        payouts,
      });

      // Call resolveManually on the UmaCtfAdapter
      const tx = await this.umaAdapter.resolveManually(marketId, payouts);

      console.log('[MarketResolution] Transaction sent:', tx.hash);

      // Wait for transaction confirmation
      const receipt = await tx.wait();

      console.log('[MarketResolution] Transaction confirmed:', receipt?.transactionHash);

      // Update market store with resolution outcome
      store.updateMarket(marketId, {
        resolved: true,
        resolutionOutcome: outcome,
      });

      console.log('[MarketResolution] Market updated in store with outcome:', outcome);

      return {
        success: true,
        transactionHash: receipt?.transactionHash || tx.hash,
      };
    } catch (err: any) {
      console.error('[MarketResolution] Error resolving market:', err);
      return {
        success: false,
        error: err.message || 'Failed to resolve market',
      };
    }
  }

  /**
   * Gets the admin address
   */
  async getAdminAddress(): Promise<string> {
    try {
      await this.initialize();

      if (!this.adminWallet) {
        throw new Error('Admin wallet not initialized');
      }

      return await this.adminWallet.getAddress();
    } catch (err: any) {
      console.error('[MarketResolution] Error getting admin address:', err);
      throw err;
    }
  }
}

// Singleton instance
let instance: MarketResolutionService | null = null;

export function getMarketResolutionService(): MarketResolutionService {
  if (!instance) {
    instance = new MarketResolutionService();
  }
  return instance;
}
