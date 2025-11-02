# 🧪 Testing Guide - How to Test Without Spending Real SOL

## 🎯 Testing on Devnet (100% FREE!)

### What is Devnet?
Devnet is Solana's test network where:
- ✅ SOL tokens are **FREE**
- ✅ Same functionality as mainnet
- ✅ Safe to experiment
- ✅ No real money at risk

---

## 🚀 Quick Setup for Testing

### Step 1: Configure for Devnet

Update your `.env` file:

```env
BOT_TOKEN=your_telegram_bot_token
DB_URL=your_mongodb_url
RPC_URL=https://api.devnet.solana.com
ENCRYPTION_KEY=your_64_char_hex_key
```

**Important**: Set `RPC_URL` to devnet endpoint!

---

### Step 2: Get Your Bot Wallet Addresses

Start your bot and have users register:

```bash
# User sends to bot:
/start
```

The bot will:
1. Create a wallet for the user
2. Show the wallet address
3. Store encrypted private key in database

**Save these wallet addresses!** You'll need to fund them.

---

### Step 3: Get FREE Devnet SOL

#### Option A: Web Faucet (Easiest)
Visit: https://faucet.solana.com/

1. Select **Devnet** network
2. Paste your bot wallet address
3. Click "Confirm Airdrop"
4. Receive 2 SOL (FREE!)

#### Option B: Solana CLI
```bash
# Install Solana CLI first
solana airdrop 2 <YOUR_WALLET_ADDRESS> --url devnet

# Example:
solana airdrop 2 9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin --url devnet
```

#### Option C: Alternative Faucets
- https://solfaucet.com/ (Select Devnet)
- https://www.quicknode.com/faucet/solana/devnet

---

### Step 4: Verify Balance

Check wallet balance:
```bash
solana balance <WALLET_ADDRESS> --url devnet
```

Or use bot command:
```
/wallet
```

---

## 💰 How Much SOL Do You Need?

### For Testing (Devnet):
- **Create Group**: ~0.01 SOL per group
- **Join Group**: ~0.005 SOL per member  
- **Propose Trade**: ~0.005 SOL per proposal
- **Add/Remove Trader**: ~0.005 SOL each

**Recommended per wallet: 1-2 SOL** (enough for ~100+ operations)

### For Production (Mainnet):
Same amounts, but real SOL costs ~$20-200 each (market price)

---

## 🧪 Testing Workflow

### Test 1: Create Group
```bash
# In Telegram bot chat:
/create_group TestGroup 10 67
```

**What happens:**
- Creates Group PDA on devnet
- Creates MemberProfile for you
- Uses ~0.01 SOL from your wallet

**Verify:**
```bash
# Check transaction on explorer:
https://explorer.solana.com/tx/<SIGNATURE>?cluster=devnet
```

### Test 2: Another User Joins
```bash
# User 2 registers first:
/start

# Then joins your group:
/ajo join <group_id>
```

**What happens:**
- Creates MemberProfile PDA for User 2
- Uses ~0.005 SOL from User 2's wallet

### Test 3: Create Trade Proposal
```bash
/propose_trade "Test Trade" <token_mint> <token_account> 100 buy
```

**What happens:**
- Creates TradeProposal PDA
- Uses ~0.005 SOL

### Test 4: Sync and Verify
```bash
/sync_group
/fetch_proposals
```

**What happens:**
- Fetches on-chain data (FREE - no SOL needed for reads)
- Shows all proposals and state

---

## 🔍 Monitoring Your Tests

### Check Transactions on Explorer
Every successful transaction gives you a signature like:
```
3hZ5yKPE8xR2QfJ...
```

View it on Solana Explorer:
```
https://explorer.solana.com/tx/<SIGNATURE>?cluster=devnet
```

### Check Account PDAs
View your Group PDA:
```
https://explorer.solana.com/address/<GROUP_PDA>?cluster=devnet
```

### Check Wallet Balance
```bash
solana balance <WALLET_ADDRESS> --url devnet
```

---

## ⚠️ Common Testing Issues

### Issue 1: "Insufficient Funds"
**Problem**: Wallet doesn't have enough SOL
**Solution**: Get more from faucet (see Step 3)

### Issue 2: "Transaction Timeout"
**Problem**: Devnet RPC is slow
**Solution**: 
- Retry the operation
- Wait a few seconds
- Use alternative RPC (see below)

### Issue 3: "Account Not Found"
**Problem**: PDA doesn't exist yet
**Solution**: Make sure you created the group first

---

## 🚀 Alternative Devnet RPC Endpoints

If `https://api.devnet.solana.com` is slow:

### Free Options:
```env
# Helius (free tier)
RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_KEY

# QuickNode (free trial)
RPC_URL=https://YOUR_ENDPOINT.devnet.quiknode.pro/YOUR_KEY/

# Alchemy (free tier)
RPC_URL=https://solana-devnet.g.alchemy.com/v2/YOUR_KEY
```

Sign up at:
- Helius: https://helius.dev/
- QuickNode: https://quicknode.com/
- Alchemy: https://alchemy.com/

---

## 📊 Complete Test Scenario

