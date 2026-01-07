# Switch Onramp Integration Guide

This guide provides details on how to integrate the Switch Onramp API for converting fiat currency to stablecoins.

## Base URL
`https://api.onswitch.xyz`

## Authentication
All requests require the `X-Service-Key` header with your Switch API service key.

## Endpoints

### 1. Get Onramp Quote
Get a real-time quote for an onramp transaction including exchange rate, settlement time, and payment rail information.

**Endpoint:** `POST /onramp/quote`

**Request Body:**
```json
{
  "amount": 150050,
  "country": "NG",
  "asset": "base:usdc",
  "currency": "NGN",
  "rail": "NIBSS",
  "exact_output": false
}
```

**Response (Success):**
```json
{
  "success": true,
  "status": 200,
  "message": "Quote fetched successfully",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "data": {
    "rate": 1500.5,
    "expiry": "2024-01-01T00:05:00.000Z",
    "settlement": "Same day",
    "rail": "NIBSS",
    "source": {
      "amount": 150050,
      "currency": "NGN"
    },
    "destination": {
      "amount": 100,
      "currency": "USDC"
    }
  }
}
```

### 2. Initiate Onramp Transaction
Initiate a fiat to stablecoin transaction.

**Endpoint:** `POST /onramp/initiate`

**Request Body:**
```json
{
  "amount": 150050,
  "country": "NG",
  "currency": "NGN",
  "asset": "base:usdc",
  "beneficiary": {
    "holder_type": "INDIVIDUAL",
    "holder_name": "John Doe",
    "wallet_address": "0x1234567890123456789012345678901234567890"
  },
  "exact_output": false,
  "callback_url": "https://your-app.com/webhooks/onramp",
  "reference": "550e8400-e29b-41d4-a716-446655440000",
  "rail": "NIBSS"
}
```

**Response (Success):**
```json
{
  "success": true,
  "status": 200,
  "message": "Onramp initiated successfully",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "data": {
    "status": "PENDING",
    "type": "ONRAMP",
    "reference": "550e8400-e29b-41d4-a716-446655440000",
    "payload": null,
    "source": {
      "amount": 150050,
      "currency": "NGN"
    },
    "destination": {
      "amount": 100,
      "currency": "USDC"
    },
    "deposit": {
      "bank_name": "Example Bank",
      "bank_code": "058",
      "account_name": "Your Company Name",
      "account_number": "0123456789",
      "note": [
        "Deposit exactly 150,050 NGN to the account above",
        "Include the reference in the payment narration"
      ]
    }
  }
}
```

## Supported Assets
The `asset` field supports the following formats (`network:token`):

- **Base:** `base:usdc`, `base:cngn`
- **Solana:** `solana:usdc`, `solana:usdt`

## Supported Payment Rails
The `rail` field specifies the payment method. Common examples include:

- `NIBSS` (Nigeria)

## Supported Countries
Switch supports a vast number of countries. Use the 2-letter ISO country code (e.g., `NG`, `US`, `GB`, `GH`, `KE`, `ZA`).

## Supported Currencies
Switch supports a wide range of fiat currencies corresponding to the supported countries (e.g., `NGN`, `USD`, `GBP`, `EUR`, `KES`, `ZAR`).

# Important Note
- Jumpa only supports 2 blockchains for now - solana and base. So even though switch supported assets are many, jumpa only supports `base:usdc` `base:cngn` and `solana:usdc` `solana:usdt`
- Jumpa supports 1 payment rails for now - `NIBSS`
- To start an onramp, get a quote and then initiate the onramp transaction. Callback URL should be empty since this is a telegram bot