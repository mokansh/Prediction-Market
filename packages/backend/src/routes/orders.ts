/**
 * Order API Routes
 * 
 * Endpoints:
 * POST /api/orders/place - Place a new order with EIP712 signature
 * GET /api/orders/:id - Get order details
 * GET /api/orders/user/:address - Get user's orders
 * GET /api/orders/market/:marketId - Get market orderbook
 * GET /api/orders/market/:marketId/prices - Get market prices
 * DELETE /api/orders/:id - Cancel an order
 */

import { Router, Request, Response } from 'express';
import { Order, OrderSide, OrderStatus, OutcomeType } from '../types/orders';
import { getOrderBookService } from '../services/orderBookService';
import { OrderMatchingEngine } from '../services/orderMatchingService';
import { ethers } from 'ethers';
import {
  verifyOrderSignature,
  validateOrderMessage,
  convertEIP712ToOrderData,
  type EIP712OrderMessage,
} from '../utils/eip712';
import { settlementQueue } from '../services/settlementQueue';
import { SettlementRetryService } from '../services/settlementRetryService';

const router = Router();

/**
 * POST /api/orders/place
 * Place a new order with EIP712 signature verification
 * 
 * Body:
 * {
 *   "marketId": "market-uuid",
 *   "orderData": {
 *     "salt": "1083786480826",
 *     "maker": "0x7227db3d7d86e3e11040fe55539f14b43674ab66",
 *     "signer": "0x7227db3d7d86e3e11040fe55539f14b43674ab66",
 *     "taker": "0x0000000000000000000000000000000000000000",
 *     "tokenId": "101434403359553929764780234916919166959889590658679054429843672204390513588056",
 *     "makerAmount": "1000000",
 *     "takerAmount": "4347800",
 *     "expiration": "0",
 *     "nonce": "0",
 *     "feeRateBps": "0",
 *     "side": 0,
 *     "signatureType": 2
 *   },
 *   "signature": "0x...",
 *   "outcome": "YES" | "NO"
 * }
 */
