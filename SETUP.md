# x402 Integration Setup Guide

## Overview
This application implements the full x402 payment protocol on Base Sepolia testnet with automatic payment handling using x402-fetch.

**Receiver Address**: `0xabaf59180e0209bdb8b3048bfbe64e855074c0c4`
**Payment Amount**: 0.001 USDC
**Network**: Base Sepolia
**Facilitator**: https://x402.org/facilitator

## Architecture

### Frontend (Client-Side)
- Uses `x402-fetch` to wrap the native fetch API
- Automatically handles 402 Payment Required responses
- Integrates with MetaMask or any EVM-compatible wallet
- Automatically signs and submits payment transactions

### Backend (Server-Side)
- Returns HTTP 402 when payment is required
- Verifies payment proofs using Coinbase's facilitator
- Stores payment records in Supabase
- Returns shortened URLs only after payment verification

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

Required packages:
- `x402-fetch` - Client-side payment handling
- `viem` - Wallet client for signing transactions
- `@coinbase/x402` - Facilitator integration
- `@supabase/supabase-js` - Database

### 2. Environment Variables

Create a `.env.local` file with:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Base URL for shortened URLs
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 3. Database Setup (Supabase)

Create a table named `urls` with the following schema:

```sql
CREATE TABLE urls (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  original_url TEXT NOT NULL,
  short_code TEXT NOT NULL UNIQUE,
  payment_hash TEXT NOT NULL,
  receiver_address TEXT NOT NULL,
  payment_amount TEXT NOT NULL,
  payment_currency TEXT NOT NULL,
  network TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_short_code ON urls(short_code);
```

### 4. Wallet Setup (Client)

Users need:
- MetaMask or compatible EVM wallet
- USDC on Base Sepolia testnet
- Test USDC can be obtained from Coinbase Faucet or other testnet faucets

### 5. Run the Application

```bash
npm run dev
```

Visit `http://localhost:3000`

## How It Works

### User Flow

1. **Connect Wallet**
   - User clicks "Connect Wallet"
   - MetaMask opens and requests account access
   - x402-fetch is initialized with the connected account

2. **Enter URL**
   - User enters a long URL to shorten
   - Clicks "Shorten URL"

3. **Payment Required (402)**
   - Backend returns HTTP 402 with payment details
   - Frontend displays payment prompt

4. **Automatic Payment (x402-fetch)**
   - User clicks "Pay & Create"
   - x402-fetch intercepts the 402 response
   - Automatically signs payment transaction using wallet
   - Submits payment to facilitator
   - Retries request with X-PAYMENT header

5. **Payment Verification**
   - Backend receives X-PAYMENT header
   - Verifies proof with Coinbase facilitator
   - Creates short URL in database
   - Returns shortened URL to user

## Payment Flow Details

### Request Without Payment
```
POST /api/create-short-url
Content-Type: application/json

{ "originalUrl": "https://example.com/very/long/url" }

Response: 402 Payment Required
{
  "error": "Payment required",
  "requiresPayment": true,
  "payment": {
    "destinationAddress": "0xabaf59180e0209bdb8b3048bfbe64e855074c0c4",
    "amount": "0.001",
    "currency": "USDC",
    "network": "base-sepolia",
    "facilitatorUrl": "https://x402.org/facilitator",
    ...
  }
}
```

### Request With Payment
```
POST /api/create-short-url
Content-Type: application/json
X-PAYMENT: <payment_proof_from_x402>

{ "originalUrl": "https://example.com/very/long/url" }

Response: 200 OK
{
  "success": true,
  "shortUrl": "http://localhost:3000/abc123",
  "shortCode": "abc123",
  "originalUrl": "https://example.com/very/long/url",
  "payment": {
    "verified": true,
    "receiver": "0xabaf59180e0209bdb8b3048bfbe64e855074c0c4",
    "amount": "0.001",
    "currency": "USDC",
    "network": "base-sepolia"
  }
}
```

## Testing

### Manual Testing
1. Connect wallet with test USDC on Base Sepolia
2. Enter a URL
3. Click "Shorten URL" (triggers 402)
4. Click "Pay & Create" (x402-fetch handles payment automatically)
5. Verify shortened URL is created

### Verification
- Check Supabase for new URL records
- Verify payment hash is stored
- Test redirect by visiting shortened URL

## Troubleshooting

### "Please install MetaMask"
- Install MetaMask extension
- Ensure you're on a supported browser

### "x402-fetch not initialized"
- Reconnect wallet
- Check browser console for errors

### Payment fails
- Ensure USDC balance on Base Sepolia
- Check network is set to Base Sepolia in wallet
- Verify facilitator URL is accessible

### Database errors
- Verify Supabase credentials in .env.local
- Check table schema matches expected structure
- Ensure anon key has insert permissions

## Architecture Files

- `app/page.tsx` - Frontend UI with x402-fetch integration
- `app/api/create-short-url/route.ts` - Backend payment verification
- `lib/x402.ts` - x402 utilities and facilitator integration
- `lib/x402-client.ts` - Client-side payment helpers

## References

- [x402-fetch Documentation](https://www.npmjs.com/package/x402-fetch)
- [Coinbase x402 Docs](https://docs.cdp.coinbase.com/x402)
- [viem Documentation](https://viem.sh/)
- [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet)
