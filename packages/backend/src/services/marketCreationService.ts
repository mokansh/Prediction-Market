import { ethers } from 'ethers';
import { getMarketsStore } from './marketsStore';

const UmaCtfAdapterABI = require('../abis/UmaCtfAdapter.json');
const ConditionalTokensABI = require('../abis/ConditionalTokens.json');

interface MarketConfig {
  question: string;
  description: string;
  category: string;
  resolutionSource?: string;
  endTime: number; // Unix timestamp
  image?: string;
}

interface CreateMarketResult {
  success: boolean;
  questionId?: string;
  conditionId?: string;
  tokenIds?: {
    yesTokenId: string;
    noTokenId: string;
  };
  error?: string;
  market?: any;
}

// Runtime configuration getter to ensure env is loaded
function getConfig() {
  return {
    rpcUrl: process.env.RPC_URL || '',
    adminPrivateKey: process.env.ADMIN_PRIVATE_KEY || '',
    umaCtfAdapterAddress: process.env.UMA_CTF_ADAPTER_ADDRESS || '',
    conditionalTokensAddress: process.env.CONDITIONAL_TOKENS_ADDRESS || '',
    rewardTokenAddress: process.env.REWARD_TOKEN_ADDRESS || ethers.ZeroAddress,
    rewardAmount: process.env.REWARD_AMOUNT || '0',
    proposalBond: process.env.PROPOSAL_BOND || '0',
    liveness: process.env.LIVENESS || '7200', // 2 hours default
  };
}

export class MarketCreationService {
  private provider: ethers.JsonRpcProvider | null = null;
  private adminWallet: ethers.Wallet | null = null;
  private umaAdapter: ethers.Contract | null = null;
  private ctf: ethers.Contract | null = null;
  private initialized = false;

  constructor() {
    // Lazy initialization - will happen on first use
  }

  private async initialize() {
    if (this.initialized) return;

    const config = getConfig();

    if (!config.rpcUrl) {
      throw new Error('RPC_URL not configured');
    }

    if (!config.adminPrivateKey) {
      throw new Error('ADMIN_PRIVATE_KEY not configured');
    }

    if (!config.umaCtfAdapterAddress) {
      throw new Error('UMA_CTF_ADAPTER_ADDRESS not configured');
    }

    if (!config.conditionalTokensAddress) {
      throw new Error('CONDITIONAL_TOKENS_ADDRESS not configured');
    }

    console.log('[MarketCreation] Initializing with config:', {
      rpcUrl: config.rpcUrl,
      umaAdapter: config.umaCtfAdapterAddress,
      ctf: config.conditionalTokensAddress,
    });

    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.adminWallet = new ethers.Wallet(config.adminPrivateKey, this.provider);

    console.log('[MarketCreation] Admin wallet address:', await this.adminWallet.getAddress());

    this.umaAdapter = new ethers.Contract(
      config.umaCtfAdapterAddress,
      UmaCtfAdapterABI,
      this.adminWallet
    );

    this.ctf = new ethers.Contract(
      config.conditionalTokensAddress,
      ConditionalTokensABI,
      this.provider
    );

    console.log('[MarketCreation] Contracts initialized');
    this.initialized = true;
  }

