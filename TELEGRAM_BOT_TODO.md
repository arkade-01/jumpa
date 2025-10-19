# 🤖 Jumpa Ajo Bot - Telegram Bot Development TODO

## 📋 Overview

This document outlines the complete development roadmap for the Jumpa Ajo Telegram bot - a collaborative trading platform where users interact directly through Telegram commands. No REST APIs needed - everything is built into the bot.

## 🎯 Project Vision

Create a Telegram-first collaborative trading bot where users can:

- Form "Ajo" groups (traditional savings groups)
- Pool SOL for collective trading
- Vote on trading decisions
- Share profits based on contributions

---

## 🗂️ Development Phases

### **Phase 1: Core Infrastructure & Setup** ⚙️

#### 🔧 Project Foundation

- [x] **Fix current module system** - Resolve CommonJS/ES module conflicts
- [x] **Environment configuration** - Set up `.env` with:
  - `BOT_TOKEN` - Telegram bot token
  - `DATABASE_URL` - MongoDB connection string
  - `SOLANA_RPC_URL` - Solana RPC endpoint
  - `ENCRYPTION_KEY` - For private key encryption
- [x] **Database schema design** - Design MongoDB schemas for users and ajo_groups
- [x] **Database connection** - Set up MongoDB with Mongoose
- [x] **Error handling middleware** - Global error handling and logging system
- [x] **Private key encryption** - Secure wallet storage

#### 📊 Database Models ✅ **COMPLETED**

- [x] **User model** - telegram_id, username, wallet_address, private_key_encrypted
- [x] **AjoGroup model** - Embedded members, polls, trades arrays

---

### **Phase 2: User Management & Registration** 👤

#### 👤 User System

- [ ] **User registration command** - `/register`

  - Auto-generate Solana wallet for new users
  - Store user data in MongoDB
  - Send wallet backup message to user

- [x] **Wallet generation service** ✅ **COMPLETED**

  - Generate new Solana wallet using `@solana/web3.js`
  - Store encrypted private key in database
  - Return wallet address and private key backup

- [x] **Private key encryption** ✅ **COMPLETED**

  - Use `crypto` module to encrypt private keys
  - Store encryption key in environment variables
  - Implement decryption for transaction signing

- [ ] **User profile commands**

  - `/profile` - Show user profile and wallet info
  - `/wallet` - Show wallet address and backup instructions
  - `/my_groups` - List user's Ajo groups

- [ ] **User authentication**
  - Check if user exists in database
  - Auto-register new users on first interaction
  - Store telegram_id as primary identifier

---

### **Phase 3: Ajo Group Management** 🏗️

#### 🏗️ Group Creation (Telegram Bot Commands)

- [ ] **Create Ajo command** - `/create_ajo`

  - Interactive form to collect group details
  - Validate input parameters
  - Create group in database
  - Add bot to Telegram group

- [ ] **Group validation**

  - Validate trader addresses are valid Solana addresses
  - Ensure consensus threshold is reasonable (50-100%)
  - Validate initial capital amount
  - Check if user has sufficient permissions

- [ ] **Member invitation system**

  - Generate invite commands like `/join <group_id>`
  - Track invitation usage in database
  - Limit invitations per group
  - Auto-add bot to group when invited

- [ ] **Group status management**
  - Active: Normal operation
  - Paused: No new polls, existing polls continue
  - Ended: Distribute profits, no new activity

#### 👥 Member Management

- [ ] **Join Ajo service**

  - Process `/join <group_id>` command
  - Validate user is registered
  - Check group capacity
  - Add user as member to database

- [ ] **Member role assignment**

  - Creator is automatically a trader
  - Other users start as members
  - Allow promotion to trader via governance polls

- [ ] **Member contribution tracking**
  - Track SOL contributions per member
  - Calculate profit share percentage
  - Handle partial contributions
  - Update group balance when members contribute

---

### **Phase 4: Polling & Voting System** 🗳️

#### 🗳️ Poll Management

- [ ] **Create poll service**

  - Trade proposals: token, amount, reasoning
  - Governance changes: add/remove traders
  - End Ajo: distribute profits

- [ ] **Poll validation**

  - Validate token addresses
  - Check amount doesn't exceed vault balance
  - Ensure trader has permission to create polls

- [ ] **Poll state machine**

  ```
  Created → Open → Voting → Executed/Cancelled
  ```

- [ ] **Poll expiration**
  - Auto-expire polls after 24-48 hours
  - Send reminders before expiration
  - Handle expired polls gracefully

