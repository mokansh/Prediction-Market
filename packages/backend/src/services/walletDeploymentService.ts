import { ethers } from 'ethers';

// Load ABI using require for CommonJS compatibility
const SafeProxyFactoryJSON = require('../abis/SafeProxyFactory.json');
const SafeProxyFactoryABI = SafeProxyFactoryJSON.abi || SafeProxyFactoryJSON;

// Load Safe ABI for reading nonce
const SafeJSON = require('../abis/Safe.json');
const SafeABI = SafeJSON.abi || SafeJSON;

// Get config values at runtime (after dotenv.config() has been called)
function getConfig() {
  return {
    SAFE_PROXY_FACTORY_ADDRESS: process.env.SAFE_PROXY_FACTORY_ADDRESS || '',
    ADMIN_PRIVATE_KEY: process.env.ADMIN_PRIVATE_KEY || '',
    RPC_URL: process.env.RPC_URL || 'https://rpc-amoy.polygon.technology/',
  };
}


interface Signature {
  r: string;
  s: string;
  v: number;
}

interface DeploymentParams {
  userAddress: string;
  signature: Signature;
  paymentToken: string;
  payment: string | number;
  paymentReceiver: string;
}

interface DeploymentResult {
  success: boolean;
  proxyAddress?: string;
  transactionHash?: string;
  error?: string;
}

interface SafeTx {
  to: string;
  value: number;
  data: string;
  operation: number;
  safeTxGas: number;
  baseGas: number;
  gasPrice: number;
  gasToken: string;
  refundReceiver: string;
  nonce: number;
}

interface ApprovalParams {
  proxyAddress: string;
  safeTx: SafeTx;
  signature: Signature;
}

interface ApprovalResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

export class WalletDeploymentService {
  private provider: ethers.JsonRpcProvider;
  private adminWallet: ethers.Wallet | null = null;
  private safeProxyFactory: ethers.Contract | null = null;

  constructor() {
    const config = getConfig();
    
    this.provider = new ethers.JsonRpcProvider(config.RPC_URL);
    
    // Only initialize wallet if we have valid keys
    if (config.ADMIN_PRIVATE_KEY && config.ADMIN_PRIVATE_KEY.length > 10) {
      try {
        this.adminWallet = new ethers.Wallet(config.ADMIN_PRIVATE_KEY, this.provider);
        console.log('[WalletDeploymentService] Admin wallet initialized:', this.adminWallet.address);
        
        if (config.SAFE_PROXY_FACTORY_ADDRESS && config.SAFE_PROXY_FACTORY_ADDRESS !== '0x0000000000000000000000000000000000000000') {
          console.log('[WalletDeploymentService] Initializing SafeProxyFactory at:', config.SAFE_PROXY_FACTORY_ADDRESS);
          console.log('[WalletDeploymentService] SafeProxyFactoryABI type:', typeof SafeProxyFactoryABI);
          console.log('[WalletDeploymentService] SafeProxyFactoryABI is array:', Array.isArray(SafeProxyFactoryABI));
          
          this.safeProxyFactory = new ethers.Contract(
            config.SAFE_PROXY_FACTORY_ADDRESS,
            SafeProxyFactoryABI,
            this.adminWallet
          );
          console.log('[WalletDeploymentService] SafeProxyFactory contract initialized');
        } else {
          console.warn('[WalletDeploymentService] SafeProxyFactory address not configured');
        }
      } catch (error) {
        console.error('[WalletDeploymentService] Error during initialization:', error);
        console.warn('[WalletDeploymentService] Could not initialize wallet. Check ADMIN_PRIVATE_KEY and SAFE_PROXY_FACTORY_ADDRESS in .env');
      }
    } else {
      console.warn('[WalletDeploymentService] ADMIN_PRIVATE_KEY not configured in environment');
    }
  }

  /**
   * Checks if a multisig wallet is deployed for the given user address
   */
  async checkWalletDeployment(userAddress: string): Promise<{ isDeployed: boolean; proxyAddress: string }> {
    try {
      if (!this.safeProxyFactory) {
        return {
          isDeployed: false,
          proxyAddress: 'Contract not configured',
        };
      }

      // Compute the expected proxy address for this user
      const proxyAddress = await this.safeProxyFactory.computeProxyAddress(userAddress);
      
      // Check if code exists at this address (deployed contract will have code)
      const code = await this.provider.getCode(proxyAddress);
      const isDeployed = code !== '0x';

      return {
        isDeployed,
        proxyAddress,
      };
    } catch (error) {
      console.error('Error checking wallet deployment:', error);
      throw new Error('Failed to check wallet deployment status');
    }
  }

