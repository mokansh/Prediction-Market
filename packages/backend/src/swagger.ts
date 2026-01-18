/**
 * Swagger/OpenAPI 3.0 Documentation for Polymarket CLOB API
 */

export const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Polymarket CLOB API',
    description: 'Centralized Limit Order Book (CLOB) for trading conditional tokens with EIP712 signatures',
    version: '1.0.0',
    contact: {
      name: 'Polymarket Support',
    },
  },
  servers: [
    {
      url: 'http://localhost:3001',
      description: 'Local development server',
    },
    {
      url: 'https://api.polymarket.com',
      description: 'Production server',
    },
  ],
  tags: [
    {
      name: 'Health',
      description: 'Server health checks',
    },
    {
      name: 'Orders',
      description: 'Order placement, retrieval, and management',
    },
    {
      name: 'Settlement',
      description: 'Order matching and on-chain settlement',
    },
    {
      name: 'Wallet',
      description: 'Wallet deployment and token approval',
    },
    {
      name: 'Markets',
      description: 'Market creation and management',
    },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        description: 'Check if the server is running',
        responses: {
          '200': {
            description: 'Server is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: {
                      type: 'string',
                      example: 'ok',
                    },
                    timestamp: {
                      type: 'string',
                      format: 'date-time',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/orders/place': {
      post: {
        tags: ['Orders'],
        summary: 'Place a new order with EIP712 signature',
        description: 'Place a new order on the CLOB with EIP712 signature verification',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['marketId', 'orderData', 'signature', 'outcome'],
                properties: {
                  marketId: {
                    type: 'string',
                    description: 'Market ID (hex string)',
                    example: '0x2ed745b7759d5f633d7a374dd73a1fc2a03866a64e70ee69d77049cc804528ea',
                  },
                  orderData: {
                    type: 'object',
                    required: [
                      'salt',
                      'maker',
                      'signer',
                      'taker',
                      'tokenId',
                      'makerAmount',
                      'takerAmount',
                      'expiration',
                      'nonce',
                      'feeRateBps',
                      'side',
                      'signatureType',
                    ],
                    properties: {
                      salt: {
                        type: 'string',
                        example: '1083786480826',
                      },
                      maker: {
                        type: 'string',
                        description: 'Maker address',
                        example: '0x7227db3d7d86e3e11040fe55539f14b43674ab66',
                      },
                      signer: {
                        type: 'string',
                        description: 'Signer address',
                        example: '0x7227db3d7d86e3e11040fe55539f14b43674ab66',
                      },
                      taker: {
                        type: 'string',
                        description: 'Taker address (0x0 for any)',
                        example: '0x0000000000000000000000000000000000000000',
                      },
                      tokenId: {
                        type: 'string',
                        description: 'Token ID',
                        example: '101434403359553929764780234916919166959889590658679054429843672204390513588056',
                      },
                      makerAmount: {
                        type: 'string',
                        description: 'Amount maker is providing (in raw units)',
                        example: '1000000',
                      },
                      takerAmount: {
                        type: 'string',
                        description: 'Amount taker is providing (in raw units)',
                        example: '4347800',
                      },
                      expiration: {
                        type: 'string',
                        example: '0',
                      },
                      nonce: {
                        type: 'string',
                        example: '0',
                      },
                      feeRateBps: {
                        type: 'string',
                        example: '0',
                      },
                      side: {
                        type: 'number',
                        description: '0 = BUY, 1 = SELL',
                        example: 0,
                      },
                      signatureType: {
                        type: 'number',
                        example: 2,
                      },
                    },
                  },
                  signature: {
                    type: 'string',
                    description: 'EIP712 signature',
                    example: '0x...',
                  },
                  outcome: {
                    type: 'string',
                    enum: ['YES', 'NO'],
                    description: 'Market outcome',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Order placed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                    },
                    order: {
                      type: 'object',
                      properties: {
                        id: {
                          type: 'string',
                        },
                        marketId: {
                          type: 'string',
                        },
                        maker: {
                          type: 'string',
                        },
                        side: {
                          type: 'string',
                          enum: ['BUY', 'SELL'],
                        },
                        outcome: {
                          type: 'string',
                          enum: ['YES', 'NO'],
                        },
                        amount: {
                          type: 'number',
                        },
                        price: {
                          type: 'number',
                        },
                        status: {
                          type: 'string',
                        },
                      },
                    },
                    matches: {
                      type: 'number',
                      description: 'Number of matches found',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Invalid order or signature',
          },
          '500': {
            description: 'Internal server error',
          },
        },
      },
    },
    '/api/orders/{id}': {
      get: {
        tags: ['Orders'],
        summary: 'Get order details',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Order found',
          },
          '404': {
            description: 'Order not found',
          },
        },
      },
      delete: {
        tags: ['Orders'],
        summary: 'Cancel an order',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Order cancelled',
          },
          '404': {
            description: 'Order not found',
          },
        },
      },
    },
    '/api/orders/user/{address}': {
      get: {
        tags: ['Orders'],
        summary: 'Get all orders for a user',
        parameters: [
          {
            name: 'address',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              description: 'User wallet address',
            },
          },
        ],
        responses: {
          '200': {
            description: 'User orders retrieved',
          },
        },
      },
    },
    '/api/orders/market/{marketId}': {
      get: {
        tags: ['Orders'],
        summary: 'Get order book for a market',
        parameters: [
          {
            name: 'marketId',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
          },
          {
            name: 'outcome',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['YES', 'NO'],
            },
            description: 'Filter by outcome (optional)',
          },
        ],
        responses: {
          '200': {
            description: 'Order book',
          },
        },
      },
    },
    '/api/orders/market/{marketId}/prices': {
      get: {
        tags: ['Orders'],
        summary: 'Get market prices',
        parameters: [
          {
            name: 'marketId',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Market prices for both outcomes',
          },
        },
      },
    },
    '/api/orders/market/{marketId}/settle': {
      post: {
        tags: ['Settlement'],
        summary: 'Manually trigger order matching and settlement for a market',
        description: 'Attempts to match all pending orders (including cross-outcome complementary matching) and enqueues settlement jobs',
        parameters: [
          {
            name: 'marketId',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Settlement process completed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                    },
                    message: {
                      type: 'string',
                    },
                    ordersProcessed: {
                      type: 'number',
                    },
                    matchCount: {
                      type: 'number',
                    },
                    settlementCount: {
                      type: 'number',
                    },
                    queueSize: {
                      type: 'number',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/settlement/status': {
      get: {
        tags: ['Settlement'],
        summary: 'Get settlement queue status',
        description: 'Returns the current size of the settlement queue',
        responses: {
          '200': {
            description: 'Queue status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    queueSize: {
                      type: 'number',
                      description: 'Number of pending settlement jobs',
                    },
                    timestamp: {
                      type: 'string',
                      format: 'date-time',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/settlement/process': {
      post: {
        tags: ['Settlement'],
        summary: 'Manually process all settlement jobs',
        description: 'Processes all queued settlement jobs immediately (executes on-chain)',
        responses: {
          '200': {
            description: 'Settlement jobs processed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                    },
                    processed: {
                      type: 'number',
                      description: 'Number of jobs processed',
                    },
                    remaining: {
                      type: 'number',
                      description: 'Number of jobs still in queue',
                    },
                    timestamp: {
                      type: 'string',
                      format: 'date-time',
                    },
                  },
                },
              },
            },
          },
          '500': {
            description: 'Settlement processing failed',
          },
        },
      },
    },
    '/api/wallet/check-deployment/{address}': {
      get: {
        tags: ['Wallet'],
        summary: 'Check if wallet is deployed',
        parameters: [
          {
            name: 'address',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              description: 'User address',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Deployment status',
          },
        },
      },
    },
    '/api/wallet/deploy': {
      post: {
        tags: ['Wallet'],
        summary: 'Deploy a multisig wallet',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  userAddress: {
                    type: 'string',
                  },
                  signature: {
                    type: 'object',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Wallet deployed',
          },
        },
      },
    },
    '/api/wallet/nonce/{proxyAddress}': {
      get: {
        tags: ['Wallet'],
        summary: 'Get wallet nonce',
        parameters: [
          {
            name: 'proxyAddress',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Current nonce',
          },
        },
      },
    },
    '/api/wallet/approve-tokens': {
      post: {
        tags: ['Wallet'],
        summary: 'Execute token approvals for trading',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Approvals executed',
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Order: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
          },
          marketId: {
            type: 'string',
          },
          maker: {
            type: 'string',
          },
          side: {
            type: 'string',
            enum: ['BUY', 'SELL'],
          },
          outcome: {
            type: 'string',
            enum: ['YES', 'NO'],
          },
          amount: {
            type: 'number',
          },
          price: {
            type: 'number',
          },
          status: {
            type: 'string',
          },
          filledAmount: {
            type: 'number',
          },
          createdAt: {
            type: 'number',
          },
        },
      },
      Match: {
        type: 'object',
        properties: {
          maker: {
            $ref: '#/components/schemas/Order',
          },
          takers: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Order',
            },
          },
          fillAmount: {
            type: 'number',
          },
          executionPrice: {
            type: 'number',
          },
        },
      },
    },
  },
};
