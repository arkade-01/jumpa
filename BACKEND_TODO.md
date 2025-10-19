# 🚀 Jumpa Ajo Bot - Backend Development TODO

## 📋 Overview

This document outlines the complete backend development roadmap for the Jumpa Ajo Telegram bot - a collaborative trading platform where groups can pool funds and make collective trading decisions.

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

- [ ] **Fix current module system** - Resolve CommonJS/ES module conflicts
- [ ] **Environment configuration** - Set up `.env` with:
  - `BOT_TOKEN` - Telegram bot token
  - `DATABASE_URL` - PostgreSQL connection string
  - `SOLANA_RPC_URL` - Solana RPC endpoint
  - `JWT_SECRET` - For web dashboard auth
- [ ] **Database schema design** - Design PostgreSQL tables for users, ajo_groups, polls, votes
- [ ] **Database connection** - Set up PostgreSQL with Prisma/TypeORM
- [ ] **Error handling middleware** - Global error handling and logging system
- [ ] **Authentication system** - JWT-based auth for web dashboard integration

#### 📊 Database Models

- [ ] **User model**

  ```sql
  - id (UUID, Primary Key)
  - telegram_id (BigInt, Unique)
  - username (String)
  - wallet_address (String, Unique)
  - private_key (String, Encrypted)
  - created_at (Timestamp)
  - updated_at (Timestamp)
  ```

- [ ] **AjoGroup model**

  ```sql
  - id (UUID, Primary Key)
  - name (String)
  - creator_id (UUID, Foreign Key)
  - initial_capital (Decimal)
  - max_members (Integer)
  - consensus_threshold (Decimal, 0-100)
  - backout_window (Integer, hours)
  - contract_address (String)
  - status (Enum: active, paused, ended)
  - created_at (Timestamp)
  ```

- [ ] **AjoMember model**

  ```sql
  - id (UUID, Primary Key)
  - ajo_group_id (UUID, Foreign Key)
  - user_id (UUID, Foreign Key)
  - role (Enum: member, trader)
  - contribution_amount (Decimal)
  - joined_at (Timestamp)
  ```

- [ ] **Poll model**

  ```sql
  - id (UUID, Primary Key)
  - ajo_group_id (UUID, Foreign Key)
  - creator_id (UUID, Foreign Key)
  - type (Enum: trade, governance, end)
  - status (Enum: open, voting, executed, cancelled)
  - token_address (String)
  - amount (Decimal)
  - description (Text)
  - created_at (Timestamp)
  - expires_at (Timestamp)
  ```

- [ ] **Vote model**

  ```sql
  - id (UUID, Primary Key)
  - poll_id (UUID, Foreign Key)
  - user_id (UUID, Foreign Key)
  - vote (Boolean)
  - voted_at (Timestamp)
  ```

- [ ] **Trade model**
  ```sql
  - id (UUID, Primary Key)
  - ajo_group_id (UUID, Foreign Key)
  - poll_id (UUID, Foreign Key)
  - token_address (String)
  - amount (Decimal)
  - price (Decimal)
  - executed_at (Timestamp)
  - status (Enum: pending, executed, failed)
  ```

---

### **Phase 2: User Management & Registration** 👤

#### 👤 User System

- [ ] **User registration endpoint** - `POST /api/users/register`

  - Input: `{ telegram_id, username }`
  - Auto-generate Solana wallet
  - Return: `{ user_id, wallet_address, private_key_backup }`

- [ ] **Wallet generation service**

  - Generate new Solana wallet using `@solana/web3.js`
  - Store encrypted private key
  - Return wallet address and backup phrase

- [ ] **Private key encryption**

  - Use `crypto` module to encrypt private keys
  - Store encryption key separately
  - Implement decryption for transaction signing

- [ ] **User profile management**

  - `GET /api/users/profile` - Get user profile
  - `PUT /api/users/profile` - Update profile
  - `GET /api/users/dashboard` - Get user dashboard data

- [ ] **User authentication**
  - JWT token generation and validation
  - Session management
  - Login/logout endpoints

#### 🔐 Security

- [ ] **Rate limiting**

  - Implement rate limiting for bot commands
  - Rate limit API endpoints
  - Different limits for different user roles

- [ ] **Input validation**

  - Validate all amounts (positive numbers, reasonable limits)
  - Validate Solana addresses
  - Sanitize all user inputs

- [ ] **Audit logging**
  - Log all critical operations
  - Store logs in database
  - Include user_id, action, timestamp, IP

---

### **Phase 3: Ajo Group Management** 🏗️

#### 🏗️ Group Creation (Web Dashboard Integration)

