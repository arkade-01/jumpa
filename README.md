# Jumpa - Collaborative Crypto Trading Bot

A Telegram-based collaborative trading bot that enables users to create groups for collective cryptocurrency trading on Solana and EVM blockchains.

## 🌟 Features

- **Multi-Chain Support**: Trade on Solana and EVM-compatible chains
- **Collaborative Trading**: Create groups and make collective trading decisions
- **Multi-Wallet Management**: Support for multiple Solana and EVM wallets
- **Secure Key Storage**: Encrypted private key storage
- **Fiat On/Off Ramp**: NGN withdrawal support via integrated payment gateway
- **On-Chain State**: Anchor smart contract integration for transparent group management
- **Social Trading**: Referral system and community-driven decision making

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js with TypeScript
- **Bot Framework**: Telegraf (Telegram Bot API)
- **Database**: MongoDB with Mongoose ODM
- **Blockchain**: 
  - Solana (web3.js, Anchor, SPL Token)
  - EVM (ethers.js)

### Key Libraries
- `@solana/web3.js` - Solana blockchain interaction
- `@coral-xyz/anchor` - Solana smart contract framework
- `telegraf` - Telegram bot development
- `ethers` - Ethereum wallet & transactions
- `mongoose` - MongoDB object modeling

## 📁 Project Structure

```
jumpa/
├── src/                          # Source code
│   ├── index.ts                  # Application entry point
│   ├── core/                     # Core configuration
│   │   └── config/               # Environment & database config
│   ├── blockchain/               # Blockchain integrations
│   │   └── solana/               # Solana & Anchor services
│   ├── database/                 # Data layer
│   │   └── models/               # Mongoose schemas
│   ├── modules/                  # Feature modules
│   │   ├── onboarding/           # User onboarding
│   │   ├── wallets/              # Wallet management
│   │   ├── groups/               # Group operations
│   │   ├── governance/           # Polls & voting
│   │   ├── trading/              # Token trading
│   │   ├── payments/             # Fiat withdrawals
│   │   └── users/                # User services
│   ├── bot/                      # Bot infrastructure
│   │   ├── commands/             # Command handling
│   │   └── callbacks/            # Callback handlers
│   └── shared/                   # Shared utilities
│       ├── utils/                # Helper functions
│       └── state/                # State management
├── docs/                         # Documentation
├── dist/                         # Compiled output (gitignored)
└── node_modules/                 # Dependencies (gitignored)
```

## 🚀 Installation

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- MongoDB database
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
- Solana RPC endpoint (Mainnet/Devnet)
- (Optional) EVM RPC endpoint

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/arkade-01/jumpa.git
   cd jumpa
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   # Bot Configuration
   BOT_TOKEN=your_telegram_bot_token

   # Database
   # DB_URL=mongodb+srv://username:password@cluster.mongodb.net/jumpa

   # Solana
   SOL_MAINNET=https://api.mainnet-beta.solana.com
   SOL_DEVNET=https://api.devnet.solana.com
   RPC_URL=https://api.mainnet-beta.solana.com

   # EVM (Optional)
   EVM_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your-key

   # Payment Gateway (Yara)
   PAYMENT_WIDGET_URL=
   PAYMENT_RATE_URL=
   YARA_API_KEY=your_yara_api_key

   # Security
   ENCRYPTION_KEY=your_256_bit_hex_key
   ```

4. **Generate encryption key**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Copy the output to `ENCRYPTION_KEY` in `.env`

## 💻 Development

### Run in development mode
```bash
npm run dev
```

### Build the project
```bash
npm run build
```

### Run in production mode
```bash
npm run build
npm start
```

### Watch mode (auto-compile)
```bash
npm run watch
```

## 🏗️ Architecture

### Path Aliases
The project uses TypeScript path aliases for clean imports:

```typescript
import { config } from '@core/config/config';
import { User } from '@database/models/user';
import { WalletService } from '@modules/wallets/balanceService';
import { encryption } from '@shared/utils/encryption';
```

### Module Organization
Features are organized by domain (Domain-Driven Design):
- Each module contains its commands, callbacks, and services
- Clear separation of concerns
- Easy to test and maintain

### State Management
In-memory state management for multi-step user flows:
- User actions (wallet import, PIN setup)
- Withdrawal flows
- Trade confirmations
- Bank updates

## 📚 Documentation

- [On-Chain Commands Guide](docs/ON_CHAIN_COMMANDS_GUIDE.md)
- [Testing Guide](docs/TESTING_GUIDE.md)

## 🚢 Deployment

### Deploy to Railway
```bash
# Railway will automatically:
# 1. Run npm install
# 2. Run npm run build
# 3. Run npm start
```

### Deploy to Render/Heroku
Set the following:
- **Build Command**: `npm run build`
- **Start Command**: `npm start`
- **Environment Variables**: Add all variables from `.env`

### Environment Variables Required
- `BOT_TOKEN` - Telegram bot token
- `DB_URL` - MongoDB connection string
- `RPC_URL` - Solana RPC endpoint
- `ENCRYPTION_KEY` - 256-bit encryption key
- All other variables from `.env` file

## 🔒 Security

- **Private Key Encryption**: All private keys are encrypted
- **Environment Variables**: Sensitive data stored in environment variables
- **Rate Limiting**: Built-in rate limiting for bot commands

## 🧪 Testing

```bash
npm test
```

See [Testing Guide](docs/TESTING_GUIDE.md) for detailed testing instructions.

## 📋 Available Commands

### User Commands
- `/start` - Register and create wallet
- `/wallet` - Manage wallets
- `/create_group` - Create/manage groups
- `/buy` - Buy tokens
- `/sell` - Sell tokens
- `/withdraw` - Withdraw to NGN
- `/help` - Show help message

### Group Commands
- `/create_group` - Create new group
- `/join` - Join existing group
- `/leave_group` - Leave group
- `/group` - View group details
- `/poll` - Create poll for trading decision

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

ISC License

## 👥 Author

**arkade**

## 🐛 Issues

Report issues at: https://github.com/arkade-01/jumpa/issues

## 🙏 Acknowledgments

- Solana Foundation for blockchain infrastructure
- Anchor framework for smart contract development
- Telegraf community for bot framework support

---