  /**
   * Deploys a multisig wallet for the user using the provided signature
   */
  async deployWallet(params: DeploymentParams): Promise<DeploymentResult> {
    const { userAddress, signature, paymentToken, payment, paymentReceiver } = params;

    try {
      if (!this.adminWallet || !this.safeProxyFactory) {
        return {
          success: false,
          error: 'Backend wallet not properly configured. Check ADMIN_PRIVATE_KEY and SAFE_PROXY_FACTORY_ADDRESS in .env',
        };
      }

      // First check if already deployed
      const { isDeployed, proxyAddress } = await this.checkWalletDeployment(userAddress);
      
      if (isDeployed) {
        return {
          success: true,
          proxyAddress,
          error: 'Wallet already deployed',
        };
      }

      // Prepare the signature struct
      const createSig = {
        v: signature.v,
        r: signature.r,
        s: signature.s,
      };

      // Call createProxy function on the SafeProxyFactory contract
      console.log('Deploying wallet for user:', userAddress);
      console.log('Payment token:', paymentToken);
      console.log('Payment amount:', payment);
      console.log('Payment receiver:', paymentReceiver);
      
      const tx = await this.safeProxyFactory.createProxy(
        paymentToken,
        payment,
        paymentReceiver,
        createSig
      );

      console.log('Transaction sent:', tx.hash);
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      console.log('Transaction confirmed:', receipt.hash);

      // Extract proxy address from event logs
      const proxyCreationEvent = receipt.logs.find(
        (log: any) => {
          try {
            const parsed = this.safeProxyFactory.interface.parseLog(log);
            return parsed?.name === 'ProxyCreation';
          } catch {
            return false;
          }
        }
      );

      let deployedProxyAddress = proxyAddress;
      if (proxyCreationEvent) {
        const parsed = this.safeProxyFactory.interface.parseLog(proxyCreationEvent);
        deployedProxyAddress = parsed?.args.proxy;
      }

      return {
        success: true,
        proxyAddress: deployedProxyAddress,
        transactionHash: receipt.hash,
      };
    } catch (error: any) {
      console.error('Error deploying wallet:', error);
      return {
        success: false,
        error: error.message || 'Failed to deploy wallet',
      };
    }
  }

  /**
   * Gets the admin wallet address (for verification purposes)
   */
  getAdminAddress(): string {
    return this.adminWallet?.address || 'Not configured';
  }

  /**
   * Get the current nonce of a proxy wallet
   */
  async getProxyNonce(proxyAddress: string): Promise<number> {
    try {
      if (!ethers.isAddress(proxyAddress)) {
        throw new Error('Invalid proxy address');
      }

      // Create a contract interface for reading the nonce
      const safeContract = new ethers.Contract(proxyAddress, SafeABI, this.provider);
      
      // Call nonce() function on the Safe contract
      const nonce = await safeContract.nonce();
      
      console.log('[WalletDeploymentService] Current nonce for', proxyAddress, ':', nonce.toString());
      return parseInt(nonce.toString(), 10);
    } catch (error: any) {
      console.error('[WalletDeploymentService] Error getting nonce:', error);
      throw new Error(`Failed to get nonce for proxy: ${error.message}`);
    }
  }

  /**
   * Execute token approvals through the proxy wallet using a signed SafeTx
   */
  async executeTokenApprovals(params: ApprovalParams): Promise<ApprovalResult> {
    const { proxyAddress, safeTx, signature } = params;

    try {
      if (!this.adminWallet) {
        return {
          success: false,
          error: 'Admin wallet not configured',
        };
      }

      if (!ethers.isAddress(proxyAddress)) {
        return {
          success: false,
          error: 'Invalid proxy address',
        };
      }

      console.log('[WalletDeploymentService] Executing token approvals for:', proxyAddress);
      console.log('[WalletDeploymentService] SafeTx data:', {
        to: safeTx.to,
        value: safeTx.value,
        operation: safeTx.operation,
        nonce: safeTx.nonce,
        dataLength: safeTx.data.length,
      });

      // Create Safe contract instance
      const safeContract = new ethers.Contract(proxyAddress, SafeABI, this.adminWallet);

      // Reconstruct the signature
      const sig = ethers.Signature.from({
        r: signature.r,
        s: signature.s,
        v: signature.v,
      });

      const fullSignature = sig.serialized;
      console.log('[WalletDeploymentService] Reconstructed signature:', fullSignature);

      // Execute the SafeTx through the proxy
      // Using execTransaction function on Safe contract
      const tx = await safeContract.execTransaction(
        safeTx.to,           // to
        safeTx.value,        // value
        safeTx.data,         // data
        safeTx.operation,    // operation
        safeTx.safeTxGas,    // safeTxGas
        safeTx.baseGas,      // baseGas
        safeTx.gasPrice,     // gasPrice
        safeTx.gasToken,     // gasToken
        safeTx.refundReceiver, // refundReceiver
        fullSignature        // signatures
      );

      console.log('[WalletDeploymentService] Transaction sent:', tx.hash);

      // Wait for confirmation
      const receipt = await tx.wait();
      console.log('[WalletDeploymentService] Transaction confirmed:', receipt.hash);

      return {
        success: true,
        transactionHash: receipt.hash,
      };
    } catch (error: any) {
      console.error('[WalletDeploymentService] Error executing token approvals:', error);
      return {
        success: false,
        error: error.message || 'Failed to execute token approvals',
      };
    }
  }
}

// Note: Service is now instantiated lazily in routes/wallet.ts to ensure env vars are loaded