- [ ] **Create Ajo endpoint** - `POST /api/ajo/create`

  ```json
  {
    "name": "CryptoCrew",
    "initial_capital": 1000,
    "max_members": 10,
    "trader_addresses": ["pubkey1", "pubkey2"],
    "consensus_threshold": 67,
    "backout_window": 24
  }
  ```

- [ ] **Group validation**

  - Validate trader addresses are valid Solana addresses
  - Ensure consensus threshold is reasonable (50-100%)
  - Validate initial capital amount

- [ ] **Member invitation system**

  - Generate invite links with expiration
  - Track invitation usage
  - Limit invitations per group

- [ ] **Group status management**
  - Active: Normal operation
  - Paused: No new polls, existing polls continue
  - Ended: Distribute profits, no new activity

#### 👥 Member Management

- [ ] **Join Ajo service**

  - Process `/join` command
  - Validate user is registered
  - Check group capacity
  - Add user as member

- [ ] **Member role assignment**

  - Creator is automatically a trader
  - Other users start as members
  - Allow promotion to trader via governance

- [ ] **Member contribution tracking**
  - Track SOL contributions per member
  - Calculate profit share percentage
  - Handle partial contributions

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

- [ ] **`/backout` handler**
  - Check if within backout window
  - Calculate exit amount
  - Process withdrawal

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

---

### **Phase 6: Integration & External Services** 🔗

#### 🔗 Solana Integration

- [ ] **RPC client setup**

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

### **Phase 7: API Endpoints (Web Dashboard)** 🌐

#### 🌐 REST API

- [ ] **User endpoints**

  - `GET /api/users/profile`
  - `PUT /api/users/profile`
  - `GET /api/users/ajo-groups`
  - `GET /api/users/contributions`

- [ ] **Ajo endpoints**

  - `POST /api/ajo/create`
  - `GET /api/ajo/:id`
  - `PUT /api/ajo/:id`
  - `POST /api/ajo/:id/join`
  - `DELETE /api/ajo/:id/leave`

- [ ] **Poll endpoints**

  - `POST /api/ajo/:id/polls`
  - `GET /api/ajo/:id/polls`
  - `POST /api/polls/:id/vote`
  - `GET /api/polls/:id`

- [ ] **Analytics endpoints**
  - `GET /api/ajo/:id/stats`
  - `GET /api/ajo/:id/performance`
  - `GET /api/users/performance`

---

### **Phase 8: Testing & Quality Assurance** 🧪

#### 🧪 Testing Suite

- [ ] **Unit tests**

  - Test all service functions
  - Test utility functions
  - Test validation logic

- [ ] **Integration tests**

  - Test API endpoints
  - Test database operations
  - Test bot command flows

- [ ] **End-to-end tests**

  - Test complete user flows
  - Test poll creation and voting
  - Test trade execution

- [ ] **Load testing**
  - Test bot performance under load
  - Test API response times
  - Test database performance

---

### **Phase 9: Deployment & Monitoring** 🚀

#### 🚀 Deployment Setup

- [ ] **Docker configuration**

  - Create Dockerfile
  - Set up docker-compose
  - Configure environment variables

- [ ] **Environment setup**

  - Development environment
  - Staging environment
  - Production environment

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

- [ ] **API documentation**

  - Document all endpoints
  - Include request/response examples
  - Add authentication requirements

- [ ] **Bot command documentation**

  - Document all commands
  - Include usage examples
  - Add permission requirements

- [ ] **Database documentation**
  - Document all models
  - Include relationships
  - Add migration history

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

- [ ] Phase 1: Core Infrastructure & Setup
- [ ] Phase 2: User Management & Registration

### Week 2: Core Features

- [ ] Phase 3: Ajo Group Management
- [ ] Phase 4: Polling & Voting System

### Week 3: Bot Integration

- [ ] Phase 5: Bot Command Handlers
- [ ] Phase 6: Integration & External Services

### Week 4: API & Testing

- [ ] Phase 7: API Endpoints
- [ ] Phase 8: Testing & Quality Assurance

### Week 5: Deployment

- [ ] Phase 9: Deployment & Monitoring
- [ ] Phase 10: Documentation & Maintenance

---

## 🛠️ Technology Stack

### Current Stack

- **Runtime:** Node.js with TypeScript
- **Bot Framework:** Telegraf
- **Database:** PostgreSQL with Prisma
- **HTTP Client:** Axios
- **Environment:** dotenv

### Recommended Additions

- **Testing:** Jest + Supertest
- **Logging:** Winston
- **Validation:** Joi or Zod
- **Encryption:** Node.js crypto module
- **Solana:** @solana/web3.js
- **Monitoring:** Prometheus + Grafana

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
4. **Set up database:** `npm run db:migrate`
5. **Start development server:** `npm run dev`

---

_This document serves as your complete development roadmap. Check off items as you complete them and update the document as needed._
