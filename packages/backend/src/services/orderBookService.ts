/**
 * Order Book Service
 * 
 * Manages order books for each market outcome (YES/NO)
 * Stores and retrieves orders, maintains order state
 */

import * as fs from 'fs';
import * as path from 'path';
import { Order, OrderBook, MarketPrice, OutcomeType, OrderStatus, OrderSide } from '../types/orders';
import { OrderMatchingEngine } from './orderMatchingService';

class OrderBookService {
  private orderBooks: Map<string, OrderBook> = new Map();
  private allOrders: Map<string, Order> = new Map();
  private userOrders: Map<string, string[]> = new Map(); // userAddress -> orderIds
  private storePath: string;
  private isLoaded: boolean = false;

  constructor() {
    const dataDir = path.join(process.cwd(), '.data');
    this.storePath = path.join(dataDir, 'orders.json');
    
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log(`[OrderBookService] Created data directory: ${dataDir}`);
    }
  }

  /**
   * Create a new order
   */
  addOrder(order: Order): void {
    this.loadFromFile();
    
    // Generate unique ID if not provided
    if (!order.id) {
      order.id = OrderMatchingEngine.generateOrderId();
    }

    // Initialize fill amounts
    if (!order.filledAmount) {
      order.filledAmount = 0;
    }
    if (!order.remainingAmount) {
      order.remainingAmount = order.amount;
    }

    // Store order
    this.allOrders.set(order.id, order);

    // Add to user's order list
    if (!this.userOrders.has(order.makerAddress)) {
      this.userOrders.set(order.makerAddress, []);
    }
    this.userOrders.get(order.makerAddress)!.push(order.id);

    // Add to order book
    const bookKey = this.getOrderBookKey(order.marketId, order.outcome);
    if (!this.orderBooks.has(bookKey)) {
      this.orderBooks.set(bookKey, this.createOrderBook(order.marketId, order.outcome));
    }

    const book = this.orderBooks.get(bookKey)!;
    if (order.side === OrderSide.BUY) {
      book.buySide.push(order);
      this.sortBuySide(book);
    } else {
      book.sellSide.push(order);
      this.sortSellSide(book);
    }

    book.lastUpdateTime = Date.now();
    this.saveToFile();

    console.log(`[OrderBookService] Added order: ${order.id}`);
  }

  /**
   * Get an order by ID
   */
  getOrder(orderId: string): Order | undefined {
    this.loadFromFile();
    return this.allOrders.get(orderId);
  }

  /**
   * Get all orders for a user
   */
  getUserOrders(userAddress: string): Order[] {
    this.loadFromFile();
    const orderIds = this.userOrders.get(userAddress) || [];
    return orderIds
      .map(id => this.allOrders.get(id))
      .filter((order): order is Order => order !== undefined);
  }

  /**
   * Get orders for a specific market and outcome
   */
  getMarketOutcomeOrders(marketId: string, outcome: OutcomeType, side: OrderSide): Order[] {
    this.loadFromFile();
    const bookKey = this.getOrderBookKey(marketId, outcome);
    const book = this.orderBooks.get(bookKey);
    
    if (!book) {
      return [];
    }

    return side === OrderSide.BUY ? [...book.buySide] : [...book.sellSide];
  }

  /**
   * Get the current order book for a market outcome
   */
  getOrderBook(marketId: string, outcome: OutcomeType): OrderBook | undefined {
    this.loadFromFile();
    const bookKey = this.getOrderBookKey(marketId, outcome);
    return this.orderBooks.get(bookKey);
  }

  /**
   * Get all order books for a market
   */
  getMarketOrderBooks(marketId: string): Map<OutcomeType, OrderBook> {
    this.loadFromFile();
    const books = new Map<OutcomeType, OrderBook>();

    const yesKey = this.getOrderBookKey(marketId, OutcomeType.YES);
    const noKey = this.getOrderBookKey(marketId, OutcomeType.NO);

    if (this.orderBooks.has(yesKey)) {
      books.set(OutcomeType.YES, this.orderBooks.get(yesKey)!);
    } else {
      books.set(OutcomeType.YES, this.createOrderBook(marketId, OutcomeType.YES));
    }

    if (this.orderBooks.has(noKey)) {
      books.set(OutcomeType.NO, this.orderBooks.get(noKey)!);
    } else {
      books.set(OutcomeType.NO, this.createOrderBook(marketId, OutcomeType.NO));
    }

    return books;
  }

  /**
   * Get market prices (bid/ask/mid)
   */
  getMarketPrices(marketId: string): { yes: MarketPrice; no: MarketPrice } {
    this.loadFromFile();
    return {
      yes: this.calculateMarketPrice(marketId, OutcomeType.YES),
      no: this.calculateMarketPrice(marketId, OutcomeType.NO),
    };
  }

  /**
   * Update order status (e.g., mark as filled, cancelled)
   */
  updateOrderStatus(orderId: string, status: OrderStatus): boolean {
    this.loadFromFile();
    const order = this.allOrders.get(orderId);
    
    if (!order) {
      return false;
    }

    order.status = status;
    order.updatedAt = Date.now();
    this.saveToFile();
    return true;
  }

  /**
   * Cancel an order
   */
  cancelOrder(orderId: string): boolean {
    this.loadFromFile();
    const order = this.allOrders.get(orderId);
    
    if (!order) {
      return false;
    }

    order.status = OrderStatus.CANCELLED;
    order.updatedAt = Date.now();
    order.remainingAmount = 0;

    // Remove from order book
    const bookKey = this.getOrderBookKey(order.marketId, order.outcome);
    const book = this.orderBooks.get(bookKey);
    
    if (book) {
      if (order.side === OrderSide.BUY) {
        book.buySide = book.buySide.filter(o => o.id !== orderId);
      } else {
        book.sellSide = book.sellSide.filter(o => o.id !== orderId);
      }
    }

    this.saveToFile();
    console.log(`[OrderBookService] Cancelled order: ${orderId}`);
    return true;
  }

  /**
   * Get active orders (not cancelled/expired/fully filled)
   */
  getActiveOrders(marketId: string, outcome: OutcomeType): Order[] {
    this.loadFromFile();
    const orders = this.getMarketOutcomeOrders(marketId, outcome, OrderSide.BUY)
      .concat(this.getMarketOutcomeOrders(marketId, outcome, OrderSide.SELL));
    
    const now = Date.now();
    return orders.filter(
      o => o.status === OrderStatus.PENDING || o.status === OrderStatus.PARTIAL_FILLED
    ).filter(o => o.expiresAt > now);
  }

  // ========== Private Methods ==========

  private createOrderBook(marketId: string, outcome: OutcomeType): OrderBook {
    return {
      marketId,
      outcome,
      buySide: [],
      sellSide: [],
      lastUpdateTime: Date.now(),
    };
  }

  private getOrderBookKey(marketId: string, outcome: OutcomeType): string {
    return `${marketId}:${outcome}`;
  }

  private sortBuySide(book: OrderBook): void {
    // Sort by price descending (highest first - best for buyers)
    book.buySide.sort((a, b) => b.price - a.price);
  }

  private sortSellSide(book: OrderBook): void {
    // Sort by price ascending (lowest first - best for sellers)
    book.sellSide.sort((a, b) => a.price - b.price);
  }

  private calculateMarketPrice(marketId: string, outcome: OutcomeType): MarketPrice {
    const bookKey = this.getOrderBookKey(marketId, outcome);
    const book = this.orderBooks.get(bookKey);

    const price: MarketPrice = {
      marketId,
      outcome,
      midPrice: 0.5, // Default to fair 50/50
      bestBid: 0,
      bestAsk: 1,
      lastUpdate: Date.now(),
    };

    if (!book) {
      return price;
    }

    // Best bid is highest buy order price
    if (book.buySide.length > 0) {
      const bestBuyOrder = book.buySide[0];
      price.bestBid = bestBuyOrder.price;
    }

    // Best ask is lowest sell order price
    if (book.sellSide.length > 0) {
      const bestSellOrder = book.sellSide[0];
      price.bestAsk = bestSellOrder.price;
    }

    // Mid price
    if (price.bestBid > 0 && price.bestAsk < 1) {
      price.midPrice = (price.bestBid + price.bestAsk) / 2;
    }

    return price;
  }

  private loadFromFile(): void {
    if (this.isLoaded) return;

    try {
      if (fs.existsSync(this.storePath)) {
        const data = fs.readFileSync(this.storePath, 'utf-8');
        const { orders, orderBooks, userOrders } = JSON.parse(data);

        // Restore orders
        orders.forEach((order: Order) => {
          this.allOrders.set(order.id, order);
        });

        // Restore order books
        orderBooks.forEach((book: OrderBook) => {
          const key = this.getOrderBookKey(book.marketId, book.outcome);
          this.orderBooks.set(key, book);
        });

        // Restore user orders index
        Object.entries(userOrders).forEach(([user, orderIds]: [string, any]) => {
          this.userOrders.set(user, orderIds);
        });

        console.log(
          `[OrderBookService] Loaded ${this.allOrders.size} orders from file`
        );
      }
    } catch (err: any) {
      console.error(`[OrderBookService] Error loading from file:`, err.message);
    }

    this.isLoaded = true;
  }

  private saveToFile(): void {
    try {
      const data = {
        orders: Array.from(this.allOrders.values()),
        orderBooks: Array.from(this.orderBooks.values()),
        userOrders: Object.fromEntries(this.userOrders),
      };

      fs.writeFileSync(this.storePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err: any) {
      console.error(`[OrderBookService] Error saving to file:`, err.message);
    }
  }
}

// Singleton instance
let instance: OrderBookService | null = null;

export function getOrderBookService(): OrderBookService {
  if (!instance) {
    instance = new OrderBookService();
  }
  return instance;
}
