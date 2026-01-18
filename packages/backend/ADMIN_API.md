# Admin Market Creation Endpoint

## Overview
The backend now includes an admin endpoint `/api/admin/create-market` that allows creating new prediction markets on Polymarket using the UMA CTF Adapter and Conditional Tokens Framework.

## Configuration

The following environment variables must be set in `/packages/backend/.env`:

```env
# UMA CTF Adapter address (Polygon Amoy)
UMA_CTF_ADAPTER_ADDRESS=0xe45c422d27c517e6239c455cda2a52fe18ff096c

# Conditional Tokens Framework address
CONDITIONAL_TOKENS_ADDRESS=0x53dBaF3856166A512dA9A53c470A820b8cD7195c

# Admin private key (wallet that will submit transactions)
ADMIN_PRIVATE_KEY=your_private_key_here

# Polygon Amoy RPC URL
RPC_URL=https://rpc-amoy.polygon.technology/

# Optional: Reward and liveness settings
REWARD_TOKEN_ADDRESS=0x0000000000000000000000000000000000000000  # No reward
REWARD_AMOUNT=0
PROPOSAL_BOND=0  # Uses default
LIVENESS=7200  # 2 hours in seconds
```

## API Endpoints

### 1. Create Market

**POST** `/api/admin/create-market`

Creates a new prediction market on-chain.

**Request Body:**
```json
{
  "question": "Will BTC hit $150K by end of July 31, 2026?",
  "description": "This market will resolve to 'Yes' if Bitcoin's price reaches $150,000 USD at any point before or on July 31, 2026, 11:59 PM UTC. The price will be determined by major cryptocurrency exchanges (Coinbase, Binance, Kraken average). Otherwise, it resolves to 'No'.",
  "category": "Crypto",
  "resolutionSource": "https://coinmarketcap.com",
  "endTime": 1753920000,
  "image": "₿"
}
```

**Field Descriptions:**
- `question` (required): The market question (string)
- `description` (required): Detailed description of resolution criteria (string)
- `category` (required): Market category (string, e.g., "Crypto", "Politics", "Sports")
- `resolutionSource` (optional): URL or description of resolution data source (string)
- `endTime` (required): Unix timestamp when market question resolves (number, must be in future)
- `image` (optional): Emoji or icon to display for the market (string)

**Response:**
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
    "description": "...",
    "category": "Crypto",
    "resolutionSource": "https://coinmarketcap.com",
    "endTime": 1753920000,
    "image": "₿",
    "tokenIds": {
      "yesTokenId": "0x9876...5432",
      "noTokenId": "0x1357...2468"
    },
    "createdAt": 1705123456789,
    "resolved": false,
    "txHash": "0x..."
  }
}
```

### 2. Get Admin Info

**GET** `/api/admin/info`

Returns admin service configuration and status.

**Response:**
```json
{
  "success": true,
  "adminAddress": "0x2A9e714b63E70Af1c73d865Ab5A3C044F3773905",
  "config": {
    "umaAdapter": "0xe45c422d27c517e6239c455cda2a52fe18ff096c",
    "conditionalTokens": "0x53dBaF3856166A512dA9A53c470A820b8cD7195c",
    "rewardToken": "0x0000000000000000000000000000000000000000"
  }
}
```

## Example Usage

### Using cURL

```bash
# Create a market
curl -X POST http://localhost:3001/api/admin/create-market \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Will BTC hit $150K by end of July 31, 2026?",
    "description": "This market will resolve to Yes if Bitcoin reaches $150,000 USD by July 31, 2026",
    "category": "Crypto",
    "resolutionSource": "https://coinmarketcap.com",
    "endTime": 1753920000,
    "image": "₿"
  }'

# Get admin info
curl http://localhost:3001/api/admin/info
```

### Using JavaScript/Axios

```javascript
const axios = require('axios');

async function createMarket() {
  try {
    const response = await axios.post('http://localhost:3001/api/admin/create-market', {
      question: "Will BTC hit $150K by end of July 31, 2026?",
      description: "This market will resolve to Yes if Bitcoin reaches $150,000 USD by July 31, 2026",
      category: "Crypto",
      resolutionSource: "https://coinmarketcap.com",
      endTime: 1753920000, // July 31, 2026 UTC
      image: "₿"
    });

    console.log('Market created:', response.data);
    console.log('Question ID:', response.data.questionId);
    console.log('YES Token ID:', response.data.tokenIds.yesTokenId);
    console.log('NO Token ID:', response.data.tokenIds.noTokenId);
  } catch (error) {
    console.error('Error creating market:', error.response?.data || error.message);
  }
}

createMarket();
```

## How It Works

1. **Ancillary Data Construction**: The question and metadata are formatted into UMA ancillary data format
2. **UMA Adapter Initialize**: Calls `initialize()` on the UMA CTF Adapter contract, which:
   - Stores the question parameters
   - Calls `prepareCondition()` on the Conditional Tokens Framework
   - Requests a price from UMA's Optimistic Oracle
3. **Event Extraction**: Extracts the `questionId` from the `QuestionInitialized` event
4. **Token ID Derivation**: Computes the ERC1155 token IDs for YES/NO outcomes using:
   - `conditionId = keccak256(oracle, questionId, outcomeSlotCount)`
   - `collectionId = keccak256(parentCollectionId, conditionId, indexSet)`
   - `positionId = keccak256(collateralToken, collectionId)`

## Token ID Calculation

The token IDs are derived following the CTF specification:
- **YES Token**: Represents outcome index 1 (bit 0 set)
- **NO Token**: Represents outcome index 2 (bit 1 set)

These token IDs can be used with the CTF Exchange for trading.

## Market Resolution

Markets are resolved by UMA's Optimistic Oracle based on the resolution source and criteria specified in the ancillary data. After the liveness period, anyone can propose an answer, which becomes final unless disputed.

## Notes

- The admin wallet must have MATIC for gas fees on Polygon Amoy
- Markets are created on Polygon Amoy testnet
- QuestionIDs and ConditionIDs are deterministic based on the question content
- Each market creation costs gas (estimated ~500k gas units)