#### ⚡ Voting System

- [ ] **Vote processing**

  - Handle `/vote <poll_id> <yes/no>` commands
  - Validate user is member of group
  - Ensure user hasn't already voted

- [ ] **Consensus calculation**

  - Weight trader votes more heavily
  - Calculate percentage based on contribution
  - Check if threshold is reached

- [ ] **Auto-execution**
  - Execute poll when consensus reached
  - Handle failed executions
  - Update poll status

---

### **Phase 5: Bot Command Handlers** 🤖

#### 📋 General Member Commands

- [ ] **`/info` handler**

  ```
  📊 Ajo Group: CryptoCrew
  💰 Capital: $1,000 SOL
  👥 Members: 7/10
  🗳️ Consensus: 67%
  📈 Status: Active
  ```

- [ ] **`/members` handler**

  ```
  👥 Ajo Members:
  @alice (Trader) - $200 (20%)
  @bob (Member) - $150 (15%)
  @charlie (Trader) - $300 (30%)
  ...
  ```

- [ ] **`/history` handler**

  ```
  📈 Recent Trades:
  1. BONK - 500 tokens @ $0.001
  2. SOL - 2 tokens @ $95
  3. SOL - 1000 @ $1.00
  ```

- [ ] **`/balance` handler**

  ```
  💰 Vault Balance: $1,250 SOL
  👤 Your Contribution: $200 (16%)
  📊 Your Share: 16% of profits
  ```

- [ ] **`/join <group_id>` handler**
  - Join existing Ajo group
  - Validate user registration
  - Check group capacity

#### 🛠️ Trader Commands

- [ ] **`/poll_trade <token> <amount>` handler**

  ```
  🗳️ New Trade Proposal:
  Token: BONK
  Amount: 500 tokens
  Estimated Cost: $500 SOL

  Vote with: /vote <poll_id> yes/no
  ```

- [ ] **`/poll_trader add/remove <pubkey>` handler**

  - Propose adding/removing traders
  - Validate public key
  - Create governance poll

- [ ] **`/poll_end` handler**
  - Propose ending Ajo
  - Calculate profit distribution
  - Create end poll

#### 🔧 Admin Commands

- [ ] **`/admin_stats` handler**
  - Show group statistics and performance
  - Display member activity
  - Show trading history

---

### **Phase 6: Integration & External Services** 🔗

#### 🔗 Solana Integration

- [ ] **RPC client setup** **DONE**

  - Connect to Solana RPC endpoints
  - Handle connection failures
  - Implement retry logic

- [ ] **Wallet service** 

  - Generate new wallets
  - Import existing wallets
  - Sign transactions

- [ ] **Transaction builder**

  - Build SOL transfer transactions
  - Build token swap transactions
  - Handle transaction fees

- [ ] **Balance checking**
  - Check SOL balances
  - Check token balances
  - Cache balance data

#### 📊 Data & Analytics

- [ ] **Trade execution tracking**

  - Log all executed trades
  - Store execution details
  - Track success/failure rates

- [ ] **Performance metrics**
  - Calculate group ROI
  - Track individual contributions
  - Generate performance reports

---

### **Phase 7: Bot Command System** 🤖

#### 🤖 Bot Command Handlers

- [ ] **User management commands**

  - `/register` - Register new user and create wallet
  - `/profile` - Show user profile and wallet info
  - `/wallet` - Display wallet address and backup
  - `/my_groups` - List user's Ajo groups

- [ ] **Group management commands**

  - `/create_ajo` - Create new Ajo group
  - `/join <group_id>` - Join existing Ajo group
  - `/leave <group_id>` - Leave Ajo group
  - `/group_info <group_id>` - Show group details

- [ ] **Poll and voting commands**

  - `/poll_trade <token> <amount>` - Create trade poll
  - `/poll_end` - Create end Ajo poll
  - `/vote <poll_id> <yes/no>` - Vote on polls
  - `/polls` - List active polls

- [ ] **Information commands**
  - `/info` - Show group info (capital, consensus, status)
  - `/members` - List members and roles
  - `/history` - Show trade history
  - `/balance` - Show vault balance

#### 🔄 Bot Integration

- [ ] **Telegram bot setup** - Configure bot token and webhook
- [ ] **Message handlers** - Handle different message types (text, commands, etc.)
- [ ] **Group management** - Handle bot being added/removed from groups
- [ ] **Smart contract integration** - Connect to Solana RPC for on-chain data

