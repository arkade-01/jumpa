# Jumpa Bot - Architecture Summary

## Project Overview
**Jumpa** is a Telegram-based collaborative cryptocurrency trading bot that enables users to create groups for collective trading on Solana and EVM blockchains. It integrates wallet management, smart contracts, and fiat on/off-ramps.

**Tech Stack**: Node.js + TypeScript, Telegraf (Telegram Bot), MongoDB, Solana/Anchor, ethers.js

---

## 1. USER MANAGEMENT & STORAGE

### Database Schema (MongoDB + Mongoose)
**Location**: `/src/database/models/user.ts`

**User Model Structure**:
```
User Document
├── telegram_id (Number, unique, indexed)
├── username (String, indexed)
├── solanaWallets (Array)
│   ├── address (String, indexed)
│   ├── encryptedPrivateKey (String)
│   ├── balance (Number) - cached SOL balance
│   ├── last_updated_balance (Date)
│   ├── usdcBalance (Number)
│   ├── usdtBalance (Number)
│   └── last_updated_token_balance (Date)
├── evmWallets (Array)
│   ├── address (String, indexed)
│   ├── encryptedPrivateKey (String)
│   ├── balance (Number)
│   └── last_updated_balance (Date)
├── referrals
│   ├── referredBy (Number, nullable)
│   ├── totalReferrals (Number)
│   └── myReferrals (Array of telegram_ids)
├── bank_details
│   ├── account_number
│   ├── account_name
│   ├── bank_name
│   ├── bank_code
│   └── withdrawalPin (Number)
├── is_active (Boolean)
├── role (Enum: "user" | "admin")
├── created_at, updated_at, last_seen (Dates)
└── timestamps (automatic)
```

### Key Features:
- **Multi-chain wallets**: Supports both Solana and EVM (Celo, Base, Optimism, Polygon, Arbitrum)
- **Encrypted storage**: Private keys are encrypted using AES encryption
- **Balance caching**: SOL balance cached with 5-minute TTL, token balances cached separately
- **Referral tracking**: Built-in referral system with referred-by relationship and referral counts
- **Bank integration**: Stores Nigerian bank details for fiat withdrawals with PIN protection
- **Role-based access**: User vs Admin roles

### User Registration Flow
1. User sends `/start` command
2. System checks if telegram_id exists in database
3. If not, creates new user document with generated wallet
4. User can add multiple wallets (Solana/EVM)
5. Private keys encrypted and stored

---

## 2. TRADING & TRANSACTION TRACKING

### Transaction Architecture

**Order State Management** (`/src/shared/state/orderState.ts`):
```
OrderState (In-memory Map<userId, OrderState>)
├── transactionBase64: string (serialized transaction)
└── requestId: string (unique request identifier)
```

**Trade State Management** (`/src/shared/state/tradeState.ts`):
```
TradeState (In-memory Map<tradeId, TradeStateData>)
├── contractAddress: string
├── symbol: string
├── decimals: number
└── [15-minute TTL for cleanup]
```

### Buy Trading Flow
1. **Token Detection** (`DetectTokenAddress.ts`)
   - User sends Solana token address
   - System fetches token info from on-chain metadata
   - Creates trade session with token details
   - Stores in TradeState (15-min expiry)

2. **Quote Fetching** (`getOrder.ts`)
   - Calls Jupiter API for price quotes
   - Calculates input amount, output amount, price impact
   - Returns transaction base64 and request ID
   - Fee calculation: ~9k lamports per transaction

3. **Buy Order Creation** (`createBuyOrder.ts`)
   - User selects amount to spend
   - System fetches Jupiter quote
   - Displays order details:
     - Token address and symbol
     - Amount in SOL
     - Expected token output
     - Price impact percentage
     - Transaction fee in SOL
   - User approves or declines
   - Stores OrderState with serialized transaction

4. **Order Execution** (`executeOrder.ts`)
   - Deserializes transaction
   - User signs transaction with their private key
   - Transaction broadcast to Solana network
   - Confirmation awaited