router.post('/place', async (req: Request, res: Response) => {
  try {
    // Check for any previously matched but unsettled orders and retry settlement
    // This ensures orders that failed settlement (e.g., due to token registration issues)
    // get another chance now that tokens are registered
    try {
      await SettlementRetryService.retryUnprocessedMatches();
    } catch (retryErr) {
      // Log but don't fail the order placement
      console.error('[Orders] Settlement retry failed:', retryErr);
    }

    const {
      marketId,
      orderData,
      signature,
      outcome,
    } = req.body;

    // Validation
    if (!marketId || typeof marketId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Market ID is required and must be a string',
      });
    }

    if (!orderData) {
      return res.status(400).json({
        success: false,
        error: 'Order data is required (EIP712 message)',
      });
    }

    if (!signature) {
      return res.status(400).json({
        success: false,
        error: 'Signature is required (EIP712 signature)',
      });
    }

    if (!outcome || !Object.values(OutcomeType).includes(outcome)) {
      return res.status(400).json({
        success: false,
        error: 'Outcome must be YES or NO',
      });
    }

    // Validate order message structure
    const msgValidation = validateOrderMessage(orderData);
    if (!msgValidation.valid) {
      return res.status(400).json({
        success: false,
        error: msgValidation.error,
      });
    }

    const eip712Message = orderData as EIP712OrderMessage;

    // Verify signature
    const isValidSignature = verifyOrderSignature(
      eip712Message,
      signature,
      eip712Message.signer // The signer field indicates who signed
    );

    if (!isValidSignature) {
      return res.status(400).json({
        success: false,
        error: 'Invalid signature: signature does not match signer',
      });
    }

    console.log('[Orders] Valid EIP712 signature verified for:', {
      signer: eip712Message.signer,
      maker: eip712Message.maker,
    });

    // Convert EIP712 message to internal order data
    const orderDataConverted = convertEIP712ToOrderData(eip712Message, marketId);

    // Additional validation
    if (!ethers.isAddress(orderDataConverted.makerAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid maker address from signature',
      });
    }

    // Enforce outcome token balance for SELL orders:
    // User cannot sell more YES/NO tokens than available in their wallet
    if (orderDataConverted.side === 'SELL') {
      const conditionalTokensAddress = process.env.CONDITIONAL_TOKENS_ADDRESS;
      if (!conditionalTokensAddress || !ethers.isAddress(conditionalTokensAddress)) {
        return res.status(500).json({
          success: false,
          error: 'Conditional tokens contract not configured',
        });
      }

      const ConditionalTokensABI = require('../abis/ConditionalTokens.json');
      const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'https://rpc-amoy.polygon.technology/');
      const ctfContract = new ethers.Contract(conditionalTokensAddress, ConditionalTokensABI, provider);

      try {
        const walletBalance: bigint = await ctfContract.balanceOf(orderDataConverted.makerAddress, eip712Message.tokenId);
        const required: bigint = BigInt(orderDataConverted.amount);
        if (walletBalance < required) {
          return res.status(400).json({
            success: false,
            error: `Insufficient ${outcome} tokens to sell. Available: ${walletBalance.toString()}, required: ${required.toString()}`,
          });
        }
      } catch (balanceErr: any) {
        console.error('[Orders] Error checking token balance:', balanceErr);
        return res.status(500).json({
          success: false,
          error: 'Failed to verify outcome token balance',
        });
      }
    }

    // Validate collateralization
    const collCheck = OrderMatchingEngine.validateCollateralization(
      orderDataConverted.side === OrderSide.BUY ? orderDataConverted.price : 1 - orderDataConverted.price,
      orderDataConverted.side === OrderSide.BUY ? 1 - orderDataConverted.price : orderDataConverted.price
    );

    if (!collCheck.isValid) {
      return res.status(400).json({
        success: false,
        error: `Collateralization check failed: ${collCheck.error}`,
      });
    }

    // Create order with signature
    const now = Date.now();
    const order: Order = {
      id: OrderMatchingEngine.generateOrderId(),
      marketId,
      makerAddress: orderDataConverted.makerAddress,
      signerAddress: eip712Message.signer,
      tokenId: eip712Message.tokenId,
      signature,
      side: orderDataConverted.side as OrderSide,
      outcome: outcome as OutcomeType,
      amount: orderDataConverted.amount,
      price: orderDataConverted.price,
      collateral: orderDataConverted.collateral,
      status: OrderStatus.PENDING,
      filledAmount: 0,
      remainingAmount: orderDataConverted.amount,
      createdAt: now,
      expiresAt: orderDataConverted.expiresAt,
      updatedAt: now,
      makerAmountRaw: eip712Message.makerAmount,
      takerAmountRaw: eip712Message.takerAmount,
      feeRateBps: eip712Message.feeRateBps,
      expirationRaw: eip712Message.expiration,
      nonce: eip712Message.nonce,
      sideNumeric: eip712Message.side,
      signatureType: eip712Message.signatureType,
      rawOrderData: eip712Message,
    };

    console.log('[Orders] New order received with EIP712 signature:', {
      id: order.id,
      market: marketId,
      maker: orderDataConverted.makerAddress,
      side: orderDataConverted.side,
      outcome,
      amount: orderDataConverted.amount,
      price: orderDataConverted.price,
    });

    // Store order in order book
    const orderBookService = getOrderBookService();
    orderBookService.addOrder(order);

    // Try to match against existing orders
    // Same outcome, opposite side (direct match)
    const sameOutcomeOppositeOrders = orderBookService.getMarketOutcomeOrders(
      marketId,
      outcome,
      orderDataConverted.side === OrderSide.BUY ? OrderSide.SELL : OrderSide.BUY
    );

    // Complementary outcome, SAME side (for collateral matching)
    // BUY YES + BUY NO can match if prices sum to ~1.0
    // SELL YES + SELL NO can match if prices sum to ~1.0
    const oppositeOutcomeOrders = orderBookService.getMarketOutcomeOrders(
      marketId,
      outcome === OutcomeType.YES ? OutcomeType.NO : OutcomeType.YES,
      orderDataConverted.side  // SAME side for complementary outcome matching
    );

    const matches = OrderMatchingEngine.matchOrder(
      order,
      sameOutcomeOppositeOrders,
      oppositeOutcomeOrders
    );

    // Log matches
    if (matches.length > 0) {
      console.log(`[Orders] Order matched with ${matches.length} maker(s)`);
      matches.forEach((match, idx) => {
        console.log(`[Orders] Match ${idx + 1}: ${match.maker.id} @ ${match.executionPrice}`);
      });
    }

    // Enqueue settlement jobs for on-chain match (one per match)
    if (matches.length > 0) {
      for (const m of matches) {
        // Check if this is a complementary outcome match
        // Complementary: BUY YES + BUY NO (or SELL YES + SELL NO) with different outcomes
        const isComplementaryMatch = 
          order.side === m.maker.side && 
          order.outcome !== m.maker.outcome;

        let takerFillInMakerTerms: string;
        let takerReceiveInTakerTerms: string;
        let makerFillInMakerTerms: string;

        if (isComplementaryMatch) {
          // For complementary outcome matching (BUY YES @ 0.52 + BUY NO @ 0.48):
          // Both orders buy different outcomes that sum to 1.0
          // Each order pays USDC based on its price for the outcome token
          // The fills should be equal in token quantity for the swap to work
          
          if (order.side === OrderSide.BUY) {
            // BUY orders: makerAmount is USDC, takerAmount is tokens
            // Taker (e.g., BUY NO @ 0.48): pays fillAmount * 0.48 USDC, receives fillAmount tokens
            // Maker (e.g., BUY YES @ 0.52): pays fillAmount * 0.52 USDC, receives fillAmount tokens
            takerFillInMakerTerms = Math.floor(m.fillAmount * order.price).toString();
            takerReceiveInTakerTerms = m.fillAmount.toString(); // tokens received
            makerFillInMakerTerms = Math.floor(m.fillAmount * m.maker.price).toString();
          } else {
            // SELL orders: makerAmount is tokens, takerAmount is USDC
            takerFillInMakerTerms = m.fillAmount.toString();
            takerReceiveInTakerTerms = Math.floor(m.fillAmount * order.price).toString();
            makerFillInMakerTerms = m.fillAmount.toString();
          }
        } else {
          // Regular matching (same outcome, opposite sides)
          // Convert fillAmount (token amount) to makerAmount terms
          // For BUY: fillAmount is in tokens, need to convert to USDC (makerAmount)
          // For SELL: fillAmount is already in tokens (makerAmount)
          
          takerFillInMakerTerms = order.side === OrderSide.BUY
            ? Math.floor(m.fillAmount * order.price).toString()
            : m.fillAmount.toString();
          
          takerReceiveInTakerTerms = order.side === OrderSide.BUY
            ? m.fillAmount.toString()
            : Math.floor(m.fillAmount * (1 - order.price)).toString();
          
          makerFillInMakerTerms = m.maker.side === OrderSide.BUY
            ? Math.floor(m.fillAmount * m.maker.price).toString()
            : m.fillAmount.toString();
        }

        console.log(`[Orders] Settlement job - Complementary: ${isComplementaryMatch}, TakerFill: ${takerFillInMakerTerms}, TakerReceive: ${takerReceiveInTakerTerms}, MakerFill: ${makerFillInMakerTerms}`);
        console.log(`[Orders] Taker order: ${order.id} (${order.side} ${order.outcome} @ ${order.price}, amount: ${order.amount})`);
        console.log(`[Orders] Maker order: ${m.maker.id} (${m.maker.side} ${m.maker.outcome} @ ${m.maker.price}, amount: ${m.maker.amount})`);

        settlementQueue.enqueue({
          takerOrder: order,
          makerOrders: [m.maker],
          takerFillAmount: takerFillInMakerTerms,
          takerReceiveAmount: takerReceiveInTakerTerms,
          makerFillAmounts: [makerFillInMakerTerms],
          takerFeeAmount: '0',
          makerFeeAmounts: ['0'],
          marketId,
        });
      }
    }

    return res.json({
      success: true,
      order,
      matches: matches.length,
    });
  } catch (err: any) {
    console.error('[Orders] Error placing order:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/orders/:id
 * Get order details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orderBookService = getOrderBookService();
    const order = orderBookService.getOrder(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    return res.json({
      success: true,
      order,
    });
  } catch (err: any) {
    console.error('[Orders] Error fetching order:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/orders/user/:address
 * Get all orders for a user
 */
router.get('/user/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    if (!ethers.isAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid address',
      });
    }

    const orderBookService = getOrderBookService();
    const orders = orderBookService.getUserOrders(address);

    return res.json({
      success: true,
      orders,
      count: orders.length,
    });
  } catch (err: any) {
    console.error('[Orders] Error fetching user orders:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/orders/market/:marketId
 * Get orderbook for a market
 * Query params:
 * - outcome: YES | NO (optional, get both if not specified)
 */
router.get('/market/:marketId', async (req: Request, res: Response) => {
  try {
    const { marketId } = req.params;
    const { outcome } = req.query;

    const orderBookService = getOrderBookService();

    if (outcome) {
      // Return specific outcome orderbook
      if (!Object.values(OutcomeType).includes(outcome as OutcomeType)) {
        return res.status(400).json({
          success: false,
          error: 'Outcome must be YES or NO',
        });
      }

      const book = orderBookService.getOrderBook(marketId, outcome as OutcomeType);

      if (!book) {
        return res.json({
          success: true,
          orderbook: {
            marketId,
            outcome,
            buySide: [],
            sellSide: [],
            lastUpdateTime: Date.now(),
          },
        });
      }

      return res.json({
        success: true,
        orderBook: book,
      });
    } else {
      // Return both YES and NO orderbooks
      const books = orderBookService.getMarketOrderBooks(marketId);

      return res.json({
        success: true,
        orderbooks: {
          yes: books.get(OutcomeType.YES),
          no: books.get(OutcomeType.NO),
        },
      });
    }
  } catch (err: any) {
    console.error('[Orders] Error fetching orderbook:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/orders/market/:marketId/prices
 * Get market prices (mid, bid, ask)
 */
router.get('/market/:marketId/prices', async (req: Request, res: Response) => {
  try {
    const { marketId } = req.params;
    const orderBookService = getOrderBookService();
    const prices = orderBookService.getMarketPrices(marketId);

    // Verify collateralization
    const collCheck = OrderMatchingEngine.validateCollateralization(
      prices.yes.midPrice,
      prices.no.midPrice
    );

    return res.json({
      success: true,
      prices,
      collateralizationCheck: collCheck,
    });
  } catch (err: any) {
    console.error('[Orders] Error fetching prices:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  }
});

/**
 * DELETE /api/orders/:id
 * Cancel an order
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orderBookService = getOrderBookService();
    const order = orderBookService.getOrder(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    const success = orderBookService.cancelOrder(id);

    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to cancel order',
      });
    }

    return res.json({
      success: true,
      message: `Order ${id} cancelled`,
    });
  } catch (err: any) {
    console.error('[Orders] Error cancelling order:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  }
});

/**
 * POST /api/orders/market/:marketId/settle
 * Manually match and settle all pending orders for a market
 * Useful for testing and manual settlement of existing orders
 * 
 * This endpoint:
 * 1. Gets all pending orders for the market
 * 2. Attempts to match them (including complementary cross-outcome matching)
 * 3. Enqueues settlement jobs
 * 4. Processes the settlement queue
 */
router.post('/market/:marketId/settle', async (req: Request, res: Response) => {
  try {
    const { marketId } = req.params;

    if (!marketId) {
      return res.status(400).json({
        success: false,
        error: 'marketId is required',
      });
    }

    console.log(`[Orders] Manual settlement started for market: ${marketId}`);

    const orderBookService = getOrderBookService();
    
    // Get all pending orders for this market
    const yesBook = orderBookService.getOrderBook(marketId, OutcomeType.YES);
    const noBook = orderBookService.getOrderBook(marketId, OutcomeType.NO);

    if (!yesBook && !noBook) {
      return res.json({
        success: true,
        message: 'No orders found for this market',
        matchCount: 0,
        settlementCount: 0,
      });
    }

    let totalMatches = 0;
    let totalSettlements = 0;

    // Get all orders from both sides of both books
    const yesOrders = [
      ...(yesBook ? yesBook.buySide : []),
      ...(yesBook ? yesBook.sellSide : [])
    ];
    const noOrders = [
      ...(noBook ? noBook.buySide : []),
      ...(noBook ? noBook.sellSide : [])
    ];

    const allOrders = [...yesOrders, ...noOrders];
    const pendingOrders = allOrders.filter(
      order => order.status === OrderStatus.PENDING || order.status === OrderStatus.PARTIAL_FILLED
    );

    console.log(`[Orders] Found ${pendingOrders.length} pending orders`);

    // For each pending order, try to match it
    for (const order of pendingOrders) {
      if (order.status === OrderStatus.FULLY_FILLED) continue;

      // Get opposite orders
      const oppositeOutcome = order.outcome === OutcomeType.YES ? OutcomeType.NO : OutcomeType.YES;
      
      const sameOutcomeOpposites = orderBookService.getMarketOutcomeOrders(
        marketId,
        order.outcome,
        order.side === OrderSide.BUY ? OrderSide.SELL : OrderSide.BUY
      );

      const differentOutcomeSameSide = orderBookService.getMarketOutcomeOrders(
        marketId,
        oppositeOutcome,
        order.side
      );

      // Try to match
      const matches = OrderMatchingEngine.matchOrder(
        order,
        sameOutcomeOpposites,
        differentOutcomeSameSide
      );

      if (matches.length > 0) {
        console.log(`[Orders] Found ${matches.length} matches for order ${order.id}`);
        totalMatches += matches.length;

        // Enqueue settlement for each match
        for (const match of matches) {
          // Convert fillAmount to proper terms (makerAmount for fillAmount, takerAmount for receiveAmount)
          const takerFillInMakerTerms = order.side === OrderSide.BUY
            ? Math.floor(match.fillAmount * order.price).toString()
            : match.fillAmount.toString();
          
          const takerReceiveInTakerTerms = order.side === OrderSide.BUY
            ? match.fillAmount.toString()
            : Math.floor(match.fillAmount * (1 - order.price)).toString();
          
          const makerFillInMakerTerms = match.maker.side === OrderSide.BUY
            ? Math.floor(match.fillAmount * match.maker.price).toString()
            : match.fillAmount.toString();

          settlementQueue.enqueue({
            takerOrder: order,
            makerOrders: [match.maker],
            takerFillAmount: takerFillInMakerTerms,
            takerReceiveAmount: takerReceiveInTakerTerms,
            makerFillAmounts: [makerFillInMakerTerms],
            takerFeeAmount: '0',
            makerFeeAmounts: ['0'],
            marketId,
          });

          totalSettlements++;
          console.log(`[Orders] Enqueued settlement for match ${totalSettlements}`);
        }
      }
    }

    return res.json({
      success: true,
      message: `Settlement process completed for market ${marketId}`,
      ordersProcessed: pendingOrders.length,
      matchCount: totalMatches,
      settlementCount: totalSettlements,
      queueSize: settlementQueue.size(),
    });
  } catch (err: any) {
    console.error('[Orders] Error during manual settlement:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  }
});

/**
 * Revert order matching for a specific market
 * POST /api/orders/market/:marketId/revert
 */
router.post('/market/:marketId/revert', async (req: Request, res: Response) => {
  try {
    const { marketId } = req.params;

    if (!marketId) {
      return res.status(400).json({
        success: false,
        error: 'Market ID is required',
      });
    }

    console.log(`[Orders] Reverting order matches for market: ${marketId}`);

    const orderBookService = getOrderBookService();
    
    // Get all orders for this market (both YES and NO outcomes)
    const yesOrders = [
      ...orderBookService.getMarketOutcomeOrders(marketId, OutcomeType.YES, OrderSide.BUY),
      ...orderBookService.getMarketOutcomeOrders(marketId, OutcomeType.YES, OrderSide.SELL),
    ];
    
    const noOrders = [
      ...orderBookService.getMarketOutcomeOrders(marketId, OutcomeType.NO, OrderSide.BUY),
      ...orderBookService.getMarketOutcomeOrders(marketId, OutcomeType.NO, OrderSide.SELL),
    ];

    const allOrders = [...yesOrders, ...noOrders];
    let revertedCount = 0;

    // Revert all filled/partial orders back to pending
    for (const order of allOrders) {
      if (order.status === OrderStatus.FULLY_FILLED || order.status === OrderStatus.PARTIAL_FILLED) {
        order.status = OrderStatus.PENDING;
        order.filledAmount = 0;
        order.remainingAmount = order.amount;
        order.updatedAt = Date.now();
        
        orderBookService.updateOrderStatus(order.id, OrderStatus.PENDING);
        revertedCount++;
        
        console.log(`[Orders] Reverted order ${order.id} to PENDING`);
      }
    }

    // Clear settlement queue for this market (simple approach - clear all)
    // Note: In production, you'd want to filter by marketId
    const queueSizeBefore = settlementQueue.size();
    let clearedJobs = 0;
    
    while (settlementQueue.size() > 0) {
      const job = settlementQueue.dequeue();
      if (job && job.marketId !== marketId) {
        // Re-enqueue jobs for other markets
        settlementQueue.enqueue(job);
      } else {
        clearedJobs++;
      }
      
      // Safety check to prevent infinite loop
      if (clearedJobs + settlementQueue.size() >= queueSizeBefore) {
        break;
      }
    }

    console.log(`[Orders] Reverted ${revertedCount} orders and cleared ${clearedJobs} settlement jobs`);

    return res.json({
      success: true,
      message: `Reverted order matches for market ${marketId}`,
      ordersReverted: revertedCount,
      settlementJobsCleared: clearedJobs,
      remainingQueueSize: settlementQueue.size(),
    });
  } catch (err: any) {
    console.error('[Orders] Error reverting orders:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/orders/debug/status/:marketId
 * Debug endpoint to check settlement queue and order status for a market
 */
router.get('/debug/status/:marketId', async (req: Request, res: Response) => {
  try {
    const { marketId } = req.params;
    const orderBookService = getOrderBookService();

    // Get all orders for this market by side
    const yesBuyOrders = orderBookService.getMarketOutcomeOrders(
      marketId,
      OutcomeType.YES,
      OrderSide.BUY
    );
    const yesSellOrders = orderBookService.getMarketOutcomeOrders(
      marketId,
      OutcomeType.YES,
      OrderSide.SELL
    );
    const noBuyOrders = orderBookService.getMarketOutcomeOrders(
      marketId,
      OutcomeType.NO,
      OrderSide.BUY
    );
    const noSellOrders = orderBookService.getMarketOutcomeOrders(
      marketId,
      OutcomeType.NO,
      OrderSide.SELL
    );

    // Get settlement queue size
    const queueSize = settlementQueue.size();

    return res.json({
      success: true,
      marketId,
      settlementQueueSize: queueSize,
      orders: {
        YES: {
          BUY: yesBuyOrders.map(o => ({
            id: o.id,
            amount: o.amount,
            remainingAmount: o.remainingAmount,
            price: o.price,
            status: o.status,
            makerAddress: o.makerAddress,
          })),
          SELL: yesSellOrders.map(o => ({
            id: o.id,
            amount: o.amount,
            remainingAmount: o.remainingAmount,
            price: o.price,
            status: o.status,
            makerAddress: o.makerAddress,
          })),
        },
        NO: {
          BUY: noBuyOrders.map(o => ({
            id: o.id,
            amount: o.amount,
            remainingAmount: o.remainingAmount,
            price: o.price,
            status: o.status,
            makerAddress: o.makerAddress,
          })),
          SELL: noSellOrders.map(o => ({
            id: o.id,
            amount: o.amount,
            remainingAmount: o.remainingAmount,
            price: o.price,
            status: o.status,
            makerAddress: o.makerAddress,
          })),
        },
      },
      message: 'Debug info for market',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Orders Debug] Error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  }
});

export default router;
