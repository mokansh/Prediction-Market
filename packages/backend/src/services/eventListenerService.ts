/**
 * Service to listen for ConditionPreparation events from CTF contract
 * and store market condition metadata (conditionId, questionId, tokenIds)
 */

import { ethers, EventLog } from 'ethers';
import path from 'path';
import dotenv from 'dotenv';
import { getTokenIdsForMarket } from '../utils/ctfCalculations';
import { getMarketsStore } from './marketsStore';

const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

// CTF contract address and RPC
const CTF_CONTRACT_ADDRESS = process.env.CTF_CONTRACT_ADDRESS || '';
const RPC_URL = process.env.RPC_URL || process.env.ALCHEMY_RPC_URL || '';
const COLLATERAL_TOKEN_ADDRESS = process.env.COLLATERAL_TOKEN_ADDRESS || '';

// CTF contract ABI (minimal - only ConditionPreparation event)
const CTF_ABI = [
  'event ConditionPreparation(bytes32 indexed conditionId, address indexed oracle, bytes32 indexed questionId, uint256 outcomeSlotCount)',
];

// In-memory store for market conditions
// In production, this should be in a database
interface MarketCondition {
  marketId: string;
  conditionId: string;
  questionId: string;
  yesTokenId: string;
  noTokenId: string;
  timestamp: number;
}

const marketConditions = new Map<string, MarketCondition>();

function storeConditionInMap(condition: MarketCondition): void {
  marketConditions.set(condition.conditionId, condition);
  marketConditions.set(condition.marketId, condition);
}

export class EventListenerService {
  private provider: ethers.JsonRpcProvider | null = null;
  private ctfContract: ethers.Contract | null = null;
  private isListening = false;
  private lastProcessedBlock = 0;
  private pollingInterval: NodeJS.Timeout | null = null;

  constructor() {
    if (!CTF_CONTRACT_ADDRESS || !RPC_URL) {
      console.warn('[EventListener] CTF_CONTRACT_ADDRESS or RPC_URL not configured');
      return;
    }

    try {
      this.provider = new ethers.JsonRpcProvider(RPC_URL);
      this.ctfContract = new ethers.Contract(CTF_CONTRACT_ADDRESS, CTF_ABI, this.provider);
    } catch (err) {
      console.error('[EventListener] Failed to initialize provider:', err);
    }
  }

  /**
   * Start listening for ConditionPreparation events using polling
   */
  async startListening(): Promise<void> {
    if (!this.ctfContract || !this.provider) {
      console.error('[EventListener] CTF contract not initialized');
      return;
    }

    if (this.isListening) {
      console.warn('[EventListener] Already listening for events');
      return;
    }

    try {
      this.isListening = true;

      // Get initial block number
      const currentBlock = await this.provider.getBlockNumber();
      this.lastProcessedBlock = currentBlock;

      console.log('[EventListener] Started listening for ConditionPreparation events (polling mode)');

      // Poll for events every 15 seconds
      this.pollingInterval = setInterval(() => {
        this.pollForEvents();
      }, 15000);

      // Also poll immediately
      await this.pollForEvents();
    } catch (err) {
      console.error('[EventListener] Error starting listener:', err);
      this.isListening = false;
    }
  }

  /**
   * Poll for new events
   */
  private async pollForEvents(): Promise<void> {
    if (!this.ctfContract || !this.provider) return;

    try {
      const currentBlock = await this.provider.getBlockNumber();

      if (currentBlock > this.lastProcessedBlock) {
        const filter = this.ctfContract.filters.ConditionPreparation?.();
        if (!filter) return;

        const events = await this.ctfContract.queryFilter(filter, this.lastProcessedBlock + 1, currentBlock);

        if (events.length > 0) {
          console.log(`[EventListener] Found ${events.length} new ConditionPreparation events`);

          for (const event of events) {
            if (event instanceof EventLog) {
              const args = event.args;
              if (args && args.length >= 4) {
                this.handleConditionPreparation(args[0], args[1], args[2], args[3], event);
              }
            }
          }
        }

        this.lastProcessedBlock = currentBlock;
      }
    } catch (err) {
      console.error('[EventListener] Error polling for events:', err);
    }
  }

  /**
   * Handle ConditionPreparation event
   */
  private handleConditionPreparation(
    conditionId: string,
    oracle: string,
    questionId: string,
    outcomeSlotCount: number,
    event: any
  ): void {
    try {
      console.log('[EventListener] ConditionPreparation event received:', {
        conditionId,
        oracle,
        questionId,
        outcomeSlotCount,
        blockNumber: event.blockNumber,
      });

      // Calculate tokenIds for YES and NO outcomes
      if (!COLLATERAL_TOKEN_ADDRESS) {
        console.warn('[EventListener] COLLATERAL_TOKEN_ADDRESS not set, cannot calculate tokenIds');
        return;
      }

      const { yesTokenId, noTokenId } = getTokenIdsForMarket(conditionId, COLLATERAL_TOKEN_ADDRESS);

      console.log('[EventListener] Calculated tokenIds:', {
        conditionId,
        yesTokenId,
        noTokenId,
      });

      const marketId = this.resolveMarketId(conditionId);

      // Store the condition data
      // In a real app, you would save this to a database and associate it with the market
      // For now, we're using an in-memory store keyed by conditionId
      const marketCondition: MarketCondition = {
        marketId,
        conditionId,
        questionId,
        yesTokenId,
        noTokenId,
        timestamp: Date.now(),
      };

      storeConditionInMap(marketCondition);

      console.log('[EventListener] Stored market condition:', marketCondition);

      // Emit event or call webhook to notify market service
      // this.emit('conditionPrepared', marketCondition);
    } catch (err) {
      console.error('[EventListener] Error handling ConditionPreparation event:', err);
    }
  }

  /**
   * Stop listening for events
   */
  stopListening(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isListening = false;
    console.log('[EventListener] Stopped listening for events');
  }

  /**
   * Get stored market condition by conditionId
   */
  getMarketCondition(conditionId: string): MarketCondition | undefined {
    return marketConditions.get(conditionId);
  }

  private resolveMarketId(conditionId: string): string {
    try {
      const store = getMarketsStore();
      const market = store.getMarketByConditionId(conditionId);
      return market?.id || conditionId;
    } catch (err) {
      console.warn('[EventListener] Unable to resolve marketId for condition', conditionId, err);
      return conditionId;
    }
  }

  /**
   * Get all stored market conditions
   */
  getAllMarketConditions(): MarketCondition[] {
    return Array.from(marketConditions.values());
  }

  /**
   * Store a market condition manually (for testing or manual input)
   */
  storeMarketCondition(marketId: string, conditionId: string, questionId: string): MarketCondition {
    if (!COLLATERAL_TOKEN_ADDRESS) {
      throw new Error('COLLATERAL_TOKEN_ADDRESS not configured');
    }

    const { yesTokenId, noTokenId } = getTokenIdsForMarket(conditionId, COLLATERAL_TOKEN_ADDRESS);

    const marketCondition: MarketCondition = {
      marketId,
      conditionId,
      questionId,
      yesTokenId,
      noTokenId,
      timestamp: Date.now(),
    };

    storeConditionInMap(marketCondition);
    console.log('[EventListener] Stored market condition:', marketCondition);

    return marketCondition;
  }
}

let eventListenerInstance: EventListenerService | null = null;

export function getEventListenerService(): EventListenerService {
  if (!eventListenerInstance) {
    eventListenerInstance = new EventListenerService();
  }
  return eventListenerInstance;
}
