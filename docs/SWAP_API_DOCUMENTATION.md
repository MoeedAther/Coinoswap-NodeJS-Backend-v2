# Swap Currencies API Documentation

## Table of Contents
1. [Update Coins API](#update-coins-api)
2. [Get Standard Coin API](#get-standard-coin-api)
3. [Update Standard Coin API](#update-standard-coin-api)
4. [Add Mapped Partners API](#add-mapped-partners-api)
5. [Update Notifications API](#update-notifications-api)
6. [Delete Standard Coin API](#delete-standard-coin-api)
7. [Search Coins API](#search-coins-api)

---

## Base URL
```
http://localhost:5001/api
```

---

## 1. Update Coins API

Fetch coins from swap partners (Changelly, ChangeNow, Changehero, Exolix, StealthEX, Godex, LetsExchange, SimpleSwap, EasyBit) and update the database with standard and non-standard coins.

**Endpoint:** `GET /api/swap/update-coins`

**Authentication:** Not Required

**Description:**
- Fetches crypto currencies from 9 different swap partner APIs
- Groups similar coins into standard coins (coins appearing in multiple partners)
- Stores individual partner versions as non-standard coins for backup/reference
- Updates existing standard coins with new partners if detected
- Standard coins have `isStandard: true` and contain a `mappedPartners` array
- Non-standard coins have `isStandard: false` and contain partner-specific data

**Standard Ticker Logic:**
- **Crypto Coins**: `ticker.toLowerCase() + network.toLowerCase()` (e.g., "btcbitcoin", "etheth")

**Success Response (201):**
```json
{
  "success": true,
  "message": "Coins processed successfully. Total Inserted: 25000, Total Updated: 100.",
  "updatedStandard": 100,
  "insertedStandard": 500,
  "insertedNormal": 24500,
  "totalInserted": 25000,
  "totalUpdated": 100
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
- This is a background job API that processes ~25,000+ coins
- Standard coins are automatically approved (`isApproved: true`)
- Non-standard coins are not approved by default (`isApproved: false`)
- Duplicate non-standard coins with same `standardTicker` and `swapPartner` are prevented
- The API maintains both standard and non-standard versions for data preservation
- Processes shortName by removing network suffixes from ticker names

---

## 2. Get Standard Coin API

Retrieve details of a specific standard coin by its ID.

**Endpoint:** `GET /api/swap/get-standard-coin`

**Authentication:** Not Required

**Query Parameters:**
- `standardCoinId`: Required - ID of the standard coin

**Example Request:**
```
GET /api/swap/get-standard-coin?standardCoinId=123
```

**Success Response (200):**
```json
{
  "success": true,
  "coin": {
    "id": 123,
    "standardTicker": "btcbitcoin",
    "name": "Bitcoin",
    "network": "Bitcoin",
    "shortName": "btc",
    "image": "https://...",
    "coinType": "popular",
    "requiresExtraId": false,
    "isApproved": true,
    "mappedPartners": [
      {
        "swapPartner": "changelly",
        "standardTicker": "btcbitcoin",
        "ticker": "BTC",
        "name": "Bitcoin",
        "network": "Bitcoin",
        "coinType": "other",
        "requiresExtraId": false,
        "payInNotification": null,
        "payOutNotification": null
      }
    ]
  }
}
```

**Error Responses:**

**400 - Missing standardCoinId:**
```json
{
  "success": false,
  "message": "standardCoinId is required"
}
```

**404 - Standard Coin Not Found:**
```json
{
  "success": false,
  "message": "Standard coin not found"
}
```

---

## 3. Update Standard Coin API

Update metadata fields of a standard coin (shortName, coinType, image).

**Endpoint:** `POST /api/swap/update-standard-coin`

**Authentication:** Not Required

**Request Body:**
```json
{
  "standardCoinId": 123,
  "shortName": "btc",
  "coinType": "popular",
  "image": "https://example.com/btc.png"
}
```

**Parameters:**
- `standardCoinId`: Required - ID of the standard coin to update
- `shortName`: Optional - Short name for the coin
- `coinType`: Optional - Must be one of: "popular", "popular&stable", "other"
- `image`: Optional - Image URL for the coin

**Success Response (200):**
```json
{
  "success": true,
  "message": "Standard coin updated successfully",
  "coin": {
    "id": 123,
    "standardTicker": "btcbitcoin",
    "name": "Bitcoin",
    "network": "Bitcoin",
    "shortName": "btc",
    "image": "https://example.com/btc.png",
    "coinType": "popular",
    "requiresExtraId": false,
    "isApproved": true,
    "mappedPartners": [...]
  }
}
```

**Error Responses:**

**400 - Missing standardCoinId:**
```json
{
  "success": false,
  "message": "standardCoinId is required"
}
```

**400 - Invalid coinType:**
```json
{
  "success": false,
  "message": "Invalid coinType. Must be one of: popular, popular&stable, other"
}
```

**400 - No fields to update:**
```json
{
  "success": false,
  "message": "No fields to update"
}
```

**404 - Standard Coin Not Found:**
```json
{
  "success": false,
  "message": "Standard coin not found"
}
```

---

## 4. Add Mapped Partners API

Add unstandard coins to a standard coin's mappedPartners array.

**Endpoint:** `POST /api/swap/add-mapped-partners`

**Authentication:** Not Required

**Request Body:**
```json
{
  "standardCoinId": 123,
  "unstandardCoinIds": [456, 789, 101]
}
```

**Parameters:**
- `standardCoinId`: Required - ID of the standard coin
- `unstandardCoinIds`: Required - Array of unstandard coin IDs to add as partners

**Validation:**
- All unstandard coins must exist with `isStandard: false`
- All unstandard coins must have the same `standardTicker` as the standard coin
- Duplicate partners (by `swapPartner` name) are automatically skipped

**Success Response (200):**
```json
{
  "success": true,
  "message": "Successfully added 2 partners to mapped partners",
  "addedCount": 2,
  "skippedCount": 1,
  "addedPartners": ["changelly", "changenow"],
  "skippedPartners": ["exolix"],
  "coin": {
    "id": 123,
    "standardTicker": "btcbitcoin",
    "name": "Bitcoin",
    "network": "Bitcoin",
    "mappedPartners": [...]
  }
}
```

**Success Response (All Duplicates) (200):**
```json
{
  "success": true,
  "message": "No new partners were added (all already exist in mappedPartners)",
  "addedCount": 0,
  "skippedCount": 3,
  "skippedPartners": ["changelly", "changenow", "exolix"],
  "coin": {
    "id": 123,
    "standardTicker": "btcbitcoin",
    "name": "Bitcoin",
    "network": "Bitcoin",
    "mappedPartners": [...]
  }
}
```

**Error Responses:**

**400 - Mismatched standardTicker:**
```json
{
  "success": false,
  "message": "All unstandard coins must have the same standardTicker as the standard coin",
  "mismatchedCoins": [
    {
      "id": 789,
      "standardTicker": "etheth",
      "swapPartner": "changelly",
      "ticker": "ETH"
    }
  ],
  "expectedStandardTicker": "btcbitcoin"
}
```

**404 - No Unstandard Coins Found:**
```json
{
  "success": false,
  "message": "No unstandard coins found with the provided IDs"
}
```

---

## 5. Update Notifications API

Update payIn and payOut notifications for specific partners in a standard coin's mappedPartners.

**Endpoint:** `POST /api/swap/update-notifications`

**Authentication:** Not Required

**Request Body:**
```json
{
  "standardCoinId": 123,
  "notifications": [
    {
      "swapPartner": "changelly",
      "payInNotification": "Please send exact amount to avoid delays",
      "payOutNotification": "Funds will be sent within 30 minutes"
    },
    {
      "swapPartner": "changenow",
      "payInNotification": "Extra ID required for this transaction"
    }
  ]
}
```

**Parameters:**
- `standardCoinId`: Required - ID of the standard coin
- `notifications`: Required - Array of notification objects
  - `swapPartner`: Required - Name of the swap partner (e.g., "changelly")
  - `payInNotification`: Optional - Notification for incoming payments
  - `payOutNotification`: Optional - Notification for outgoing payments
  - At least one notification field must be provided

**Success Response (200):**
```json
{
  "success": true,
  "message": "Notifications updated successfully",
  "updatedCount": 2,
  "coin": {
    "id": 123,
    "standardTicker": "btcbitcoin",
    "name": "Bitcoin",
    "network": "Bitcoin",
    "mappedPartners": [
      {
        "swapPartner": "changelly",
        "payInNotification": "Please send exact amount to avoid delays",
        "payOutNotification": "Funds will be sent within 30 minutes"
      }
    ]
  }
}
```

**Error Responses:**

**400 - Missing swapPartner:**
```json
{
  "success": false,
  "message": "Each notification must have a swapPartner field"
}
```

**400 - No notification fields:**
```json
{
  "success": false,
  "message": "Each notification must have at least payInNotification or payOutNotification field"
}
```

**404 - No Matching Partners:**
```json
{
  "success": false,
  "message": "No matching partners found in mappedPartners",
  "notFoundPartners": ["invalidpartner"]
}
```

---

## 6. Delete Standard Coin API

Delete a standard coin (destandardize).

**Endpoint:** `POST /api/swap/destandardize-coin`

**Authentication:** Not Required

**Request Body:**
```json
{
  "standardCoinId": 123
}
```

**Parameters:**
- `standardCoinId`: Required - ID of the standard coin to delete

**Success Response (200):**
```json
{
  "success": true,
  "message": "Successfully destandardized coin. The standard coin has been removed.",
  "deletedStandardCoinId": "123",
  "releasedPartnersCount": 3
}
```

**Error Responses:**

**400 - Missing standardCoinId:**
```json
{
  "success": false,
  "message": "standardCoinId is required"
}
```

**404 - Standard Coin Not Found:**
```json
{
  "success": false,
  "message": "Standard coin not found"
}
```

---

## 7. Search Coins API

Search for coins by ticker, name, or network with filters for standard/non-standard.

**Endpoint:** `GET /api/swap/search-coins`

**Authentication:** Not Required

**Query Parameters:**
- `searchTerm`: Optional - Search term for coin ticker, name, or network (starts-with matching). If not provided, returns all coins matching other filters
- `isStandard`: Required - Filter by standard/non-standard ("1" for standard, "0" for non-standard)
- `page`: Optional - Page number for pagination (default: 1)
- `limit`: Optional - Number of results per page (default: 10)

**Search Behavior:**
- Searches in `ticker`, `name`, and `network` columns
- Uses LIKE 'term%' for starting character matching
- Results are sorted with priority:
  1. coinType priority (popular → popular&stable → stable → other)
  2. Exact ticker match
  3. Exact name match
  4. Exact network match
  5. Ticker starts with search term
  6. Name starts with search term
  7. Network starts with search term
  8. Alphabetical order by ticker

**Example Requests:**
```
GET /api/swap/search-coins?searchTerm=btc&isStandard=1
GET /api/swap/search-coins?searchTerm=bitcoin&isStandard=0&page=1&limit=20
GET /api/swap/search-coins?isStandard=1 (returns all standard coins)
```

**Success Response (200):**
```json
{
  "success": true,
  "coins": [
    {
      "id": 1,
      "standardTicker": "btcbitcoin",
      "ticker": "btc",
      "name": "Bitcoin",
      "network": "Bitcoin",
      "shortName": "btc",
      "image": "https://...",
      "swapPartner": null,
      "mappedPartners": [...],
      "coinType": "popular",
      "requiresExtraId": false,
      "isApproved": true,
      "isStandard": true
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

**400 - Validation Error (Missing isStandard):**
```json
{
  "success": false,
  "message": "isStandard parameter is required for search"
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
- Searches ticker, name, and network columns using OR condition
- If no search term provided, returns all coins matching isStandard filter
- Starts-with matching (e.g., "btc" matches "BTC", "Bitcoin", but not "WBTC")
- Results prioritize coinType first, then exact matches, then alphabetical order
- Standard coins have `swapPartner: null` and populated `mappedPartners`
- Non-standard coins have specific `swapPartner` and raw `data` field

---

## Data Models

### Standard Coin Structure
```json
{
  "id": 1,
  "standardTicker": "btcbitcoin",
  "ticker": "btc",
  "name": "Bitcoin",
  "network": "Bitcoin",
  "shortName": "btc",
  "image": "https://...",
  "swapPartner": null,
  "mappedPartners": [
    {
      "swapPartner": "changelly",
      "standardTicker": "btcbitcoin",
      "ticker": "BTC",
      "name": "Bitcoin",
      "network": "Bitcoin",
      "coinType": "other",
      "requiresExtraId": false,
      "payInNotification": null,
      "payOutNotification": null
    }
  ],
  "coinType": "popular",
  "requiresExtraId": false,
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
  "shortName": "btc",
  "image": "https://...",
  "swapPartner": "changelly",
  "mappedPartners": [],
  "data": {
    "ticker": "BTC",
    "fullName": "Bitcoin",
    "blockchain": "Bitcoin",
    "image": "https://..."
  },
  "coinType": "other",
  "requiresExtraId": false,
  "isApproved": false,
  "isStandard": false
}
```

---

## Swap Partners

The system integrates with the following swap/exchange partners:

1. **Changelly** - Crypto exchange with extensive coin support
2. **ChangeNow** - Instant cryptocurrency exchange
3. **Changehero** - Non-custodial crypto exchange
4. **Exolix** - Anonymous cryptocurrency exchange
5. **StealthEX** - Private crypto exchange
6. **Godex** - Fast cryptocurrency exchange
7. **LetsExchange** - Simple crypto swap service
8. **SimpleSwap** - Easy crypto exchange platform
9. **EasyBit** - User-friendly crypto exchange

---

## Common HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## Best Practices

1. **Update Coins**: Run periodically (daily/weekly) to keep coin data fresh
2. **Standard Coins**: Use for main application display and user selection
3. **Non-Standard Coins**: Use as backup reference and for partner-specific mappings
4. **Search API**: Implement debouncing on frontend to reduce API calls
5. **Pagination**: Use appropriate page size based on UI requirements
6. **Notifications**: Set clear, concise messages for user guidance
7. **coinType Priority**: Leverage coinType sorting to show popular coins first

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