### Setup (5 minutes)
1. ✅ Set RPC_URL to devnet
2. ✅ Start bot: `npm run dev`
3. ✅ Create 3 test Telegram accounts
4. ✅ Each sends `/start` to bot
5. ✅ Note all 3 wallet addresses
6. ✅ Fund each with 2 SOL from faucet

### Test Flow (10 minutes)
1. **User 1** (Admin): `/create_group TradingTest 10 70`
   - ✅ Group created on-chain
   - ✅ Check transaction on explorer

2. **User 2**: `/ajo join <group_id>`
   - ✅ Joined on-chain
   - ✅ Check MemberProfile PDA

3. **User 3**: `/ajo join <group_id>`
   - ✅ Joined on-chain
   - ✅ Now 3 members total

4. **User 1** (Trader): `/propose_trade "Buy SOL" So11111... TokenAcct... 10 buy`
   - ✅ Proposal created on-chain
   - ✅ Check TradeProposal PDA

5. **Anyone**: `/sync_group`
   - ✅ Verify state matches blockchain

6. **Anyone**: `/fetch_proposals`
   - ✅ See all proposals

### Verify Everything
```bash
# Check group on-chain:
https://explorer.solana.com/address/<GROUP_PDA>?cluster=devnet

# Check each member profile:
https://explorer.solana.com/address/<MEMBER_PROFILE_PDA>?cluster=devnet

# Check proposal:
https://explorer.solana.com/address/<PROPOSAL_PDA>?cluster=devnet
```

---

## 🎓 Understanding Costs

### Transaction Fees on Devnet (FREE):
| Operation | SOL Cost | USD Cost |
|-----------|----------|----------|
| Create Group | ~0.01 | $0.00 (FREE) |
| Join Group | ~0.005 | $0.00 (FREE) |
| Propose Trade | ~0.005 | $0.00 (FREE) |
| Add Trader | ~0.005 | $0.00 (FREE) |
| **Total for 10 ops** | ~0.06 SOL | **$0.00 (FREE)** |

### Transaction Fees on Mainnet (REAL MONEY):
| Operation | SOL Cost | USD Cost* |
|-----------|----------|-----------|
| Create Group | ~0.01 | ~$0.20-$2 |
| Join Group | ~0.005 | ~$0.10-$1 |
| Propose Trade | ~0.005 | ~$0.10-$1 |
| Add Trader | ~0.005 | ~$0.10-$1 |
| **Total for 10 ops** | ~0.06 SOL | **~$1.20-$12** |

*Assuming SOL = $20-$200 (market price varies)

---

## ✅ Pre-Production Checklist

Before switching to mainnet:

- [ ] All features tested on devnet
- [ ] No errors in logs
- [ ] PDAs verified on explorer
- [ ] State sync works correctly
- [ ] Multiple users tested
- [ ] All commands work
- [ ] Error handling tested
- [ ] Wallet balances sufficient
- [ ] RPC endpoint reliable
- [ ] Database backups ready

---

## 🔄 Switching to Mainnet

When ready for production:

1. **Update .env:**
   ```env
   RPC_URL=https://api.mainnet-beta.solana.com
   # Or use premium RPC for reliability
   ```

2. **Fund Wallets with REAL SOL:**
   - Buy SOL on exchange (Coinbase, Binance, etc.)
   - Send to bot wallets
   - Minimum 0.1 SOL per wallet recommended

3. **Start Production Bot:**
   ```bash
   npm run build
   npm start
   ```

4. **Monitor Closely:**
   - Watch transaction signatures
   - Check wallet balances
   - Monitor for errors
   - Have backup SOL ready

---

## 💡 Pro Tips

### Tip 1: Use Premium RPC for Production
Free RPCs can be slow/unreliable. For production, use:
- Helius (recommended): ~$50/month
- QuickNode: ~$50/month
- Alchemy: ~$50/month

### Tip 2: Monitor SOL Balances
Set up alerts when wallet SOL drops below 0.05

### Tip 3: Keep Devnet Testing Environment
Don't delete your devnet setup - use it for testing new features!

### Tip 4: Batch Operations
If possible, batch multiple operations to save on fees

### Tip 5: Rent Optimization
Accounts that get closed return rent - factor this in!

---

## 🆘 Getting Help

### Solana Resources:
- Docs: https://docs.solana.com/
- Discord: https://discord.gg/solana
- Stack Overflow: Tag `solana`

### Devnet Faucet Issues:
If faucets aren't working, try:
1. Multiple faucets (listed above)
2. Discord faucet channel
3. Wait and retry (rate limits)

### Testing Issues:
Check logs in console for detailed error messages!

---

## 🎉 Summary

**YES, you need SOL to test, BUT it's completely FREE on devnet!**

### To Start Testing:
1. ✅ Set `RPC_URL=https://api.devnet.solana.com`
2. ✅ Register users with `/start`
3. ✅ Get FREE SOL from faucet
4. ✅ Test all features
5. ✅ Verify on explorer

### Cost:
- **Devnet**: $0.00 (FREE!)
- **Mainnet**: ~$0.10-$1 per operation

**Start with devnet, test everything, then move to mainnet when ready!** 🚀

---

*Happy testing! Your integration is ready to go!* ✅


