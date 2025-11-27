# Buy Currencies API Documentation

## Table of Contents
1. [Update Coins API](#update-coins-api)
2. [Create or Delete Standard Coin API](#create-or-delete-standard-coin-api)
3. [Add or Delete Partner from Standard Coin API](#add-or-delete-partner-from-standard-coin-api)
4. [Search Coins API](#search-coins-api)

---

## Base URL
```
http://localhost:5001/api
```

---

## 1. Update Coins API

Fetch coins from buy partners (Finchpay and Guardarian) and update the database with standard and non-standard coins.

**Endpoint:** `GET /api/buy/update-coins`

**Authentication:** Not Required

**Description:**
- Fetches fiat and crypto currencies from Finchpay and Guardarian APIs
- Groups similar coins into standard coins (coins appearing in multiple partners)
- Stores individual partner versions as non-standard coins for backup/reference
- Updates existing standard coins with new partners if detected
- Standard coins have `isStandard: true` and contain a `mappedPartners` array
- Non-standard coins have `isStandard: false` and contain partner-specific data

**Standard Ticker Logic:**
- **Fiat Coins**: `ticker.toLowerCase()` (e.g., "usd", "eur")
- **Crypto Coins**: `ticker.toLowerCase() + network.toLowerCase()` (e.g., "btcbitcoin", "etheth")

**Success Response (201):**
```json
{
  "success": true,
  "message": "Coins processed successfully. Total Inserted: 15000, Total Updated: 50.",
  "updatedStandard": 50,
  "insertedStandard": 200,
  "insertedNormal": 14800,
  "totalInserted": 15000,
  "totalUpdated": 50
}
```

**Response Fields:**
- `updatedStandard`: Number of existing standard coins updated with new partners
- `insertedStandard`: Number of new standard coins created
- `insertedNormal`: Number of non-standard coins inserted
- `totalInserted`: Total new coins inserted (standard + non-standard)
- `totalUpdated`: Total standard coins updated

**Error Responses:**

**500 - Server Error:**
```json
{
  "success": false,
  "error": "Unexpected server error",
  "message": "Something went wrong while processing coin data"
}
```

**Notes:**
- This is a background job API that processes ~15,000 coins
- Standard coins are automatically approved (`isApproved: true`)
- Non-standard coins are not approved by default (`isApproved: false`)
- Duplicate non-standard coins with same `standardTicker` and `buyPartner` are prevented
- The API maintains both standard and non-standard versions for data preservation

---

## 2. Create or Delete Standard Coin API

Create a standard coin from an unstandard coin or delete an existing standard coin.

**Endpoint:** `POST /api/buy/create-standard-coin`

**Authentication:** Required (Session-based)

### Create Standard Coin

**Request Body:**
```json
{
  "action": "create",
  "unstandardCoinId": 123
}
```

**Parameters:**
- `action`: Required - Must be "create" or "delete"
- `unstandardCoinId`: Required for create action - ID of the unstandard coin to promote

**Validation:**
- Checks if unstandard coin exists with `isStandard: false`
- Verifies no standard coin with same `standardTicker` already exists
- If standard coin exists, returns error with existing coin details

**Success Response (201):**
```json
{
  "success": true,
  "message": "Standard coin created successfully",
  "standardCoin": {
    "id": 456,
    "standardTicker": "btcbitcoin",
    "ticker": "BTC",
    "name": "Bitcoin",
    "network": "Bitcoin",
    "image": "https://finchpay.io/static/assets/btc.svg",
    "isFiat": false,
    "isApproved": true,
    "isStandard": true,
    "mappedPartners": [
      {
        "buyPartner": "finchpay",
        "ticker": "BTC",
        "name": "Bitcoin",
        "network": "Bitcoin",
        "isFiat": false
      }
    ]
  }
}
```

### Delete Standard Coin

**Request Body:**
```json
{
  "action": "delete",
  "standardCoinId": 456
}
```

**Parameters:**
- `action`: Required - Must be "create" or "delete"
- `standardCoinId`: Required for delete action - ID of the standard coin to delete

**Validation:**
- Checks if standard coin exists with `isStandard: true`
- Permanently deletes the standard coin from database

**Success Response (200):**
```json
{
  "success": true,
  "message": "Standard coin deleted successfully",
  "deletedCoin": {
    "id": 456,
    "standardTicker": "btcbitcoin",
    "ticker": "BTC",
    "name": "Bitcoin",
    "network": "Bitcoin"
  }
}
```

**Error Responses:**

**400 - Validation Error:**
```json
{
  "success": false,
  "message": "action is required (create or delete)"
}
```

**400 - Invalid Action:**
```json
{
  "success": false,
  "message": "Invalid action. Must be 'create' or 'delete'"
}
```

**400 - Standard Coin Already Exists:**
```json
{
  "success": false,
  "message": "A standard coin with standardTicker 'btcbitcoin' already exists",
  "existingStandardCoin": {
    "id": 789,
    "ticker": "BTC",
    "name": "Bitcoin",
    "network": "Bitcoin",
    "standardTicker": "btcbitcoin"
  }
}
```

**404 - Unstandard Coin Not Found:**
```json
{
  "success": false,
  "message": "Unstandard coin not found"
}
```

**404 - Standard Coin Not Found:**
```json
{
  "success": false,
  "message": "Standard coin not found"
}
```

**401 - Not Authenticated:**
```json
{
  "success": false,
  "message": "Not authenticated"
}
```

---

## 3. Add or Delete Partner from Standard Coin API

Add a partner to a standard coin's mapped partners or remove a partner from it.

**Endpoint:** `POST /api/buy/add-delete-coins`

**Authentication:** Not explicitly required (but recommended for admin operations)

### Add Partner to Standard Coin

**Request Body:**
```json
{
  "action": "add",
  "standardCoinId": 456,
  "unstandardCoinId": 789
}
```

**Parameters:**
- `action`: Required - Must be "add" or "delete"
- `standardCoinId`: Required - ID of the standard coin
- `unstandardCoinId`: Required for add action - ID of the unstandard coin to add as partner

**Validation:**
- Checks if standard coin exists
- Checks if unstandard coin exists with `isStandard: false`
- Verifies partner doesn't already exist in `mappedPartners`

**Success Response (200):**
```json
{
  "success": true,
  "message": "Successfully added guardarian to standard coin",
  "mappedPartners": [
    {
      "buyPartner": "finchpay",
      "ticker": "BTC",
      "name": "Bitcoin",
      "network": "Bitcoin",
      "isFiat": false
    },
    {
      "buyPartner": "guardarian",
      "ticker": "BTC",
      "name": "Bitcoin",
      "network": "Bitcoin",
      "isFiat": false
    }
  ]
}
```

### Delete Partner from Standard Coin

**Request Body:**
```json
{
  "action": "delete",
  "standardCoinId": 456,
  "partnerName": "guardarian"
}
```

**Parameters:**
- `action`: Required - Must be "add" or "delete"
- `standardCoinId`: Required - ID of the standard coin
- `partnerName`: Required for delete action - Name of the partner to remove (e.g., "finchpay", "guardarian")

**Validation:**
- Checks if standard coin exists
- Verifies partner exists in `mappedPartners`

**Success Response (200):**
```json
{
  "success": true,
  "message": "Successfully removed guardarian from standard coin",
  "mappedPartners": [
    {
      "buyPartner": "finchpay",
      "ticker": "BTC",
      "name": "Bitcoin",
      "network": "Bitcoin",
      "isFiat": false
    }
  ]
}
```

**Error Responses:**

**400 - Validation Error:**
```json
{
  "success": false,
  "message": "Missing required fields: action and standardCoinId are required"
}
```

**400 - Invalid Action:**
```json
{
  "success": false,
  "message": "Invalid action. Must be 'add' or 'delete'"
}
```

**400 - Partner Already Exists:**
```json
{
  "success": false,
  "message": "Partner 'guardarian' already exists in mappedPartners"
}
```

**404 - Standard Coin Not Found:**
```json
{
  "success": false,
  "message": "Standard coin not found"
}
```

**404 - Unstandard Coin Not Found:**
```json
{
  "success": false,
  "message": "Unstandard coin not found"
}
```

**404 - Partner Not Found:**
```json
{
  "success": false,
  "message": "Partner 'guardarian' not found in mappedPartners"
}
```

---

## 4. Search Coins API

Search for coins by ticker with optional filters for fiat/crypto and standard/non-standard.

**Endpoint:** `GET /api/buy/search-coins`

**Authentication:** Not Required

**Query Parameters:**
- `ticker`: Required - Search term for coin ticker (partial match supported)
- `isFiat`: Optional - Filter by fiat/crypto ("true" or "false")
- `isStandard`: Optional - Filter by standard/non-standard ("true" or "false")
- `page`: Optional - Page number for pagination (default: 1)
- `limit`: Optional - Number of results per page (default: 10)

**Example Requests:**
```
GET /api/buy/search-coins?ticker=btc
GET /api/buy/search-coins?ticker=usd&isFiat=true
GET /api/buy/search-coins?ticker=eth&isStandard=true&page=2&limit=20
```

**Success Response (200):**
```json
{
  "success": true,
  "coins": [
    {
      "id": 1,
      "standardTicker": "btcbitcoin",
      "ticker": "BTC",
      "name": "Bitcoin",
      "network": "Bitcoin",
      "image": "https://finchpay.io/static/assets/btc.svg",
      "buyPartner": null,
      "mappedPartners": "[{\"buyPartner\":\"finchpay\",\"ticker\":\"BTC\"}]",
      "isFiat": false,
      "isApproved": true,
      "isStandard": true
    },
    {
      "id": 2,
      "standardTicker": "btcbitcoin",
      "ticker": "BTC",
      "name": "Bitcoin",
      "network": "Bitcoin",
      "image": "https://finchpay.io/static/assets/btc.svg",
      "buyPartner": "finchpay",
      "mappedPartners": "[]",
      "data": "{...}",
      "isFiat": false,
      "isApproved": false,
      "isStandard": false
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalCount": 48,
    "limit": 10,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

**Response Fields:**
- `coins`: Array of coin objects matching search criteria
- `pagination.currentPage`: Current page number
- `pagination.totalPages`: Total number of pages
- `pagination.totalCount`: Total number of matching coins
- `pagination.limit`: Results per page
- `pagination.hasNextPage`: Boolean indicating if next page exists
- `pagination.hasPreviousPage`: Boolean indicating if previous page exists

**Error Responses:**

**400 - Validation Error:**
```json
{
  "success": false,
  "message": "ticker parameter is required for search"
}
```

**500 - Server Error:**
```json
{
  "success": false,
  "error": "Unexpected server error",
  "message": "Something went wrong while searching coins"
}
```

**Notes:**
- Search is case-insensitive
- Ticker search uses partial matching (LIKE '%ticker%')
- Results are ordered by `id` in ascending order
- Standard coins have `buyPartner: null` and populated `mappedPartners`
- Non-standard coins have specific `buyPartner` and raw `data` field

---

## Data Models

### Standard Coin Structure
```json
{
  "id": 1,
  "standardTicker": "btcbitcoin",
  "ticker": "BTC",
  "name": "Bitcoin",
  "network": "Bitcoin",
  "image": "https://...",
  "buyPartner": null,
  "mappedPartners": [
    {
      "buyPartner": "finchpay",
      "ticker": "BTC",
      "name": "Bitcoin",
      "network": "Bitcoin",
      "isFiat": false
    },
    {
      "buyPartner": "guardarian",
      "ticker": "BTC",
      "name": "Bitcoin",
      "network": "Bitcoin",
      "isFiat": false
    }
  ],
  "isFiat": false,
  "isApproved": true,
  "isStandard": true
}
```

### Non-Standard Coin Structure
```json
{
  "id": 2,
  "standardTicker": "btcbitcoin",
  "ticker": "BTC",
  "name": "Bitcoin",
  "network": "Bitcoin",
  "image": "https://...",
  "buyPartner": "finchpay",
  "mappedPartners": [],
  "data": {
    "ticker": "BTC",
    "name": "Bitcoin",
    "is_fiat": false,
    "network": "Bitcoin"
  },
  "isFiat": false,
  "isApproved": false,
  "isStandard": false
}
```

---

## Buy Partners

The system integrates with the following buy/sell partners:

1. **Finchpay** - Fiat and crypto currencies
2. **Guardarian** - Fiat and crypto currencies with network support

---

## Common HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (authentication failed) |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## Best Practices

1. **Update Coins**: Run periodically (daily/weekly) to keep coin data fresh
2. **Standard Coins**: Use for main application display and user selection
3. **Non-Standard Coins**: Use as backup reference and for partner-specific mappings
4. **Search API**: Implement debouncing on frontend to reduce API calls
5. **Pagination**: Use appropriate page size based on UI requirements

---

## Error Handling

All endpoints follow a consistent error response format:

```json
{
  "success": false,
  "error": "Detailed technical error message",
  "message": "User-friendly error message"
}
```

---

**Last Updated:** January 27, 2025
