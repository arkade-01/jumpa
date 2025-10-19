# 🎮 On-Chain Commands - Quick Reference Guide

## 🚀 Overview
Your bot now interacts with the Solana blockchain for all group operations. Every action creates real on-chain transactions!

---

## 📱 User Commands

### 1️⃣ Create Group (On-Chain)
```bash
/create_group <name> <max_members> [consensus_threshold]
```

**Example:**
```bash
/create_group MyCryptoGroup 10 67
```

**What Happens:**
- ✅ Creates Group PDA on Solana
- ✅ Creates your MemberProfile PDA
- ✅ You become the owner and first trader
- ✅ Stores group in database with on-chain address
- 📋 Returns: Group ID + On-chain address

**Requirements:**
- Must be registered (`/start`)
- Wallet must have SOL for transaction fees (~0.01 SOL)

---

### 2️⃣ Join Group (On-Chain)
```bash
/ajo join <group_id>
```

**Example:**
```bash
/ajo join 507f1f77bcf86cd799439011
```

**What Happens:**
- ✅ Creates your MemberProfile PDA
- ✅ Adds you to group's member list on-chain
- ✅ Updates database
- 📋 Returns: Confirmation + member count

**Requirements:**
- Group must have space available
- Must be registered
- Wallet needs SOL for fees

---

### 3️⃣ Propose Trade (On-Chain) 🔥
```bash
/propose_trade <name> <token_mint> <token_account> <amount> <buy|sell>
```

**Example - Buy SOL:**
```bash
/propose_trade "Buy SOL" So11111111111111111111111111111111111111112 YourTokenAccountAddress 10 buy
```

**Example - Sell SOL:**
```bash
/propose_trade "Sell SOL" EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v YourTokenAccountAddress 500 sell
```

**What Happens:**
- ✅ Creates TradeProposal PDA on-chain
- ✅ Stores proposal details
- ✅ Notifies all group members
- 📋 Returns: Proposal PDA + Transaction signature

**Requirements:**
- Must be a TRADER (not just a member)
- Valid token mint and account addresses
- Positive amount

---

### 4️⃣ Sync Group State
```bash
/sync_group
```

**What Happens:**
- ✅ Fetches latest on-chain group data
- ✅ Compares with database
- ✅ Shows comprehensive state info
- 📋 Returns: Both database and on-chain state

**Shows:**
- Member count (database vs on-chain)
- Trader list
- Group state (Initialized, Trading, Voting, Ended)
- Vote threshold
- Lock status
- Entry capital

---

### 5️⃣ Fetch Proposals
```bash
/fetch_proposals
```

**What Happens:**
- ✅ Queries all TradeProposal accounts for your group
- ✅ Shows current status of each
- 📋 Returns: List of all proposals with details

**Shows Per Proposal:**
- Proposer name
- Buy or Sell action
- Token amount
- Vote count
- Execution status
- Created date
- Deadline

---

## 👑 Admin/Owner Only Commands

### 6️⃣ Add Trader (Promote Member)
This is done via the existing promote function but now integrates on-chain!

**Function:** `addTraderOnChain(group_id, trader_telegram_id, admin_telegram_id)`

**What Happens:**
- ✅ Adds trader to on-chain trader list
- ✅ Updates database
- 📋 Returns: Transaction signature

**Requirements:**
- Must be group owner
- User must be a member first

---

### 7️⃣ Remove Trader (Demote Trader)
**Function:** `removeTraderOnChain(group_id, trader_telegram_id, admin_telegram_id)`

**What Happens:**
- ✅ Removes trader from on-chain list
- ✅ Updates database
- 📋 Returns: Transaction signature

**Requirements:**
- Must be group owner
- Cannot remove yourself

---

## 🔍 Understanding PDAs (Program Derived Addresses)

### What are PDAs?
PDAs are deterministic addresses derived from seeds. They're unique and predictable!

### Group PDA
```
Seeds: "GROUP_SEED" + GroupName + OwnerPublicKey
Example: GROUP_SEED + "MyCrew" + OwnerAddr...
```

### MemberProfile PDA
```
Seeds: "MEMBER_SEED" + GroupPDA + MemberPublicKey
Example: MEMBER_SEED + GroupAddr... + MemberAddr...
```

