# Coinoswap Server

This is the backend server for Coinoswap, a cryptocurrency exchange aggregator. It provides APIs for fetching exchange rates, creating transactions, and managing offers from multiple crypto exchange providers.

## Features

- Aggregates rates and offers from multiple crypto exchanges (Changelly, ChangeNOW, StealthEX, Exolix, SimpleSwap, Godex, LetsExchange, Easybit)
- Provides endpoints for price checks, offers, and transaction creation
- Admin and support endpoints
- Scheduled tasks (cron jobs) for email and transaction status updates
- Logging for errors and server events

## Project Structure

- `controllers/` - Business logic for offers, exchanges, admin, support, etc.
- `routes/web.js` - Main API routes
- `logs/` - Log files (ignored by git)
- `database/` - Database connection logic
- `Email_template/` - Email templates and assets
- `Js/` - Middleware and utility functions

## Installation

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your environment variables:
   - Copy `.env.example` to `.env` and fill in the required values (database, email, etc.)

## Usage

Start the development server with:

```bash
npm start
```

The server will run with `nodemon` for auto-reloading.

## API Overview

Here are some of the main endpoints:

- `GET /currencies` — List supported currencies
- `POST /pricecheck` — Get home page price
- `POST /changelly/price`, `/changenow/price`, etc. — Get price from specific exchange
- `POST /offers` — Get available offers
- `POST /createTransaction/<exchange>/float` — Create a floating transaction for a specific exchange

See `routes/web.js` for the full list of endpoints and request/response formats.

## Logging

- All log files are stored in the `logs/` directory and are ignored by git.
- Error and status logs are organized by exchange and type.

## License

This project is licensed under the ISC License.

---

_For questions or support, please contact the project maintainer._
