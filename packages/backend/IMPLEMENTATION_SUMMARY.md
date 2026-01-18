# Admin Market Creation Feature - Implementation Summary

## Overview
Added an admin endpoint to create prediction markets on Polymarket using the UMA CTF Adapter and Conditional Tokens Framework smart contracts.

## Files Added

### Backend Services
1. **`src/services/marketCreationService.ts`**
   - `MarketCreationService` class for interacting with smart contracts
   - Methods:
     - `createMarket()`: Creates a new market on-chain
     - `constructAncillaryData()`: Formats question data for UMA Oracle
     - `deriveTokenIds()`: Computes YES/NO ERC1155 token IDs
     - `getAdminAddress()`: Returns admin wallet address

2. **`src/routes/admin.ts`**
   - Admin API routes
   - Endpoints:
     - `POST /api/admin/create-market`: Create new prediction market
     - `GET /api/admin/info`: Get admin configuration

### Contract ABIs
3. **`src/abis/UmaCtfAdapter.json`**
   - ABI for UMA CTF Adapter contract
   - Extracted from compiled Solidity contracts

4. **`src/abis/ConditionalTokens.json`**
   - ABI for Conditional Tokens Framework contract
   - Copied from artifacts

### Documentation
5. **`ADMIN_API.md`**
   - Complete API documentation
   - Configuration guide
   - Example usage (cURL, JavaScript)
   - Technical explanation of market creation process

6. **`examples/createMarket.ts`**
   - Working example script
   - Demonstrates API usage
   - Can be run with: `ts-node examples/createMarket.ts`

## Configuration Added

### Environment Variables (`.env`)
```env
# Market Creation Contracts (Polygon Amoy Testnet)
UMA_CTF_ADAPTER_ADDRESS=0xe45c422d27c517e6239c455cda2a52fe18ff096c
CONDITIONAL_TOKENS_ADDRESS=0x53dBaF3856166A512dA9A53c470A820b8cD7195c
REWARD_TOKEN_ADDRESS=0x0000000000000000000000000000000000000000
REWARD_AMOUNT=0
PROPOSAL_BOND=0
LIVENESS=7200
```

## Smart Contract Integration

### Deployed Contracts (Polygon Amoy)
- **UMA CTF Adapter**: `0xe45c422d27c517e6239c455cda2a52fe18ff096c`
- **Conditional Tokens**: `0x53dBaF3856166A512dA9A53c470A820b8cD7195c`
- **CTF Exchange**: `0xda44ebdbcac8860e6c0ce4113b9359b3036e1f0b`

### Market Creation Flow
1. Admin calls `/api/admin/create-market` with market parameters
2. Service constructs UMA ancillary data from question
3. Calls `UmaCtfAdapter.initialize()`:
   - Stores question parameters
   - Calls `CTF.prepareCondition()` 
   - Requests price from UMA Optimistic Oracle
4. Extracts `questionId` from `QuestionInitialized` event
5. Computes:
   - `conditionId` from oracle + questionId + outcomeSlotCount
   - `collectionIds` for YES/NO outcomes
   - `positionIds` (ERC1155 token IDs) for trading

### Token ID Derivation
Based on [Polymarket CTF specification](https://gist.github.com/L-Kov/950bce141a9d1aa1ed3b1cfce6d30217):

```typescript
// Condition ID
conditionId = keccak256(oracle, questionId, outcomeSlotCount)

// Collection IDs (YES = index 1, NO = index 2)
yesCollectionId = keccak256(parentCollectionId, conditionId, 1 << 0)
noCollectionId = keccak256(parentCollectionId, conditionId, 1 << 1)

// Position IDs (ERC1155 token IDs)
yesTokenId = keccak256(collateralToken, yesCollectionId)
noTokenId = keccak256(collateralToken, noCollectionId)
```

## API Usage Example

### Create a Market
```bash
curl -X POST http://localhost:3001/api/admin/create-market \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Will BTC hit $150K by end of July 31, 2026?",
    "description": "This market resolves to Yes if Bitcoin reaches $150,000 USD by July 31, 2026",
    "category": "Crypto",
    "resolutionSource": "https://coinmarketcap.com",
    "endTime": 1753920000,
    "image": "₿"
  }'
```

### Response
```json
{
  "success": true,
  "questionId": "0x1234...5678",
  "conditionId": "0xabcd...ef01",
  "tokenIds": {
    "yesTokenId": "0x9876...5432",
    "noTokenId": "0x1357...2468"
  },
  "market": {
    "id": "0x1234...5678",
    "conditionId": "0xabcd...ef01",
    "question": "Will BTC hit $150K by end of July 31, 2026?",
    "category": "Crypto",
    "tokenIds": {...},
    "txHash": "0x...",
    "createdAt": 1705123456789
  }
}
```

## Integration Points

### Server Updates
- Added import and route in `src/server.ts`:
  ```typescript
  import adminRoutes from './routes/admin';
  app.use('/api/admin', adminRoutes);
  ```

### Service Pattern
- Uses lazy initialization (same pattern as wallet deployment service)
- Loads config at runtime to ensure env variables are loaded
- Returns service instance via getter function instead of singleton

## Testing

To test the implementation:

```bash
# 1. Start the backend
cd packages/backend
npm run dev

# 2. In another terminal, run the example
npx ts-node examples/createMarket.ts

# 3. Or use curl
curl http://localhost:3001/api/admin/info
```

## Next Steps

To integrate with frontend:
1. Create admin UI component for market creation
2. Connect to `/api/admin/create-market` endpoint
3. Display created markets with token IDs
4. Integrate with CTF Exchange for trading

## Gas Costs
- Market creation: ~500k gas units
- On Polygon Amoy: Essentially free (testnet MATIC)
- On Polygon mainnet: ~$0.01-0.05 USD at typical gas prices

## Security Considerations
1. Admin endpoints should be protected with authentication in production
2. Consider adding role-based access control
3. Validate all market parameters thoroughly
4. Add rate limiting to prevent spam
5. Monitor admin wallet balance for gas

## References
- [Polymarket CTF Docs](https://docs.polymarket.com)
- [UMA Protocol Docs](https://docs.uma.xyz)
- [Token ID Calculation](https://gist.github.com/L-Kov/950bce141a9d1aa1ed3b1cfce6d30217)
- [CTF Exchange Contract](https://github.com/Polymarket/ctf-exchange)