### TradeProposal PDA
```
Seeds: "PROPOSAL_SEED" + ProposerPDA + GroupPDA + Nonce
Example: PROPOSAL_SEED + ProposerAddr... + GroupAddr... + 12345
```

---

## 💰 Transaction Fees

### Typical Costs (Solana Mainnet)
- Create Group: ~0.01-0.02 SOL
- Join Group: ~0.005-0.01 SOL
- Create Proposal: ~0.005-0.01 SOL
- Add/Remove Trader: ~0.005 SOL
- Fetch Data: FREE (read-only)

### Fee Optimization
- Fees depend on account size
- Rent is returned when accounts close
- Batching operations saves fees

---

## 🎯 Workflow Example

### Complete Group Trading Flow

#### 1. Owner Creates Group
```bash
/create_group TradingMasters 20 70
```
📤 **Result:** Group PDA created, Owner is first trader

#### 2. Members Join
```bash
# Member 1
/ajo join <group_id>

# Member 2  
/ajo join <group_id>

# Member 3
/ajo join <group_id>
```
📤 **Result:** Each gets MemberProfile PDA

#### 3. Trader Creates Proposal
```bash
/propose_trade "Buy 100 BONK" <bonk_mint> <token_account> 100 buy
```
📤 **Result:** TradeProposal PDA created

#### 4. Check Proposal Status
```bash
/fetch_proposals
```
📤 **Result:** See all proposals and vote counts

#### 5. Sync to Verify
```bash
/sync_group
```
📤 **Result:** Verify on-chain state matches expectations

---

## 🐛 Troubleshooting

### "Insufficient funds" Error
**Problem:** Wallet doesn't have enough SOL for transaction fees
**Solution:** Send 0.1 SOL to your bot wallet address

### "User not found" Error
**Problem:** User hasn't registered with bot
**Solution:** Run `/start` command first

### "Only traders can create proposals"
**Problem:** User is a member but not a trader
**Solution:** Owner must promote you first

### "Group has no on-chain address"
**Problem:** Group was created before integration
**Solution:** Create a new group or manually migrate

### Transaction Timeout
**Problem:** RPC endpoint is slow or overloaded
**Solution:** 
- Wait and retry
- Check RPC_URL in config
- Use a premium RPC endpoint

---

## 🔐 Security Notes

### Private Key Management
- ✅ Keys are encrypted in database
- ✅ Decrypted only for signing
- ✅ Never exposed to users
- ✅ Use ENCRYPTION_KEY environment variable

### Best Practices
1. Keep bot token secure
2. Use dedicated bot wallets (not personal)
3. Start with Devnet for testing
4. Limit initial capital until tested
5. Monitor transaction logs

---

## 📊 State Management

### Group States (On-Chain)
```
Initialized → Trading → Voting → Ended
```

- **Initialized:** Just created, accepting members
- **Trading:** Active trading period
- **Voting:** Vote on proposals
- **Ended:** Group concluded, distribute profits

### Proposal States
```
Created → Open → Executed/Cancelled
```

---

## 🎓 Advanced Usage

### Check On-Chain Account Directly
Use Solana Explorer:
```
https://explorer.solana.com/address/<PDA>?cluster=devnet
```

### Monitor Transactions
```
https://explorer.solana.com/tx/<signature>?cluster=devnet
```

### Fetch Account via CLI
```bash
solana account <PDA> --url devnet
```

---

## 📞 Support

### Common Questions

**Q: Can I delete a group?**
A: Once on-chain, accounts can be closed but the history remains in the blockchain.

**Q: How do I become a trader?**
A: Group owner must promote you using the addTrader function.

**Q: Can proposals be cancelled?**
A: Yes, but the on-chain account remains (just marked as cancelled).

**Q: What happens if I leave a group?**
A: Your MemberProfile PDA is closed and rent is returned.

---

## 🎉 Summary

Your bot is now a **full-featured on-chain trading platform**!

✅ Every action is recorded on Solana blockchain
✅ Transparent and verifiable
✅ Decentralized group management
✅ Real-time state synchronization

**Ready to trade? Start with `/create_group`!** 🚀

---

*For technical details, see INTEGRATION_SUMMARY.md*