### Sell Trading Flow
Similar to buy but in reverse:
- User selects token from wallet
- System fetches sell quote from Jupiter
- User confirms sale
- Token transferred out, SOL transferred in

### Transaction Tracking
- **Blockchain**: Solana explorer tracks all on-chain transactions
- **Database**: Withdrawal records stored in `Withdrawal` model for fiat off-ramp tracking
- **State Management**: Temporary order/trade state in memory (cleared after execution)

---

## 3. PAYMENT & REWARD SYSTEMS

### Payment Gateway Integration
**Supported Fiat**: Nigerian NGN (Naira)
**Gateway**: Yara Payment (API key configured)

### Withdrawal System

#### Solana Withdrawals (`WithdrawToNgn.ts`)

**SOL Withdrawal**:
1. User initiates withdrawal via bot
2. System validates:
   - User exists and has Solana wallet
   - Private key accessible
   - Sufficient SOL balance (amount + ~5k lamports fee)
3. Creates SystemProgram.transfer transaction
4. Signs with user's private key
5. Broadcasts to Solana mainnet
6. Waits for confirmation
7. Returns transaction signature and Solscan URL

**USDC/USDT Withdrawal** (SPL Tokens on Solana):
1. Validates token account exists
2. Gets mint information (decimals)
3. Creates SPL token transfer instruction
4. Handles recipient token account creation if needed
5. Bundles transaction and broadcasts
6. Verifies SOL for transaction fees separately

#### EVM Withdrawals (`EvmWithdrawal.ts`)

**Supported Chains & Tokens**:
- **Celo**: USDC, USDT
- **Base**: USDC, USDT
- **Optimism**, **Polygon**, **Arbitrum**: Support framework in place

**ETH Withdrawal**:
1. User connects EVM wallet
2. System gets wallet from ethers.js Wallet class
3. Estimates gas costs
4. Verifies ETH balance >= amount + gas
5. Creates and signs transaction
6. Broadcasts to selected chain RPC
7. Waits for confirmation

**ERC-20 Token Withdrawal** (USDC/USDT):
1. Creates contract instance with ERC20 ABI
2. Checks token balance
3. Estimates gas for token transfer
4. Verifies sufficient ETH for gas
5. Executes transfer() with gas limit and price
6. Waits for receipt

### Withdrawal State Management
**Location**: `/src/shared/state/withdrawalState.ts`
```
WithdrawalState (In-memory Map<userId, WithdrawalState>)
├── step: 'awaiting_pin' | 'awaiting_custom_amount'
└── data
    ├── amount: string
    ├── currency: 'SOL' | 'USDC' | 'USDT' | 'ETH'
    └── chain: 'SOLANA' | 'EVM'
```

### Withdrawal Process
1. **Bank Account Setup**
   - User provides Nigerian bank account
   - Stores: account number, account name, bank name, bank code
   - Sets withdrawal PIN (stored hashed)

2. **Withdrawal Request**
   - User selects currency (SOL/USDC/USDT/ETH)
   - Selects amount or enters custom amount
   - System initiates on-chain transfer (immediate)
   - Yara API called to convert crypto -> NGN fiat
   - Fiat transferred to user's bank account

3. **Withdrawal Tracking**
   - All withdrawals logged in `Withdrawal` model:
     - telegram_id
     - transaction_id (unique)
     - fiatPayoutAmount
     - depositAmount
     - yaraSolAddress
     - timestamps

### Referral & Rewards (Potential)
- Referral system implemented in User model
- referredBy: tracks who referred the user
- myReferrals: array of users you referred
- totalReferrals: count of referred users
- **Reward calculation**: Not explicitly implemented in current codebase
- **Potential**: Could distribute profits to referrers from group trading gains

---

## 4. BOT COMMAND STRUCTURE & USER INTERACTION FLOW

### Command Architecture
**Location**: `/src/bot/commands/`