  /**
   * Creates a new prediction market
   * @param marketConfig Market configuration
   * @returns CreateMarketResult with questionId, conditionId, and token IDs
   */
  async createMarket(marketConfig: MarketConfig): Promise<CreateMarketResult> {
    try {
      await this.initialize();

      if (!this.umaAdapter || !this.ctf || !this.adminWallet) {
        throw new Error('Service not properly initialized');
      }

      const config = getConfig();

      // 1. Construct ancillary data (the question data for UMA)
      const ancillaryDataStr = this.constructAncillaryData(marketConfig);
      console.log('[MarketCreation] Ancillary data string:', ancillaryDataStr);

      // Convert string to bytes for the smart contract
      const ancillaryData = ethers.toUtf8Bytes(ancillaryDataStr);
      console.log('[MarketCreation] Ancillary data bytes length:', ancillaryData.length);

      // 2. Call initialize on UMA Adapter
      console.log('[MarketCreation] Initializing market on UMA Adapter...');
      
      const tx = await this.umaAdapter.initialize(
        ancillaryData,
        config.rewardTokenAddress, // reward token (address(0) for no reward)
        config.rewardAmount, // reward amount
        config.proposalBond, // proposal bond (0 uses default)
        config.liveness // liveness period in seconds
      );

      console.log('[MarketCreation] Transaction sent:', tx.hash);
      const receipt = await tx.wait();
      console.log('[MarketCreation] Transaction confirmed in block:', receipt.blockNumber);

      // 3. Extract questionID from event
      const questionInitEvent = receipt.logs
        .map((log: any) => {
          try {
            return this.umaAdapter!.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((event: any) => event && event.name === 'QuestionInitialized');

      if (!questionInitEvent) {
        throw new Error('QuestionInitialized event not found in transaction receipt');
      }

      const questionId = questionInitEvent.args.questionID;
      console.log('[MarketCreation] Question ID:', questionId);

      // 4. Compute conditionId
      const conditionId = await this.ctf.getConditionId(
        config.umaCtfAdapterAddress, // oracle (UMA Adapter)
        questionId, // questionId
        2 // outcomeSlotCount (always 2 for binary markets)
      );
      console.log('[MarketCreation] Condition ID:', conditionId);

      // 5. Derive token IDs for YES/NO outcomes
      const tokenIds = this.deriveTokenIds(conditionId);
      console.log('[MarketCreation] Token IDs:', tokenIds);

      // 6. Create market object for storage
      const market = {
        id: questionId,
        conditionId,
        question: marketConfig.question,
        description: marketConfig.description,
        category: marketConfig.category,
        resolutionSource: marketConfig.resolutionSource,
        endTime: marketConfig.endTime,
        image: marketConfig.image,
        tokenIds,
        createdAt: Date.now(),
        resolved: false,
        txHash: tx.hash,
      };

      // Save to markets store
      const store = getMarketsStore();
      store.addMarket(market);
      console.log('[MarketCreation] Market saved to store');

      return {
        success: true,
        questionId,
        conditionId,
        tokenIds,
        market,
      };
    } catch (err: any) {
      console.error('[MarketCreation] Error creating market:', err);
      return {
        success: false,
        error: err.message || 'Failed to create market',
      };
    }
  }

  /**
   * Constructs ancillary data for UMA Oracle
   * Format: "q: <question> res_data: <resolution_source> p1: 0, p2: 1, p3: <end_time>"
   */
  private constructAncillaryData(config: MarketConfig): string {
    const parts = [
      `q: ${config.question}`,
      config.resolutionSource ? `res_data: ${config.resolutionSource}` : 'res_data: https://polymarket.com',
      'p1: 0',
      'p2: 1',
      `p3: ${config.endTime}`,
    ];

    return parts.join('. ') + '.';
  }

  /**
   * Derives YES/NO token IDs from conditionId
   * Based on: https://gist.github.com/L-Kov/950bce141a9d1aa1ed3b1cfce6d30217
   */
  private deriveTokenIds(conditionId: string): { yesTokenId: string; noTokenId: string } {
    const parentCollectionId = ethers.ZeroHash; // For simple binary markets

    // Collection IDs for each outcome
    const yesCollectionId = this.getCollectionId(parentCollectionId, conditionId, 1); // YES = index 1
    const noCollectionId = this.getCollectionId(parentCollectionId, conditionId, 2); // NO = index 2

    // Position IDs (ERC1155 token IDs)
    // Use the actual collateral token address (USDC), not zero address
    const collateralToken = process.env.COLLATERAL_TOKEN_ADDRESS || process.env.COLLATERAL_TOKEN || ethers.ZeroAddress;
    const yesTokenId = this.getPositionId(collateralToken, yesCollectionId);
    const noTokenId = this.getPositionId(collateralToken, noCollectionId);

    return {
      yesTokenId,
      noTokenId,
    };
  }

  /**
   * Computes collectionId for a given outcome
   * collectionId = keccak256(abi.encodePacked(parentCollectionId, conditionId, indexSet))
   */
  private getCollectionId(parentCollectionId: string, conditionId: string, outcomeIndex: number): string {
    // indexSet is a bitmap where bit at position (outcomeIndex - 1) is set
    // For binary markets: YES = index 1 (bit 0), NO = index 2 (bit 1)
    const indexSet = 1 << (outcomeIndex - 1);

    return ethers.keccak256(
      ethers.solidityPacked(
        ['bytes32', 'bytes32', 'uint256'],
        [parentCollectionId, conditionId, indexSet]
      )
    );
  }

  /**
   * Computes positionId (ERC1155 token ID)
   * positionId = uint(keccak256(abi.encodePacked(collateralToken, collectionId)))
   */
  private getPositionId(collateralToken: string, collectionId: string): string {
    return ethers.keccak256(
      ethers.solidityPacked(['address', 'bytes32'], [collateralToken, collectionId])
    );
  }

  /**
   * Gets admin wallet address
   */
  async getAdminAddress(): Promise<string> {
    try {
      await this.initialize();
      if (!this.adminWallet) {
        return 'Not configured';
      }
      return await this.adminWallet.getAddress();
    } catch (err: any) {
      console.error('[MarketCreation] Error getting admin address:', err);
      return 'Error: ' + err.message;
    }
  }
}

// Export a getter function instead of singleton
export function getMarketCreationService(): MarketCreationService {
  return new MarketCreationService();
}
