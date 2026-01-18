/**
 * Persistent storage for created markets
 * Uses JSON file-based storage (can be replaced with database in production)
 */

import * as fs from 'fs';
import * as path from 'path';

interface Market {
  id: string;
  conditionId: string;
  question: string;
  description: string;
  category: string;
  resolutionSource?: string;
  endTime: number;
  image?: string;
  tokenIds: {
    yesTokenId: string;
    noTokenId: string;
  };
  createdAt: number;
  resolved: boolean;
  resolutionOutcome?: 'YES' | 'NO'; // The outcome when resolved
  txHash: string;
}

class MarketsStore {
  private markets: Map<string, Market> = new Map();
  private storePath: string;
  private isLoaded: boolean = false;

  constructor() {
    // Use a data directory in the project root for persistence
    const dataDir = path.join(process.cwd(), '.data');
    this.storePath = path.join(dataDir, 'markets.json');
    
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log(`[MarketsStore] Created data directory: ${dataDir}`);
    }
  }

  private loadFromFile(): void {
    if (this.isLoaded) return;

    try {
      if (fs.existsSync(this.storePath)) {
        const data = fs.readFileSync(this.storePath, 'utf-8');
        const markets: Market[] = JSON.parse(data);
        
        // Restore markets to Map
        markets.forEach(market => {
          this.markets.set(market.id, market);
        });
        
        console.log(`[MarketsStore] Loaded ${markets.length} markets from file`);
      } else {
        console.log(`[MarketsStore] No existing markets file, starting fresh`);
      }
    } catch (err: any) {
      console.error(`[MarketsStore] Error loading markets from file:`, err.message);
    }

    this.isLoaded = true;
  }

  private saveToFile(): void {
    try {
      const markets = Array.from(this.markets.values());
      fs.writeFileSync(this.storePath, JSON.stringify(markets, null, 2), 'utf-8');
      console.log(`[MarketsStore] Saved ${markets.length} markets to file`);
    } catch (err: any) {
      console.error(`[MarketsStore] Error saving markets to file:`, err.message);
    }
  }

  addMarket(market: Market): void {
    this.loadFromFile(); // Ensure data is loaded before adding
    this.markets.set(market.id, market);
    this.saveToFile();
    console.log(`[MarketsStore] Added market: ${market.id}`);
  }

  getMarket(id: string): Market | undefined {
    this.loadFromFile(); // Ensure data is loaded before getting
    return this.markets.get(id);
  }

  getAllMarkets(): Market[] {
    this.loadFromFile(); // Ensure data is loaded before getting all
    return Array.from(this.markets.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  getMarketByConditionId(conditionId: string): Market | undefined {
    this.loadFromFile();
    return Array.from(this.markets.values()).find((market) => market.conditionId === conditionId);
  }

  updateMarket(id: string, updates: Partial<Market>): boolean {
    this.loadFromFile(); // Ensure data is loaded before updating
    const market = this.markets.get(id);
    if (!market) {
      return false;
    }
    this.markets.set(id, { ...market, ...updates });
    this.saveToFile();
    return true;
  }

  deleteMarket(id: string): boolean {
    this.loadFromFile(); // Ensure data is loaded before deleting
    const result = this.markets.delete(id);
    if (result) {
      this.saveToFile();
    }
    return result;
  }

  getMarketsByCategory(category: string): Market[] {
    this.loadFromFile(); // Ensure data is loaded before filtering
    return this.getAllMarkets().filter(m => m.category === category);
  }
}

// Singleton instance
let storeInstance: MarketsStore | null = null;

export function getMarketsStore(): MarketsStore {
  if (!storeInstance) {
    storeInstance = new MarketsStore();
  }
  return storeInstance;
}
