/**
 * Order types and interfaces for the CLOB (Central Limit Order Book)
 * 
 * Reference: https://docs.polymarket.com/developers/CLOB/introduction
 * 
 * Key rules:
 * - 1 YES token price + 1 NO token price = 1 Dollar (collateralization)
 * - All orders are limit orders (can be marketable)
 * - Binary markets only (2 outcomes)
 */

/**
 * Order side (BUY or SELL)
 * BUY: Buy outcome tokens with collateral (USDC)
 * SELL: Sell outcome tokens for collateral (USDC)
 */
export enum OrderSide {
  BUY = 'BUY',
  SELL = 'SELL',
}

/**
 * Order status
 */
export enum OrderStatus {
  PENDING = 'PENDING',           // Waiting to be filled
  PARTIAL_FILLED = 'PARTIAL_FILLED', // Partially filled
  FULLY_FILLED = 'FULLY_FILLED', // Completely filled
  CANCELLED = 'CANCELLED',       // Cancelled by user
  EXPIRED = 'EXPIRED',           // Expired (outside order validity period)
}

/**
 * Outcome token type (YES or NO in binary market)
 */
export enum OutcomeType {
  YES = 'YES',
  NO = 'NO',
}

/**
 * Limit Order Structure following Polymarket's model
 * All orders are limit orders but can be filled immediately (market order behavior)
 */
export interface Order {
  // Unique identifiers
  id: string;
  marketId: string;
  makerAddress: string;

  // Order details
  side: OrderSide;                // BUY or SELL
  outcome: OutcomeType;          // YES or NO
  amount: number;                // Total amount of tokens to trade
  price: number;                 // Price per token (0 <= price <= 1)
  
  // Collateral info
  collateral: number;            // Amount of USDC or tokens involved
  
  // Order state
  status: OrderStatus;
  filledAmount: number;          // Amount already filled
  remainingAmount: number;       // Amount still to be filled
  
  // EIP712 Signature (Polymarket verification)
  signature?: string;            // EIP712 signature
  signingHash?: string;          // Hash that was signed
  signerAddress?: string;        // Address that signed the order
  tokenId?: string;              // Conditional token ID from signature
  makerAmountRaw?: string;       // Raw maker amount (string for BigInt math)
  takerAmountRaw?: string;       // Raw taker amount (string for BigInt math)
  feeRateBps?: string;           // Fee rate in bps from signature
  expirationRaw?: string;        // Expiration from signature
  nonce?: string;                // Nonce from signature
  sideNumeric?: number;          // 0 = buy, 1 = sell (from signature)
  signatureType?: number;        // Signature type (2 = EIP712)
  rawOrderData?: any;            // Full EIP712 order message for reference
  
  // Timestamps
  createdAt: number;             // Unix timestamp (ms)
  expiresAt: number;             // Unix timestamp (ms) - order validity period
  updatedAt: number;             // Last update timestamp
  
  // Optional metadata
  txHash?: string;               // Transaction hash if submitted on-chain
  originalAmount?: number;       // For partial fills tracking
  settlementTxHash?: string;     // Transaction hash of on-chain settlement (if settled)
  settledOnChain?: boolean;      // Whether the order has been settled on-chain
}

/**
 * Matched order pair (maker + taker(s))
 * In Polymarket, one maker can be matched with multiple takers
 */
export interface MatchedOrders {
  maker: Order;
  takers: Order[];
  matchedAt: number;
  executionPrice: number;
  fillAmount: number;            // Amount of tokens filled in this match
  takerFeeAmount?: string;       // Fee amount charged to taker (raw)
  makerFeeAmounts?: string[];    // Fee amounts charged to makers (raw)
}

/**
 * Order book for a specific market outcome
 * Maintains buy and sell sides separately
 */
export interface OrderBook {
  marketId: string;
  outcome: OutcomeType;
  buySide: Order[];              // Buy orders sorted by price (descending)
  sellSide: Order[];             // Sell orders sorted by price (ascending)
  lastUpdateTime: number;
}

/**
 * Market price derived from order book
 */
export interface MarketPrice {
  marketId: string;
  outcome: OutcomeType;
  midPrice: number;              // (bestBid + bestAsk) / 2
  bestBid: number;               // Highest buy order price
  bestAsk: number;               // Lowest sell order price
  lastUpdate: number;
}

/**
 * User position in a market
 */
export interface Position {
  userAddress: string;
  marketId: string;
  yesBalance: number;            // YES token balance
  noBalance: number;             // NO token balance
  usdcBalance: number;           // USDC collateral balance
  unrealizedPnL: number;         // Unrealized profit/loss
}

/**
 * Trade execution result
 */
export interface TradeExecution {
  tradeId: string;
  makerId: string;
  takerId: string;
  marketId: string;
  outcome: OutcomeType;
  side: OrderSide;
  executionPrice: number;
  executionAmount: number;
  executionTime: number;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  txHash?: string;
}

/**
 * Collateralization check result
 * YES price + NO price must equal 1.0
 */
export interface CollateralizationCheck {
  isValid: boolean;
  yesPrice: number;
  noPrice: number;
  sum: number;
  error?: string;
}
