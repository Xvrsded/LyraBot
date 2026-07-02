/**
 * spec.js — Auto-generated OpenAPI 3.0 specification for Module 17 API.
 * Served at GET /api/v1/docs
 */

function generateSpec() {
    return {
        openapi: '3.0.3',
        info: {
            title: 'WinterBot Enterprise API',
            description: 'Centralized internal API for the WinterBot Discord platform. Exposes Economy, Inventory, Marketplace, Quest, Achievement, Moderation, Audit, Config, and Player Profile services.',
            version: 'v1',
            contact: { name: 'WinterBot Team' }
        },
        servers: [
            { url: `http://localhost:${process.env.API_PORT || 3000}/api/v1`, description: 'Local Development' }
        ],
        security: [{ ApiKeyAuth: [] }, { BotToken: [] }, { BearerJWT: [] }],
        components: {
            securitySchemes: {
                ApiKeyAuth:  { type: 'apiKey', in: 'header', name: 'X-API-Key' },
                BotToken:    { type: 'http', scheme: 'bearer', bearerFormat: 'BOT' },
                BearerJWT:   { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
            },
            schemas: {
                SuccessResponse: {
                    type: 'object',
                    properties: {
                        success:       { type: 'boolean', example: true },
                        data:          { type: 'object' },
                        meta:          { type: 'object', properties: { version: { type: 'string' } } },
                        correlationId: { type: 'string' },
                        timestamp:     { type: 'string', format: 'date-time' }
                    }
                },
                ErrorResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        error: {
                            type: 'object',
                            properties: {
                                code:    { type: 'string', example: 'INSUFFICIENT_FUNDS' },
                                message: { type: 'string' },
                                details: { type: 'object' }
                            }
                        },
                        correlationId: { type: 'string' },
                        timestamp:     { type: 'string', format: 'date-time' }
                    }
                },
                Pagination: {
                    type: 'object',
                    properties: {
                        page:  { type: 'integer' },
                        limit: { type: 'integer' },
                        total: { type: 'integer' },
                        pages: { type: 'integer' }
                    }
                },
                Wallet: {
                    type: 'object',
                    properties: {
                        userId:          { type: 'string' },
                        guildId:         { type: 'string' },
                        coins:           { type: 'integer' },
                        premiumCoins:    { type: 'integer' },
                        experience:      { type: 'integer' },
                        lifetimeEarnings:{ type: 'integer' },
                        lifetimeSpending:{ type: 'integer' }
                    }
                }
            }
        },
        paths: {
            // ── Economy ──────────────────────────────────────────────────────
            '/economy/{guildId}/users/{userId}/wallet': {
                get: {
                    tags: ['Economy'],
                    summary: 'Get user wallet',
                    parameters: [
                        { name: 'guildId', in: 'path', required: true, schema: { type: 'string' } },
                        { name: 'userId',  in: 'path', required: true, schema: { type: 'string' } }
                    ],
                    responses: {
                        200: { description: 'Wallet data', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
                        401: { description: 'Unauthorized' },
                        403: { description: 'Forbidden' }
                    }
                }
            },
            '/economy/{guildId}/users/{userId}/deposit': {
                post: {
                    tags: ['Economy'],
                    summary: 'Deposit coins to user wallet',
                    parameters: [
                        { name: 'guildId', in: 'path', required: true, schema: { type: 'string' } },
                        { name: 'userId',  in: 'path', required: true, schema: { type: 'string' } }
                    ],
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { type: 'object', properties: {
                            amount:   { type: 'integer', minimum: 1 },
                            currency: { type: 'string', enum: ['coins', 'premiumCoins'] }
                        }, required: ['amount'] } } }
                    },
                    responses: { 200: { description: 'Updated wallet' }, 400: { description: 'Validation error' } }
                }
            },
            '/economy/{guildId}/users/{userId}/ledger': {
                get: {
                    tags: ['Economy'],
                    summary: 'Get user transaction ledger (paginated)',
                    parameters: [
                        { name: 'guildId', in: 'path',  required: true,  schema: { type: 'string' } },
                        { name: 'userId',  in: 'path',  required: true,  schema: { type: 'string' } },
                        { name: 'page',    in: 'query', required: false, schema: { type: 'integer', default: 1 } },
                        { name: 'limit',   in: 'query', required: false, schema: { type: 'integer', default: 10 } }
                    ],
                    responses: { 200: { description: 'Paginated ledger entries' } }
                }
            },
            // ── Inventory ────────────────────────────────────────────────────
            '/inventory/{guildId}/users/{userId}/inventory': {
                get: {
                    tags: ['Inventory'],
                    summary: 'Get user inventory (paginated)',
                    parameters: [
                        { name: 'guildId', in: 'path',  required: true, schema: { type: 'string' } },
                        { name: 'userId',  in: 'path',  required: true, schema: { type: 'string' } },
                        { name: 'sort',    in: 'query', required: false, schema: { type: 'string', enum: ['rarity','name','quantity','category'] } },
                        { name: 'page',    in: 'query', required: false, schema: { type: 'integer', default: 1 } }
                    ],
                    responses: { 200: { description: 'Paginated inventory items' } }
                }
            },
            // ── Marketplace ───────────────────────────────────────────────────
            '/marketplace/{guildId}/listings': {
                get:  { tags: ['Marketplace'], summary: 'Browse active listings', parameters: [{ name: 'guildId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Active listings' } } },
                post: { tags: ['Marketplace'], summary: 'Create a listing (sell)', parameters: [{ name: 'guildId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 201: { description: 'Created listing' } } }
            },
            '/marketplace/{guildId}/listings/{listingId}/buy': {
                post: { tags: ['Marketplace'], summary: 'Buy a listing', parameters: [{ name: 'guildId', in: 'path', required: true, schema: { type: 'string' } }, { name: 'listingId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Trade completed' } } }
            },
            // ── Profile ───────────────────────────────────────────────────────
            '/profile/{guildId}/users/{userId}/profile': {
                get: { tags: ['Profile'], summary: 'Get aggregated player profile', parameters: [{ name: 'guildId', in: 'path', required: true, schema: { type: 'string' } }, { name: 'userId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Player profile' } } }
            },
            // ── Metrics ───────────────────────────────────────────────────────
            '/metrics': {
                get: { tags: ['System'], summary: 'Get API metrics (MASTER only)', responses: { 200: { description: 'Metrics snapshot' } } }
            },
            '/docs': {
                get: { tags: ['System'], summary: 'Get OpenAPI specification', security: [], responses: { 200: { description: 'OpenAPI 3.0 JSON' } } }
            }
        }
    };
}

module.exports = { generateSpec };
