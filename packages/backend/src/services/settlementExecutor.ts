import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';
import feeModuleAbi from '../abis/FeeModule.json';
import { MatchedOrders, Order } from '../types/orders';

// Load env once (server already loads, but this is defensive)
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

const FEE_MODULE_ADDRESS = process.env.FEE_MODULE_ADDRESS || process.env.NEG_RISK_FEE_MODULE || '';
const RPC_URL = process.env.RPC_URL || process.env.ALCHEMY_RPC_URL || '';
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY || process.env.PK || '';

if (!FEE_MODULE_ADDRESS) {
  console.warn('[SettlementExecutor] FEE_MODULE_ADDRESS not set');
}
if (!RPC_URL) {
  console.warn('[SettlementExecutor] RPC_URL not set');
}
if (!ADMIN_PRIVATE_KEY) {
  console.warn('[SettlementExecutor] ADMIN_PRIVATE_KEY not set');
}

export interface SettlementJob {
  takerOrder: Order;
  makerOrders: Order[];
  takerFillAmount: string;      // makerAmount terms
  takerReceiveAmount: string;   // takerAmount terms
  makerFillAmounts: string[];   // makerAmount terms per maker
  takerFeeAmount: string;       // raw
  makerFeeAmounts: string[];    // raw per maker
  marketId: string;
}

export class SettlementExecutor {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private feeModule: ethers.Contract;

  constructor() {
    if (!RPC_URL || !ADMIN_PRIVATE_KEY || !FEE_MODULE_ADDRESS) {
      throw new Error('SettlementExecutor missing configuration');
    }
    this.provider = new ethers.JsonRpcProvider(RPC_URL);
    this.wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, this.provider);
    // TS guard: FeeModule.json shape is { abi, bytecode, ... }
    const feeModuleInterface = feeModuleAbi.abi as ethers.InterfaceAbi;
    this.feeModule = new ethers.Contract(FEE_MODULE_ADDRESS, feeModuleInterface, this.wallet);
  }

  async settle(job: SettlementJob): Promise<string> {
    // Basic shape validation
    if (!job.takerOrder || !job.makerOrders || job.makerOrders.length === 0) {
      throw new Error('Invalid settlement job: missing orders');
    }

    // Build calldata for FeeModule.matchOrders
    // matchOrders(
    //   Order takerOrder,
    //   Order[] makerOrders,
    //   uint256 takerFillAmount,
    //   uint256 takerReceiveAmount,
    //   uint256[] makerFillAmounts,
    //   uint256 takerFeeAmount,
    //   uint256[] makerFeeAmounts
    // )

    const taker = this.toFeeModuleOrder(job.takerOrder);
    const makers = job.makerOrders.map((m) => this.toFeeModuleOrder(m));

    console.log('[SettlementExecutor] Settlement parameters:');
    console.log('  Taker order ID:', job.takerOrder.id);
    console.log('  Taker order makerAmount:', taker.makerAmount);
    console.log('  Taker order takerAmount:', taker.takerAmount);
    console.log('  Taker fillAmount:', job.takerFillAmount);
    console.log('  Taker receiveAmount:', job.takerReceiveAmount);
    console.log('  Maker order ID:', job.makerOrders[0].id);
    console.log('  Maker order makerAmount:', makers[0].makerAmount);
    console.log('  Maker order takerAmount:', makers[0].takerAmount);
    console.log('  Maker fillAmounts:', job.makerFillAmounts);
    
    // Check if fill amounts exceed order amounts
    if (BigInt(job.takerFillAmount) > BigInt(taker.makerAmount)) {
      console.log('[SettlementExecutor] ❌ ERROR: Taker fill amount exceeds makerAmount!');
      console.log(`  job.takerFillAmount (${job.takerFillAmount}) > taker.makerAmount (${taker.makerAmount})`);
      console.log(`  Taker order details:`, {
        side: taker.side,
        makerAmount: taker.makerAmount,
        takerAmount: taker.takerAmount,
      });
      throw new Error(`Taker fill amount ${job.takerFillAmount} exceeds taker makerAmount ${taker.makerAmount}`);
    }
    
    for (let i = 0; i < makers.length; i++) {
      if (BigInt(job.makerFillAmounts[i]) > BigInt(makers[i].makerAmount)) {
        console.log(`[SettlementExecutor] ❌ ERROR: Maker[${i}] fill amount exceeds makerAmount!`);
        console.log(`  job.makerFillAmounts[${i}] (${job.makerFillAmounts[i]}) > makers[${i}].makerAmount (${makers[i].makerAmount})`);
        console.log(`  Maker[${i}] order details:`, {
          side: makers[i].side,
          makerAmount: makers[i].makerAmount,
          takerAmount: makers[i].takerAmount,
        });
        throw new Error(`Maker[${i}] fill amount ${job.makerFillAmounts[i]} exceeds maker makerAmount ${makers[i].makerAmount}`);
      }
    }

    const tx = await this.feeModule.matchOrders(
      taker,
      makers,
      job.takerFillAmount,
      job.takerReceiveAmount,
      job.makerFillAmounts,
      job.takerFeeAmount,
      job.makerFeeAmounts
    );

    const receipt = await tx.wait();
    console.log('[SettlementExecutor] matchOrders tx submitted:', tx.hash);
    return receipt.hash;
  }

  private toFeeModuleOrder(order: Order) {
    // Use the exact order data that was signed (rawOrderData contains the EIP712 message)
    if (!order.rawOrderData) {
      throw new Error('Order missing rawOrderData - cannot reconstruct signed order');
    }

    const rawData = order.rawOrderData;
    const required = [
      rawData.salt,
      rawData.maker,
      rawData.signer,
      rawData.taker,
      rawData.tokenId,
      rawData.makerAmount,
      rawData.takerAmount,
      rawData.expiration,
      rawData.nonce,
      rawData.feeRateBps,
      rawData.side,
      rawData.signatureType,
      order.signature,
    ];
    if (required.some((v) => v === undefined || v === null)) {
      throw new Error('Order missing required EIP712 fields for settlement');
    }

    // Return the exact order struct that was signed
    return {
      salt: rawData.salt,
      maker: rawData.maker,
      signer: rawData.signer,
      taker: rawData.taker,
      tokenId: rawData.tokenId,
      makerAmount: rawData.makerAmount,
      takerAmount: rawData.takerAmount,
      expiration: rawData.expiration,
      nonce: rawData.nonce,
      feeRateBps: rawData.feeRateBps,
      side: rawData.side,
      signatureType: rawData.signatureType,
      signature: order.signature!,
    };
  }
}