**Base Command Class** (`BaseCommand.ts`):
```typescript
abstract class BaseCommand {
  abstract name: string;
  abstract description: string;
  abstract execute(ctx: Context): Promise<void>
}
```

**Command Manager** (`CommandManager.ts`):
- Registers all commands dynamically
- Routes commands to handlers
- Manages callback query handlers
- Updates bot command menu

### Registered Commands (17 total)
1. `start` - User registration & main menu
2. `help` - Help documentation
3. `wallet` - Wallet info & management
4. `ajo` - Group overview/navigation
5. `create_group` - Create collaborative trading group
6. `group` - Group details
7. `ajo_info` - Group info
8. `ajo_members` - Group member list
9. `ajo_polls` - Group voting polls
10. `group_balance` - Group financial summary
11. `check_group` - Verify group on-chain
12. `recover_group` - Recover out-of-sync group
13. `fund_wallet` - Deposit instructions
14. `promote_trader` - Grant trading privileges
15. `leave_group` - Exit group
16. `demote_trader` - Remove trading privileges
17. `join` - Join existing group

### Callback Handler System
**Inline Buttons** (107+ callback routes):

**Onboarding Callbacks**:
- `view_wallet`, `view_profile` - Profile/wallet display
- `create_group`, `join` - Group actions
- `generate_wallet`, `import_wallet` - Wallet setup
- `add_wallet`, `add_wallet_solana`, `add_wallet_evm` - Multi-wallet
- `set_default_solana:`, `set_default_evm:` - Default wallet selection

**Trading Callbacks**:
- `/^buy:.+/` - Buy token with amount
- `approve_buy:`, `decline_buy` - Buy confirmation
- `buy_custom:` - Custom amount buying
- `/^sell:.+/` - Sell token
- `approve_sell:`, `decline_sell` - Sell confirmation
- `/^refresh:.+/` - Refresh order data

**Wallet Callbacks**:
- `deposit_sol`, `withdraw_sol`, `withdraw_to_bank` - Withdrawal flow
- `refresh_balance` - Update cached balance
- `withdraw_currency:`, `withdraw_custom_amount:` - Withdrawal steps
- `export_private_key`, `proceed_export`, `cancel_export` - Key export

**Group Callbacks**:
- `group_info`, `group_members`, `group_balance` - Group data
- `group_deposit`, `deposit_custom` - Add funds to group
- `group_close`, `group_exit` - Group lifecycle
- `group_distribute` - Profit distribution
- `/^deposit_amount_(.+)$/` - Dynamic amount selection
- `/^distribute_select_member_(.+)$/` - Member selection

**Text Message Handlers**:
- Awaiting custom amount input
- Awaiting private key import
- Awaiting wallet import
- Awaiting bank details
- Awaiting withdrawal PIN
- Detecting Solana token addresses

### User Interaction Flow (Example: Buy Token)

```
User sends token address
    ↓
Text handler detects Solana address pattern
    ↓
System fetches token metadata from on-chain
    ↓
Creates TradeState with token details (15-min TTL)
    ↓
Bot displays: Symbol, current price, balance check
    ↓
User clicks "Buy [amount]" button
    ↓
handleBuy callback triggered with buy:[tradeId]:[amount]
    ↓
createBuyOrder() fetches Jupiter quote
    ↓
OrderState stored with transaction base64
    ↓
Bot displays order details with "Approve"/"Decline" buttons
    ↓
User clicks "Approve"
    ↓
BuyCallbackHandlers.handleApprove() executes
    ↓
deserializeTransaction() + sign with user's private key
    ↓
Transaction broadcast to Solana
    ↓
Confirmation awaited
    ↓
Bot sends confirmation with Solscan link
```

### Multi-Step Flow State Management
**Location**: `/src/shared/state/`
- `userActionState.ts` - Current user action (import, export, add wallet, etc.)
- `bankState.ts` - Bank detail update flow
- `withdrawalState.ts` - Withdrawal process step
- `orderState.ts` - Pending buy/sell order
- `tradeState.ts` - Active token trade session

