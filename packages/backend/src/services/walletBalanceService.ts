/**
 * Wallet Balance Service
 * 
 * Manages user wallet balances and collateral tracking
 */

import { ethers } from 'ethers';
import path from 'path';
import fs from 'fs';

const ERC20_ABI = [
  'function balanceOf(address account) public view returns (uint256)',
  'function decimals() public view returns (uint8)',
  'function symbol() public view returns (string)',
];

interface UserBalance {
  userAddress: string;
  walletAddress?: string;
  collateralBalance: string;
  collateralBalanceFormatted: string;
  availableForOrders: string;
  lockedInOrders: string;
  lastUpdated: number;
}

interface BalanceStore {
  [userAddress: string]: UserBalance;
}

export class WalletBalanceService {
  private provider: ethers.JsonRpcProvider;
  private collateralToken: string;
  private balanceFile: string;
  private balances: BalanceStore = {};

  constructor(rpcUrl: string = 'https://rpc-amoy.polygon.technology/', collateralToken: string = '') {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.collateralToken = collateralToken || process.env.COLLATERAL_TOKEN || '';
    
    // Initialize balance file path
    const dataDir = path.join(__dirname, '../../.data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.balanceFile = path.join(dataDir, 'balances.json');
    this.loadFromFile();
  }

  /**
   * Get user's balance from their multisig wallet
   */
  async getUserBalance(userAddress: string, walletAddress?: string): Promise<UserBalance> {
    try {
      // Validate addresses
      if (!ethers.isAddress(userAddress)) {
        throw new Error('Invalid user address');
      }

      // Use provided wallet address or load from stored data
      let targetWallet = walletAddress;
      if (!targetWallet) {
        const stored = this.balances[userAddress];
        targetWallet = stored?.walletAddress;
      }

      if (!targetWallet || !ethers.isAddress(targetWallet)) {
        // Return zero balance if no wallet found
        return {
          userAddress,
          collateralBalance: '0',
          collateralBalanceFormatted: '0.00',
          availableForOrders: '0',
          lockedInOrders: '0',
          lastUpdated: Date.now(),
        };
      }

      // Get collateral token balance
      const contract = new ethers.Contract(
        this.collateralToken,
        ERC20_ABI,
        this.provider
      );

      const balance = await contract.balanceOf(targetWallet);
      const decimals = await contract.decimals();
      
      // Format balance
      const formattedBalance = ethers.formatUnits(balance, decimals);
      
      const userBalance: UserBalance = {
        userAddress,
        walletAddress: targetWallet,
        collateralBalance: balance.toString(),
        collateralBalanceFormatted: formattedBalance,
        availableForOrders: formattedBalance, // TODO: Subtract locked in orders
        lockedInOrders: '0', // TODO: Calculate from order book
        lastUpdated: Date.now(),
      };

      // Store in memory
      this.balances[userAddress] = userBalance;
      this.saveToFile();

      return userBalance;
    } catch (error) {
      console.error(`[WalletBalanceService] Error getting balance for ${userAddress}:`, error);
      
      // Return cached balance if available
      const cached = this.balances[userAddress];
      if (cached) {
        return cached;
      }

      return {
        userAddress,
        collateralBalance: '0',
        collateralBalanceFormatted: '0.00',
        availableForOrders: '0',
        lockedInOrders: '0',
        lastUpdated: Date.now(),
      };
    }
  }

  /**
   * Batch get balances for multiple users
   */
  async getBatchBalances(userAddresses: string[]): Promise<UserBalance[]> {
    return Promise.all(
      userAddresses.map(addr => this.getUserBalance(addr))
    );
  }

  /**
   * Check if user has sufficient balance for order
   */
  async hasSufficientBalance(userAddress: string, requiredAmount: string, walletAddress?: string): Promise<boolean> {
    try {
      const balance = await this.getUserBalance(userAddress, walletAddress);
      const available = parseFloat(balance.collateralBalanceFormatted);
      const required = parseFloat(requiredAmount);
      
      return available >= required;
    } catch (error) {
      console.error(`[WalletBalanceService] Error checking balance:`, error);
      return false;
    }
  }

  /**
   * Update wallet address mapping for user
   */
  updateWalletMapping(userAddress: string, walletAddress: string): void {
    if (!ethers.isAddress(userAddress) || !ethers.isAddress(walletAddress)) {
      throw new Error('Invalid addresses');
    }

    const existing = this.balances[userAddress];
    this.balances[userAddress] = {
      userAddress,
      walletAddress,
      collateralBalance: existing?.collateralBalance || '0',
      collateralBalanceFormatted: existing?.collateralBalanceFormatted || '0.00',
      availableForOrders: existing?.availableForOrders || '0',
      lockedInOrders: existing?.lockedInOrders || '0',
      lastUpdated: Date.now(),
    };

    this.saveToFile();
  }

  /**
   * Load balances from persistent storage
   */
  private loadFromFile(): void {
    try {
      if (fs.existsSync(this.balanceFile)) {
        const data = fs.readFileSync(this.balanceFile, 'utf-8');
        this.balances = JSON.parse(data);
        console.log(`[WalletBalanceService] Loaded ${Object.keys(this.balances).length} balance records`);
      }
    } catch (error) {
      console.warn(`[WalletBalanceService] Could not load balances from file:`, error);
      this.balances = {};
    }
  }

  /**
   * Save balances to persistent storage
   */
  private saveToFile(): void {
    try {
      const dataDir = path.dirname(this.balanceFile);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(this.balanceFile, JSON.stringify(this.balances, null, 2));
    } catch (error) {
      console.error(`[WalletBalanceService] Error saving balances:`, error);
    }
  }

  /**
   * Get singleton instance
   */
  static instance: WalletBalanceService;

  static getInstance(): WalletBalanceService {
    if (!WalletBalanceService.instance) {
      WalletBalanceService.instance = new WalletBalanceService();
    }
    return WalletBalanceService.instance;
  }
}

export default WalletBalanceService;
