# Rate Controller API Documentation

Complete documentation for the universal exchange rate API that fetches real-time cryptocurrency exchange rates from multiple swap partners.

---

## Table of Contents
1. [Overview](#overview)
2. [Get Exchange Rate](#get-exchange-rate)
3. [Response Format](#response-format)
4. [Error Handling](#error-handling)
5. [Supported Exchanges](#supported-exchanges)
6. [Exchange Metadata](#exchange-metadata)
7. [Testing](#testing)

---

## Overview

The Rate Controller provides a unified API endpoint to fetch exchange rates from 9 different cryptocurrency swap partners. The API handles:

- **Rate fetching** from multiple exchanges
- **Exchange-specific** ticker and network mapping
- **Min/Max limits** for each trading pair
- **Fixed and Floating** rate types
- **Exchange status** checking (enabled/disabled)
- **Giveaway flags** for promotional rates
- **Error standardization** across all exchanges

---

## Get Exchange Rate

### Endpoint
`POST /api/rate`

### Description
Fetches real-time exchange rate for a cryptocurrency pair from a specified exchange partner.

### Request Body

```json
{
  "sell": "BTC",
  "get": "ETH",
  "amount": 1.5,
  "exchangetype": "Fixed",
  "exchange": "changelly"
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sell` | string | Yes | Ticker of the coin to send/sell (e.g., "BTC") |
| `get` | string | Yes | Ticker of the coin to receive/buy (e.g., "ETH") |
| `amount` | number | Yes | Amount of the sell coin |
| `exchangetype` | string | Yes | Rate type: "Fixed" or "Floating" |
| `exchange` | string | Yes | Exchange name (see supported exchanges) |

### Exchange Type Explanation

**Fixed Rate:**
- Price is locked at the time of quote
- You get exactly the quoted amount
- May have `rate_id` for transaction creation
- Typically slightly higher fees

**Floating Rate:**
- Price may vary during transaction
- Final amount may differ slightly
- No `rate_id` needed
- Typically lower fees

---

### Success Response

**Status Code:** `200 OK`

```json
{
  "success": true,
  "data": {
    "rateObject": {
      "name": "changelly",
      "rate": 15.234567,
      "rate_id": "abc123xyz789",
      "min": 0.001,
      "higher_min": 0.00102,
      "max": 100.0,
      "exchangetype": "Fixed",
      "eta": "5-30 Min",
      "kyc": "On Occasion",
      "rating": "3.9/5",
      "hasGiveAway": true
    }
  },
  "message": "success"
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Exchange name |
| `rate` | number | Amount of 'get' coin you'll receive |
| `rate_id` | string/null | Rate identifier for Fixed exchanges (used in transaction creation) |
| `min` | number | Minimum amount allowed for this pair |
| `higher_min` | number | Recommended minimum (min + 2%) |
| `max` | number | Maximum amount allowed for this pair |
| `exchangetype` | string | "Fixed" or "Floating" |
| `eta` | string | Estimated time of arrival |
| `kyc` | string | KYC requirement level |
| `rating` | string | Exchange rating |
| `hasGiveAway` | boolean | Whether exchange has active giveaway |

---

### Error Responses

#### 1. Invalid Input
**Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "error": {
    "code": "invalid_input",
    "message": "sell parameter is required and must be a string (coin ticker)"
  }
}
```

#### 2. Exchange Disabled
**Status Code:** `403 Forbidden`

```json
{
  "success": false,
  "data": {
    "rateObject": {
      "name": "changelly",
      "rate": 0,
      "rate_id": null,
      "min": 0,
      "higher_min": 0,
      "max": 0,
      "exchangetype": "Fixed",
      "eta": "5-30 Min",
      "kyc": "On Occasion",
      "rating": "3.9/5"
    },
    "hasGiveAway": false
  },
  "error": {
    "code": "exchange_disabled",
    "message": "This exchange is currently disabled"
  }
}
```

#### 3. Coin Not Found
**Status Code:** `404 Not Found`

```json
{
  "success": false,
  "data": {
    "rateObject": {
      "name": "changenow",
      "rate": 0,
      "rate_id": null,
      "min": 0,
      "higher_min": 0,
      "max": 0,
      "exchangetype": "Floating",
      "eta": "10-60 Min",
      "kyc": "Rarely Required",
      "rating": "4.5/5"
    },
    "hasGiveAway": false
  },
  "error": {
    "code": "coin_not_found",
    "message": "Cryptocurrency not found in database"
  }
}
```

#### 4. Amount Below Range
**Status Code:** `200 OK` (Note: Returns 200 with error info)

```json
{
  "success": false,
  "data": {
    "rateObject": {
      "name": "stealthex",
      "rate": 0,
      "rate_id": null,
      "min": 0.01,
      "higher_min": 0.0102,
      "max": 50.0,
      "exchangetype": "Fixed",
      "eta": "7-38 Min",
      "kyc": "Rarely Required",
      "rating": "4.4/5"
    },
    "hasGiveAway": false
  },
  "error": {
    "code": "deposit_below_range",
    "message": "Amount is below minimum exchange limit"
  }
}
```

#### 5. Amount Above Range
**Status Code:** `200 OK`

```json
{
  "success": false,
  "data": {
    "rateObject": {
      "name": "exolix",
      "rate": 0,
      "rate_id": null,
      "min": 0.001,
      "higher_min": 0.00102,
      "max": 10.0,
      "exchangetype": "Floating",
      "eta": "4-20 Min",
      "kyc": "Not Required",
      "rating": "4.3/5"
    },
    "hasGiveAway": true
  },
  "error": {
    "code": "deposit_above_range",
    "message": "Amount exceeds maximum exchange limit"
  }
}
```

#### 6. Exchange API Error
**Status Code:** `502 Bad Gateway`

```json
{
  "success": false,
  "data": {
    "rateObject": {
      "name": "simpleswap",
      "rate": 0,
      "rate_id": null,
      "min": 0,
      "higher_min": 0,
      "max": 0,
      "exchangetype": "Fixed",
      "eta": "9-50 Min",
      "kyc": "Rarely Required",
      "rating": "4.1/5"
    },
    "hasGiveAway": false
  },
  "error": {
    "code": "exchange_response_error",
    "message": "Failed to fetch rate from exchange API"
  }
}
```

#### 7. Settings Error
**Status Code:** `500 Internal Server Error`

```json
{
  "success": false,
  "error": {
    "code": "settings_error",
    "message": "Failed to fetch exchange settings",
    "details": "Partners settings not found"
  }
}
```

---

## Error Codes Summary

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `invalid_input` | 400 | Invalid request parameters |
| `exchange_disabled` | 403 | Exchange is disabled in settings |
| `coin_not_found` | 404 | Coin not found in database for this exchange |
| `deposit_below_range` | 200 | Amount below minimum limit |
| `deposit_above_range` | 200 | Amount above maximum limit |
| `exchange_response_error` | 502 | Failed to fetch from exchange API |
| `settings_error` | 500 | Failed to fetch exchange settings |

---

## Supported Exchanges

The API supports 9 cryptocurrency exchanges:

| Exchange | Value | Network Support | Note |
|----------|-------|-----------------|------|
| Changelly | `changelly` | Ticker + Network | Uses ticker AND network |
| ChangeNOW | `changenow` | Ticker + Network | Uses ticker AND network |
| ChangeHero | `changehero` | Ticker only | Uses ticker only |
| SimpleSwap | `simpleswap` | Ticker only | Uses ticker only |
| Godex | `godex` | Ticker + Network | Uses ticker AND network |
| StealthEX | `stealthex` | Ticker only | Uses ticker only |
| LetsExchange | `letsexchange` | Ticker only | Uses ticker only |
| Exolix | `exolix` | Ticker + Network | Uses ticker AND network |
| EasyBit | `easybit` | Ticker + Network | Uses ticker AND network |

---

## Exchange Metadata

Each exchange has associated metadata that is included in the response:

```javascript
{
  changelly: {
    eta: "5-30 Min",
    kyc: "On Occasion",
    rating: "3.9/5"
  },
  changenow: {
    eta: "10-60 Min",
    kyc: "Rarely Required",
    rating: "4.5/5"
  },
  changehero: {
    eta: "12-26 Min",
    kyc: "On Occasion",
    rating: "4.4/5"
  },
  simpleswap: {
    eta: "9-50 Min",
    kyc: "Rarely Required",
    rating: "4.1/5"
  },
  godex: {
    eta: "14-51 Min",
    kyc: "Rarely Required",
    rating: "4.5/5"
  },
  stealthex: {
    eta: "7-38 Min",
    kyc: "Rarely Required",
    rating: "4.4/5"
  },
  letsexchange: {
    eta: "2-44 Min",
    kyc: "Not Required",
    rating: "4.6/5"
  },
  exolix: {
    eta: "4-20 Min",
    kyc: "Not Required",
    rating: "4.3/5"
  },
  easybit: {
    eta: "2-44 Min",
    kyc: "On Occasion",
    rating: "4.7/5"
  }
}
```

### KYC Levels
- **Not Required**: No KYC ever needed
- **Rarely Required**: Only for large amounts or suspicious activity
- **On Occasion**: May be required randomly or for certain amounts

---

## Validation Rules

### Request Validation

1. **sell** (required)
   - Must be a non-empty string
   - Must be a valid coin ticker
   - Case-insensitive

2. **get** (required)
   - Must be a non-empty string
   - Must be a valid coin ticker
   - Case-insensitive

3. **amount** (required)
   - Must be a valid number
   - Must be positive
   - Must be within min/max range

4. **exchangetype** (required)
   - Must be exactly "Fixed" or "Floating"
   - Case-sensitive

5. **exchange** (required)
   - Must be one of the 9 supported exchanges
   - Case-sensitive
   - All lowercase

---

## Testing

### Using the API Tester

Access the built-in API tester at: `http://localhost:5001/api-tester`

**Features:**
- ✅ **Searchable Coin Dropdowns**: Type to search and filter coins by ticker, name, or network
- ✅ **Real-time Search**: Instantly filters through 1000+ coins as you type
- ✅ **Smart Selection**: Click to select from filtered results
- ✅ **Auto-loaded Coins**: Automatically fetches all standard coins from swap/search-coins API
- ✅ **Real-time Testing**: Test all exchanges instantly
- ✅ **Response Display**: Pretty-printed JSON responses with syntax highlighting
- ✅ **Status Codes**: Color-coded status indicators (green for success, red for errors)

**How to Use:**
1. Navigate to the Rate Controller section
2. Click on "Get Exchange Rate" to expand the form
3. Type in the "Send Coin" search box to filter coins (e.g., type "BTC" or "Bitcoin")
4. Select your desired coin from the dropdown
5. Repeat for "Receive Coin"
6. Enter amount, exchange type (Fixed/Floating), and exchange
7. Click "Get Rate" to test the API

### Manual Testing with cURL

```bash
# Fixed Rate Example
curl -X POST http://localhost:5001/api/rate \
  -H "Content-Type: application/json" \
  -d '{
    "sell": "BTC",
    "get": "ETH",
    "amount": 1.0,
    "exchangetype": "Fixed",
    "exchange": "changelly"
  }'

# Floating Rate Example
curl -X POST http://localhost:5001/api/rate \
  -H "Content-Type: application/json" \
  -d '{
    "sell": "ETH",
    "get": "USDT",
    "amount": 5.0,
    "exchangetype": "Floating",
    "exchange": "changenow"
  }'

# Test Amount Below Minimum
curl -X POST http://localhost:5001/api/rate \
  -H "Content-Type: application/json" \
  -d '{
    "sell": "BTC",
    "get": "ETH",
    "amount": 0.0001,
    "exchangetype": "Fixed",
    "exchange": "stealthex"
  }'
```

---

## Usage Examples

### Example 1: Get Fixed Rate from Changelly

```javascript
const response = await fetch('http://localhost:5001/api/rate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    sell: 'BTC',
    get: 'ETH',
    amount: 1.0,
    exchangetype: 'Fixed',
    exchange: 'changelly'
  })
});

const data = await response.json();

if (data.success) {
  console.log(`Rate: ${data.data.rateObject.rate} ETH`);
  console.log(`Min: ${data.data.rateObject.min} BTC`);
  console.log(`Max: ${data.data.rateObject.max} BTC`);
  console.log(`Rate ID: ${data.data.rateObject.rate_id}`);
} else {
  console.error(`Error: ${data.error.message}`);
}
```

### Example 2: Get Floating Rate from ChangeNOW

```javascript
const getRateFromChangeNOW = async (from, to, amount) => {
  const response = await fetch('http://localhost:5001/api/rate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sell: from,
      get: to,
      amount: amount,
      exchangetype: 'Floating',
      exchange: 'changenow'
    })
  });

  return await response.json();
};

// Usage
const rate = await getRateFromChangeNOW('ETH', 'USDT', 10);
console.log(rate);
```

### Example 3: Compare Rates Across Exchanges

```javascript
const compareRates = async (from, to, amount) => {
  const exchanges = [
    'changelly', 'changenow', 'changehero',
    'simpleswap', 'godex', 'stealthex',
    'letsexchange', 'exolix', 'easybit'
  ];

  const promises = exchanges.map(exchange =>
    fetch('http://localhost:5001/api/rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sell: from,
        get: to,
        amount: amount,
        exchangetype: 'Floating',
        exchange: exchange
      })
    }).then(res => res.json())
  );

  const results = await Promise.all(promises);

  // Filter successful rates and sort by best rate
  const validRates = results
    .filter(r => r.success)
    .map(r => ({
      exchange: r.data.rateObject.name,
      rate: r.data.rateObject.rate,
      eta: r.data.rateObject.eta
    }))
    .sort((a, b) => b.rate - a.rate);

  return validRates;
};

// Usage
const rates = await compareRates('BTC', 'ETH', 1);
console.table(rates);
```

---

## Integration Notes

### 1. Coin Ticker Mapping

The API automatically maps standard tickers to exchange-specific tickers using the `fetchCoinFromDB()` helper function. This handles cases where:

- Exchange uses different ticker format (e.g., "btc" vs "BTC")
- Network specification is required (e.g., "eth-erc20" vs "eth-bep20")
- Coin has multiple networks

### 2. Rate ID Usage

For **Fixed Rate** exchanges:
- The `rate_id` is returned in the response
- This ID must be passed when creating a transaction
- The rate is locked and guaranteed for a limited time
- Expiration time varies by exchange (typically 30-60 seconds)

For **Floating Rate** exchanges:
- No `rate_id` is returned (`null`)
- Rate may change between quote and execution
- Generally offers better rates
- Higher risk for price volatility

### 3. Min/Max Validation

Always validate amount before creating transactions:

```javascript
if (amount < rateObject.higher_min) {
  // Show error: amount too low
  // Recommend using at least higher_min
}

if (amount > rateObject.max) {
  // Show error: amount too high
  // Recommend splitting into multiple transactions
}
```

### 4. Exchange Status Checking

The API automatically checks if an exchange is enabled via the settings table:

```sql
SELECT value FROM settings WHERE key = 'partners';
```

The `partners` setting contains an array of exchange objects:

```json
[
  {
    "name": "changelly",
    "isEnabled": true,
    "hasGiveAway": true
  },
  {
    "name": "changenow",
    "isEnabled": true,
    "hasGiveAway": false
  }
]
```

---

## Best Practices

1. **Always validate amount** against min/max before showing to users
2. **Use higher_min** instead of min for better success rate
3. **Handle 200 status with error** for range violations
4. **Cache exchange metadata** to reduce API calls
5. **Implement retry logic** for 502 errors
6. **Show ETA to users** for better UX
7. **Display KYC requirements** upfront
8. **Compare rates** across multiple exchanges for best value
9. **Use Fixed rates** for price certainty
10. **Use Floating rates** for better rates

---

## Troubleshooting

### Common Issues

**1. "Coin not found in database"**
- Ensure the coin ticker exists in swap_crypto table
- Check if the coin has a mapping for the specific exchange
- Verify standardTicker is used, not exchange-specific ticker

**2. "Exchange response error"**
- Check if exchange API keys are configured in .env
- Verify internet connectivity
- Check exchange API status
- Implement retry with exponential backoff

**3. "Amount below/above range"**
- Always fetch rate first to get min/max
- Use higher_min for better success rate
- Show range to users before they enter amount

**4. "Exchange disabled"**
- Check settings table for exchange status
- Enable exchange via admin settings API
- Verify partners array in settings

---

## Environment Variables

Required API keys for each exchange:

```env
# Changelly
CHANGELLY_PRIVATE_KEY=your_private_key_hex

# ChangeNOW
CHANGENOW_API_KEY=your_api_key

# ChangeHero
CHANGEHERO_API_KEY=your_api_key

# SimpleSwap
SIMPLESWAP_API_KEY=your_api_key

# Godex
# No API key required

# StealthEX
STEALTHEX_API_KEY=your_api_key

# LetsExchange
LETSEXCHANGE_API_KEY=your_api_key

# Exolix
# No API key required

# EasyBit
EASYBIT_API_KEY=your_api_key
```

---

## Rate Limits

Rate limits vary by exchange. General guidelines:

| Exchange | Rate Limit | Notes |
|----------|-----------|-------|
| Changelly | ~1 req/sec | Shared across all endpoints |
| ChangeNOW | ~2 req/sec | Per API key |
| ChangeHero | ~1 req/sec | Per IP address |
| SimpleSwap | ~1 req/sec | Per API key |
| Godex | No limit | Public API |
| StealthEX | ~1 req/sec | Per API key |
| LetsExchange | ~2 req/sec | Per API key |
| Exolix | No limit | Public API |
| EasyBit | ~1 req/sec | Per API key |

Implement request queuing and throttling for production use.

---

## Security Considerations

1. **API Keys**: Never expose API keys to frontend
2. **Rate Limiting**: Implement server-side rate limiting
3. **Input Validation**: Always validate and sanitize user input
4. **HTTPS Only**: Use HTTPS in production
5. **CORS**: Configure appropriate CORS policies
6. **Logging**: Log all rate requests for audit trail
7. **Error Messages**: Don't expose sensitive info in errors

---

## Future Improvements

Potential enhancements:

1. **Caching**: Implement rate caching (30-60 seconds)
2. **Webhooks**: Real-time rate updates
3. **Batch Requests**: Get rates from multiple exchanges in one call
4. **Historical Data**: Store and analyze historical rates
5. **Price Alerts**: Notify users of favorable rates
6. **Auto-routing**: Automatically select best exchange
7. **Fallback Logic**: Use alternative exchange if primary fails

---

## Support

For issues or questions:

1. Check this documentation first
2. Review exchange-specific API docs
3. Test using the API tester at `/api-tester`
4. Check server logs for detailed errors
5. Verify environment variables are set correctly