---

## 5. WALLET & BALANCE MANAGEMENT

### Wallet Service Architecture

**Balance Service** (`balanceService.ts`)
Functions for group financial management:
- `updateGroupBalance()` - Calculate total from member contributions
- `calculateProfitShares()` - Determine each member's percentage
- `calculateProfitDistribution()` - Calculate profit payouts
- `getMemberShareInfo()` - Get member rank and percentage
- `trackMemberContribution()` - Record member deposits
- `getGroupFinancialSummary()` - Complete financial overview
- `calculateGroupPerformance()` - ROI, trade volume metrics

**Balance Retrieval** (`getBalance.ts`)
```typescript
async getBalance(walletAddress, forceRefresh = false): Promise<number>
```
- Checks database for cached balance
- If cache valid (< 5 min) and not force-refresh, return cached
- Otherwise fetch from Solana RPC (getBalance RPC call)
- Updates database cache with new balance
- Falls back to cached value on error

**Token Balances** (`getTokenBalances.ts`)
- Fetches USDC/USDT balances for Solana wallet
- Uses getParsedTokenAccountsByOwner RPC method
- Extracts token amount from parsed account data
- Returns formatted amounts

### Wallet Command (`WalletCommand.ts`)

**Displays**:
```
Address: <wallet_address>
SOL: X.XXXX
USDC: X.X
USDT: X.X
Last Updated: <timestamp>
```

**Actions**:
- Refresh Balance (force cache update)
- Show Private Key (with PIN verification)
- Wallet Details
- Close menu

### Individual Wallet Storage
Each user document stores arrays of wallets:

**Solana Wallets**:
```
solanaWallets: [
  {
    address,
    encryptedPrivateKey,
    balance,
    last_updated_balance,
    usdcBalance,
    usdtBalance,
    last_updated_token_balance
  }
]
```

**EVM Wallets**:
```
evmWallets: [
  {
    address,
    encryptedPrivateKey,
    balance,
    last_updated_balance
  }
]
```

### Wallet Creation
- **Solana**: Uses `@solana/web3.js` Keypair.generate()
- **EVM**: Uses `ethers.js` Wallet.createRandom()
- Private key immediately encrypted with AES-256
- Stored hex-encoded in database
- Original key never stored unencrypted

### Encryption/Decryption
**Location**: `/src/shared/utils/encryption.ts`
- Uses `ENCRYPTION_KEY` from environment (256-bit hex)
- AES-256 encryption with crypto module
- Keys returned as hex strings for storage
- Decryption on-demand when needed for transactions

---

## 6. AJO GROUP (COLLABORATIVE TRADING) SYSTEM

### Group Database Model
**Location**: `/src/database/models/ajoGroup.ts`

```
AjoGroup Document
├── name (String)
├── creator_id (Number - telegram_id)
├── telegram_chat_id (Number, unique)
├── is_private (Boolean)
├── max_members (Number, 2-100)
├── status (Enum: "active" | "ended")
├── members (Array)
│   ├── user_id (Number)
│   ├── role (Enum: "member" | "trader")
│   ├── contribution (Number - SOL amount)
│   └── joined_at (Date)
├── polls (Array)
│   ├── id, creator_id, type (trade|end_ajo)
│   ├── title, token_address, token_symbol, amount
│   ├── status (open|executed|cancelled)
│   ├── votes (Array of {user_id, vote: bool, voted_at})
│   ├── created_at, expires_at
├── trades (Array)
│   ├── poll_id, token_symbol, amount
│   ├── price_per_token
│   └── executed_at
├── current_balance (Number)
├── onchain_group_address (String)
├── onchain_tx_signature (String)
└── created_at (Date)
```

**Indexes**: creator_id, telegram_chat_id, status, members.user_id

### Group Lifecycle