---

### **Phase 8: Testing & Quality Assurance** 🧪

#### 🧪 Testing Suite

- [ ] **Unit tests**

  - Test all service functions
  - Test utility functions
  - Test validation logic

- [ ] **Integration tests**

  - Test bot command flows
  - Test database operations
  - Test Solana integration

- [ ] **Bot command tests**

  - Test all Telegram bot commands
  - Test error handling
  - Test user flows

- [ ] **Load testing**
  - Test bot performance under load
  - Test database performance
  - Test Solana RPC limits

---

### **Phase 9: Deployment & Monitoring** 🚀

#### 🚀 Deployment Setup

- [ ] **Docker configuration**

  - Create Dockerfile
  - Set up docker-compose
  - Configure environment variables

- [ ] **Environment setup**

  - Development environment
  - Production environment
  - Environment-specific configs

- [ ] **Database migrations**
  - Set up migration system
  - Create initial migrations
  - Handle schema updates

#### 📊 Monitoring & Logging

- [ ] **Application monitoring**

  - Set up health checks
  - Monitor bot uptime
  - Track response times

- [ ] **Error tracking**

  - Set up error logging
  - Create error alerts
  - Track error rates

- [ ] **Usage analytics**
  - Track bot usage
  - Monitor user engagement
  - Generate usage reports

---

### **Phase 10: Documentation & Maintenance** 📚

#### 📚 Documentation

- [ ] **Bot command documentation**

  - Document all commands
  - Include usage examples
  - Add permission requirements

- [ ] **Database documentation**

  - Document all models
  - Include relationships
  - Add migration history

- [ ] **Deployment guide**
  - Document deployment procedures
  - Include troubleshooting
  - Add maintenance procedures

#### 🔧 Maintenance

- [ ] **Backup system**

  - Automated database backups
  - Backup verification
  - Restore procedures

- [ ] **Update system**
  - Version management
  - Update procedures
  - Rollback procedures

---

## 🎯 MVP Priority Order

### Week 1: Foundation

- [x] Phase 1: Core Infrastructure & Setup
- [ ] Phase 2: User Management & Registration

### Week 2: Core Features

- [ ] Phase 3: Ajo Group Management
- [ ] Phase 4: Polling & Voting System

### Week 3: Bot Integration

- [ ] Phase 5: Bot Command Handlers
- [ ] Phase 6: Integration & External Services

### Week 4: Testing & Deployment

- [ ] Phase 7: Bot Command System
- [ ] Phase 8: Testing & Quality Assurance

### Week 5: Production

- [ ] Phase 9: Deployment & Monitoring
- [ ] Phase 10: Documentation & Maintenance

---

## 🛠️ Technology Stack

### Current Stack

- **Runtime:** Node.js with TypeScript
- **Bot Framework:** Telegraf
- **Database:** MongoDB with Mongoose
- **HTTP Client:** Axios (for external APIs)
- **Environment:** dotenv
- **Encryption:** Node.js crypto module ✅
- **Solana:** @solana/web3.js

### Recommended Additions

- **Testing:** Jest
- **Logging:** Winston
- **Validation:** Joi or Zod
- **Monitoring:** Basic console logging for MVP

---

## 📝 Notes

### Key Considerations

- **Security:** Encrypt all private keys, validate all inputs
- **Scalability:** Design for multiple concurrent groups
- **UX:** Keep bot commands simple and intuitive
- **Performance:** Cache frequently accessed data
- **Reliability:** Handle all edge cases and errors gracefully

### Success Metrics

- **Technical:** Response time < 200ms, 99.9% uptime
- **User:** Daily active users, successful trades, user retention
- **Business:** Number of active Ajo groups, total volume traded

---

## 🚀 Getting Started

1. **Clone the repository**
2. **Install dependencies:** `npm install`
3. **Set up environment variables**
4. **Set up database:** Connect to MongoDB
5. **Start development server:** `npm run dev`

---

## 🎯 Current Progress

### ✅ **Completed:**

- Module system fixes
- Database models (User, AjoGroup)
- Wallet creation service
- Private key encryption
- Basic bot structure

### 🔄 **In Progress:**

- User registration flow
- Bot command handlers
- Solana integration

### 📋 **Next Steps:**

- Implement `/register` command
- Create user authentication flow
- Build group creation system
- Add polling and voting functionality

---

_This document serves as your complete Telegram bot development roadmap. Check off items as you complete them and update the document as needed._
