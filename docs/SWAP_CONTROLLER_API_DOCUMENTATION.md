# Swap Controller API Documentation

Complete documentation for all Swap Controller APIs.

---

## Table of Contents
1. [Coin Management](#coin-management)
2. [Standard Coin Operations](#standard-coin-operations)
3. [Search & Query](#search--query)

---

## Coin Management

### 1. Update Coins from Partners
**Endpoint:** `GET /api/swap/update-coins`
**Description:** Fetches and updates cryptocurrency data from all swap partners (Changelly, ChangeNow, etc.)

**Request:**
```http
GET /api/swap/update-coins
```

**Response:**
```json
{
  "success": true,
  "message": "Coins updated successfully",
  "stats": {
    "totalCoins": 1500,
    "newCoins": 50,
    "updatedCoins": 1450
  }
}
```

---

### 2. Search Coins
**Endpoint:** `GET /api/swap/search-coins`
**Description:** Search for coins with pagination and filtering by standard/unstandard status

**Query Parameters:**
- `searchTerm` (optional) - Search by ticker, name, or network
- `isStandard` (required) - `1` for standard coins, `0` for unstandard coins
- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 20) - Results per page

**Request:**
```http
GET /api/swap/search-coins?searchTerm=btc&isStandard=1&page=1&limit=20
```

**Response:**
```json
{
  "success": true,
  "coins": [
    {
      "id": 1,
      "ticker": "BTC",
      "name": "Bitcoin",
      "network": "BTC",
      "standardTicker": "BTC",
      "isStandard": true,
      "isApproved": true,
      "coinType": "popular",
      "requiresExtraId": false,
      "shortName": "btc",
      "image": "https://...",
      "mappedPartners": [
        {
          "swapPartner": "changelly",
          "ticker": "btc",
          "name": "Bitcoin",
          "network": "BTC",
          "coinType": "popular",
          "requiresExtraId": false,
          "payInNotifications": ["Send exact amount"],
          "payOutNotifications": ["Funds sent in 30 min"]
        }
      ]
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalCoins": 100,
    "limit": 20,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

**Sorting Priority:**
1. Coin type (popular > popular&stable > stable > other)
2. Exact matches (ticker, name, network)
3. Starts with search term
4. Alphabetical

---

## Standard Coin Operations

### 3. Make Coin Standard
**Endpoint:** `POST /api/swap/make-standard`
**Description:** Convert unstandard coins into a single standard coin

**Request Body:**
```json
{
  "coinIds": [123, 456, 789],
  "standardTicker": "BTC",
  "requiresExtraId": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Standard coin created successfully with 3 mapped partners",
  "coin": {
    "id": 1,
    "standardTicker": "BTC",
    "name": "Bitcoin",
    "network": "BTC",
    "isStandard": true,
    "isApproved": true,
    "requiresExtraId": false,
    "mappedPartners": [...]
  }
}
```

---

### 4. Destandardize Coin
**Endpoint:** `POST /api/swap/destandardize-coin`
**Description:** Revert a standard coin back to unstandard coins

**Request Body:**
```json
{
  "standardCoinId": 1
}
```

**Response:**
```json
{
  "success": true,
  "message": "Standard coin destandardized successfully. 5 coins restored.",
  "restoredCoins": [
    {
      "id": 123,
      "ticker": "btc",
      "swapPartner": "changelly",
      "isStandard": false
    }
  ]
}
```

---

### 5. Update Coin
**Endpoint:** `POST /api/swap/update-coin`
**Description:** Update metadata and approval status of any coin (works for both standard and unstandard coins)

**Request Body:**
```json
{
  "coinId": 1,
  "shortName": "btc",
  "coinType": "popular",
  "image": "https://example.com/btc.png",
  "isApproved": true
}
```

**Parameters:**
- `coinId` (required) - ID of the coin to update
- `shortName` (optional) - Short name for the coin
- `coinType` (optional) - Type of coin
- `image` (optional) - Image URL for the coin
- `isApproved` (optional) - Approval status (true/false)

**Valid Coin Types:**
- `popular`
- `popular&stable`
- `stable`
- `other`

**Response:**
```json
{
  "success": true,
  "message": "Coin updated successfully",
  "coin": {
    "id": 1,
    "standardTicker": "BTC",
    "ticker": "btc",
    "name": "Bitcoin",
    "network": "BTC",
    "shortName": "btc",
    "image": "https://example.com/btc.png",
    "coinType": "popular",
    "requiresExtraId": false,
    "isApproved": true,
    "isStandard": true,
    "swapPartner": null,
    "mappedPartners": [...]
  }
}
```

**Notes:**
- Works for both standard and unstandard coins
- `mappedPartners` is only included in response for standard coins
- At least one field (`shortName`, `coinType`, `image`, or `isApproved`) must be provided

---

### 6. Merge Coins to Mapped Partners
**Endpoint:** `POST /api/swap/merge-coins-to-mapped`
**Description:** Merge coins (both standard and unstandard) into a target standard coin's mappedPartners array

**Request Body:**
```json
{
  "standardCoinId": 1,
  "coinIds": [123, 456, 789, 10, 11]
}
```

**Behavior:**
- **Standard Coins in Array:**
  - Fetches their complete `mappedPartners` array
  - Merges all partners into target coin (skips duplicates based on `swapPartner` name)
  - Sets source standard coin's `isApproved = false`

- **Unstandard Coins in Array:**
  - Creates mapped partner object from coin data
  - Adds to target coin's `mappedPartners` (skips if `swapPartner` already exists)

**Response:**
```json
{
  "success": true,
  "message": "Successfully merged 8 partners to mapped partners (5 from standard coins, 3 from unstandard coins)",
  "addedFromStandardCount": 5,
  "addedFromUnstandardCount": 3,
  "totalAdded": 8,
  "skippedCount": 2,
  "addedPartners": [
    "changelly",
    "changenow",
    "simpleswap",
    "godex",
    "stealthex",
    "exolix",
    "letsexchange",
    "easybit"
  ],
  "skippedPartners": ["changehero", "changeangel"],
  "disapprovedStandardCoins": [
    {
      "id": 123,
      "standardTicker": "BTC",
      "name": "Bitcoin"
    }
  ],
  "coin": {
    "id": 1,
    "standardTicker": "BTC",
    "name": "Bitcoin",
    "network": "BTC",
    "mappedPartners": [
      {
        "swapPartner": "changelly",
        "standardTicker": "BTC",
        "ticker": "btc",
        "name": "Bitcoin",
        "network": "BTC",
        "coinType": "popular",
        "requiresExtraId": false,
        "payInNotifications": ["Send exact amount"],
        "payOutNotifications": ["Funds arrive in 30 min"]
      }
    ]
  }
}
```

**Use Cases:**
1. **Merging duplicate standard coins:** If you have 2 standard BTC coins, merge one into the other
2. **Adding new partners to existing standard coin:** Add unstandard coins as new swap partners
3. **Bulk operations:** Combine both standard and unstandard coins in one request

---

### 7. Update Notifications
**Endpoint:** `POST /api/swap/update-notifications`
**Description:** Update pay-in and pay-out notifications for a specific partner in mappedPartners

**Request Body:**
```json
{
  "standardCoinId": 1,
  "swapPartner": "changelly",
  "payInNotifications": [
    "Send exact amount",
    "Include memo if required",
    "Double check address"
  ],
  "payOutNotifications": [
    "Funds sent within 30 minutes",
    "Check your wallet",
    "Contact support if delayed"
  ]
}
```

**Notes:**
- Both `payInNotifications` and `payOutNotifications` are optional
- At least one must be provided
- Arrays can be empty `[]` to clear notifications
- Only updates the specified partner in mappedPartners

**Response:**
```json
{
  "success": true,
  "message": "Notifications updated successfully for partner 'changelly'",
  "updatedPartner": {
    "swapPartner": "changelly",
    "payInNotifications": [
      "Send exact amount",
      "Include memo if required",
      "Double check address"
    ],
    "payOutNotifications": [
      "Funds sent within 30 minutes",
      "Check your wallet",
      "Contact support if delayed"
    ]
  },
  "coin": {
    "id": 1,
    "standardTicker": "BTC",
    "name": "Bitcoin",
    "network": "BTC",
    "mappedPartners": [...]
  }
}
```

---

## Error Handling

All APIs return errors in the following format:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "error": "Technical error details"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (validation errors)
- `404` - Not Found (coin/partner not found)
- `500` - Internal Server Error

---

## Data Models

### Coin Object
```typescript
{
  id: number;
  ticker: string;
  name: string;
  network: string;
  standardTicker: string | null;
  isStandard: boolean;
  isApproved: boolean;
  coinType: "popular" | "popular&stable" | "stable" | "other";
  requiresExtraId: boolean;
  shortName?: string;
  image?: string;
  swapPartner?: string | null;
  mappedPartners?: MappedPartner[];
}
```

### Mapped Partner Object
```typescript
{
  swapPartner: string;           // e.g., "changelly"
  standardTicker: string;         // e.g., "BTC"
  ticker: string;                 // e.g., "btc"
  name: string;                   // e.g., "Bitcoin"
  network: string;                // e.g., "BTC"
  coinType: string;               // e.g., "popular"
  requiresExtraId: boolean;
  payInNotifications: string[];   // Array of notification strings
  payOutNotifications: string[];  // Array of notification strings
}
```

---

## Testing

Access the API tester at: `http://localhost:5001/api-tester`

The tester provides:
- Pre-configured forms for all endpoints
- JSON parsing for array inputs
- Real-time response display
- Status code visualization
- Error handling

---

## Workflow Examples

### Example 1: Creating a Standard Coin
```bash
# 1. Search for unstandard Bitcoin coins
GET /api/swap/search-coins?searchTerm=btc&isStandard=0

# 2. Make them standard
POST /api/swap/make-standard
{
  "coinIds": [123, 456, 789],
  "standardTicker": "BTC",
  "requiresExtraId": false
}

# 3. Update metadata and approval status
POST /api/swap/update-coin
{
  "coinId": 1,
  "shortName": "btc",
  "coinType": "popular",
  "image": "https://example.com/btc.png",
  "isApproved": true
}

# 4. Update notifications for a partner
POST /api/swap/update-notifications
{
  "standardCoinId": 1,
  "swapPartner": "changelly",
  "payInNotifications": ["Send exact amount"],
  "payOutNotifications": ["Funds sent in 30 min"]
}
```

### Example 2: Merging Duplicate Standard Coins
```bash
# 1. Find duplicate BTC standard coins
GET /api/swap/search-coins?searchTerm=btc&isStandard=1

# 2. Merge coin ID 5 into coin ID 1
POST /api/swap/merge-coins-to-mapped
{
  "standardCoinId": 1,
  "coinIds": [5]
}
# Result: Coin ID 5's mappedPartners are merged into coin ID 1
# Coin ID 5 is set to isApproved=false
```

### Example 3: Adding New Partners to Existing Standard Coin
```bash
# 1. Find unstandard coins for a new partner
GET /api/swap/search-coins?searchTerm=btc&isStandard=0

# 2. Add them to existing standard coin
POST /api/swap/merge-coins-to-mapped
{
  "standardCoinId": 1,
  "coinIds": [234, 567, 890]
}
# Result: Unstandard coins are added as new partners
```

---

## Notes

1. **Standard vs Unstandard Coins:**
   - Standard coins have `isStandard = true` and contain a `mappedPartners` array
   - Unstandard coins have `isStandard = false` and represent single swap partner variations

2. **Approval Status:**
   - `isApproved = true`: Coin is active and visible to users
   - `isApproved = false`: Coin is hidden/inactive (used when merging duplicates)

3. **Mapped Partners:**
   - Stored as JSON array in database
   - Each partner represents a different swap exchange's version of the coin
   - Notifications are stored per-partner for customization

4. **Coin Types:**
   - Used for sorting and filtering
   - Priority: `popular` > `popular&stable` > `stable` > `other`

5. **Extra ID Requirement:**
   - Some coins (like XRP, XLM) require a memo/destination tag
   - Set `requiresExtraId: true` for these coins