1. **Creation**
   - Creator initiates `/create_group`
   - Validates: max members 2-100, unique chat ID
   - **On-Chain**: Calls `createGroupOnChain()` via Anchor program
     - Creates group PDA (Program Derived Account)
     - Stores group name, admin, privacy settings
     - Returns transaction signature
   - **Off-Chain**: Stores in MongoDB with on-chain references
   - Creator automatically becomes first member

2. **Membership**
   - Members join via `/join` with group ID
   - Member added to `members` array with "member" role
   - Contribution initially 0
   - Can be promoted to "trader" role (can execute trades)

3. **Deposits**
   - Members deposit SOL into group pool
   - System transfers SOL to group wallet (on-chain)
   - Updates member.contribution in database
   - Recalculates group.current_balance

4. **Trading** (Governance-based)
   - Trader creates poll for proposed trade
   - Poll type: "trade" with token address and amount
   - Voting period (expires_at) - members vote
   - If approved (>50% votes), trade executed:
     - Calls `executeTrade()` on-chain via Anchor
     - Swaps group's SOL for target token via Jupiter CPI
     - Records trade in trades array
   - Profit tracking via current_balance

5. **Profit Distribution**
   - Admin/designated member initiates distribution
   - System calculates profit shares based on contributions:
     - Formula: (member_contribution / total_balance) * profit
   - Distributes SOL to member wallets
   - Updates group balance

6. **Closure**
   - Group marked status: "ended"
   - Final distribution to members
   - On-chain group marked inactive

### Group Service (`groupService.ts`)
Key functions:
- `createGroup()` - Create on-chain + database
- `joinGroup()` - Add member
- `exitGroup()` - Remove member
- `addTrader()` - Promote to trader
- `removeTrader()` - Demote trader
- Recovery/sync functions for out-of-sync groups

### Governance/Polling System
- Poll-based decision making for trades
- Voting mechanism with expiry
- Democratic group control
- Trade execution gated on poll approval

---

## 7. BLOCKCHAIN INTEGRATION

### Solana Integration
**Framework**: Anchor (Solana smart contract framework)
**RPC Endpoints**: Mainnet-beta and Devnet configured

**Key Functions** (`/src/blockchain/solana/`):

- **`createGroup.ts`**: Creates on-chain group PDA
- **`joinGroup.ts`**: Adds member to group on-chain
- **`exitGroup.ts`**: Removes member and refunds
- **`executeTrade.ts`**: Swaps tokens via Jupiter CPI
- **`deposit.ts`**: Transfers SOL to group account
- **`distributeProfit.ts`**: Sends profits to members
- **`fetchData.ts`**: Reads group state from chain
- **`closeGroup.ts`**: Ends group and distributes funds
- **`manageTraders.ts`**: Add/remove traders
- **`manageBlacklist.ts`**: Block/unblock members

### Jupiter Integration (DEX Aggregation)
- Used for token swaps
- Fetches best price routes across liquidity pools
- CPI (Cross-Program Invocation) integration for trades
- 2% slippage default setting

### EVM Chain Support
**Chains**: Celo, Base, Optimism, Polygon, Arbitrum
**Framework**: ethers.js v6
**Functions**: Withdraw ETH/USDC/USDT to fiat

---

## 8. DATA MODELS SUMMARY

### Three Main Collections:

**1. User**
- Core user identity & authentication
- Multi-wallet storage (Solana + EVM)
- Referral tracking
- Bank account info for fiat
- Cached balance data

**2. AjoGroup**
- Collaborative trading group data
- Members with roles and contributions
- Democratic polling system
- Trade history
- On-chain references

**3. Withdrawal**
- Audit trail for fiat conversions
- Tracks: user, transaction ID, amounts, wallet address
- Links crypto withdrawals to fiat payouts

---

## 9. STATE MANAGEMENT PATTERNS

### In-Memory State (Maps)
- **userActionState**: Current user's multi-step action
- **bankState**: Bank update flow
- **withdrawalState**: Withdrawal process step
- **orderState**: Pending buy/sell order
- **tradeState**: Active token trade session (15-min TTL)

### Database State
- User balance cache (5-min TTL)
- Group balance and member contributions
- Trade history and polls
- Bank account details
- Referral relationships

### Blockchain State
- Group accounts and permissions
- Member deposits and balances
- Trade execution records
- Token ownership and transfers

---

## 10. SECURITY FEATURES

1. **Private Key Encryption**
   - AES-256 encryption on all stored private keys
   - Encryption key from environment variable
   - Keys never logged or exposed

2. **PIN Protection**
   - Withdrawal PIN stored in user model
   - Required for exporting private keys
   - Required for fiat withdrawals

3. **Access Control**
   - Role-based: user vs admin
   - Trading privileges: member vs trader role
   - Group-level permissions on-chain

4. **Transaction Verification**
   - Signature confirmation before broadcast
   - Balance verification before execution
   - Gas/fee estimation and checking
   - Recipient address validation

5. **Rate Limiting**
   - Middleware logging response times
   - Command execution error handling
   - Callback query validation

---

## 11. KEY ENTRY POINTS

### Bot Initialization
`/src/index.ts`:
```
1. Connect to MongoDB
2. Create Telegraf bot instance
3. Initialize CommandManager
4. Register all commands and callbacks
5. Error handling and graceful shutdown
6. bot.launch()
```

### User Registration
`StartCommand.ts`:
```
1. Check if user exists
2. If not, create new User document
3. Generate Solana wallet
4. Encrypt private key
5. Display wallet address and menu
```

### Trading Flow
`BuyCommand.ts` -> `createBuyOrder.ts`:
```
1. Detect token address from text
2. Create TradeState
3. Fetch Jupiter quote
4. Create OrderState
5. Wait for user approval
6. Execute transaction
```

### Group Trading
`CreateGroupCommand.ts` -> `groupService.createGroup()`:
```
1. Validate creator and parameters
2. Call createGroupOnChain() - Anchor program
3. Save to MongoDB
4. Display group details
```

---

## SUMMARY TABLE

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Bot Framework | Telegraf 4.16 | Telegram bot interface |
| Database | MongoDB + Mongoose 8.19 | User, group, withdrawal data |
| Solana | @solana/web3.js + Anchor | On-chain group management |
| EVM | ethers.js 6.15 | Multi-chain wallet support |
| DEX | Jupiter API | Token swaps |
| Encryption | Node.js crypto | Private key security |
| State | In-memory Maps | Multi-step user flows |
| Deployment | Node.js + TypeScript | Runtime environment |

---

## FLOW DIAGRAMS

### User Registration Flow
```
/start
  ↓
Is user in DB?
  ↓ No
Create User document
  ↓
Generate Solana Keypair
  ↓
Encrypt private key
  ↓
Save to DB
  ↓
Display wallet address & menu
```

### Trading Flow (Individual)
```
Token address detected (text message)
  ↓
Create TradeState (15-min TTL)
  ↓
Show token info & balance
  ↓
User clicks "Buy X SOL"
  ↓
Fetch Jupiter quote
  ↓
Create OrderState
  ↓
Show order details
  ↓
User approves
  ↓
Sign transaction
  ↓
Broadcast to Solana
  ↓
Confirmation
  ↓
Update balances
```

### Group Trading Flow
```
Create Group (on-chain + DB)
  ↓
Members join & deposit SOL
  ↓
Trader proposes trade poll
  ↓
Members vote
  ↓
If approved: Execute trade (on-chain via Anchor)
  ↓
Update group balance & profits
  ↓
Admin distributes profits
  ↓
Members receive SOL
```

### Withdrawal Flow
```
User initiates withdrawal
  ↓
Select currency & amount
  ↓
Validate balance & fees
  ↓
Create blockchain transaction
  ↓
Request PIN verification
  ↓
Sign & broadcast
  ↓
Confirm on-chain
  ↓
Log in Withdrawal model
  ↓
Call Yara API for fiat conversion
  ↓
Fiat transferred to bank account
```

