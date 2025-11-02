import { Context } from "telegraf";
import { BaseCommand } from "@bot/commands/BaseCommand";
import { checkWalletBalance } from "@blockchain/solana/solanaService";
import getUser from "@modules/users/getUserInfo";
import { decryptPrivateKey } from "@shared/utils/encryption";
import { Keypair } from "@solana/web3.js";

export class FundWalletCommand extends BaseCommand {
  name = "fund_wallet";
  description = "Get instructions to fund your wallet with SOL";

  async execute(ctx: Context): Promise<void> {
    try {
      const userId = ctx.from?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!userId) {
        await ctx.reply("❌ Unable to identify user.");
        return;
      }

      // Check if user is registered
      try {
        await getUser(userId, username);
      } catch (error) {
        await ctx.reply("❌ Please register first using /start");
        return;
      }

      // Get user's wallet
      const user = await getUser(userId, username);
      if (!user.solanaWallets[0].encryptedPrivateKey) {
        await ctx.reply("❌ No wallet found. Please register again.");
        return;
      }

      // Decrypt private key and create keypair
      const privateKeyHex = decryptPrivateKey(user.solanaWallets[0].encryptedPrivateKey);
      const keypair = Keypair.fromSecretKey(Buffer.from(privateKeyHex, 'hex'));
      const walletAddress = keypair.publicKey;

      // Check current balance
      const balanceCheck = await checkWalletBalance(walletAddress, 5000000);
      const balanceInSol = (balanceCheck.balance / 1000000000).toFixed(4);
      const minBalanceInSol = (balanceCheck.minBalance / 1000000000).toFixed(4);

      const message = `
💰 **Wallet Funding Instructions**

**Your Wallet Address:**
\`${walletAddress.toBase58()}\`

**Current Balance:** ${balanceInSol} SOL
**Minimum Required:** ${minBalanceInSol} SOL
**Status:** ${balanceCheck.hasBalance ? '✅ Sufficient' : '❌ Insufficient'}

${!balanceCheck.hasBalance ? `
⚠️ **You need to fund your wallet to use the bot!**

**How to Fund Your Wallet:**

**Option 1: Solana Faucet (Devnet Only)**
If you're on devnet, use the Solana faucet:
1. Visit: https://faucet.solana.com/
2. Paste your wallet address
3. Click "Request Airdrop"
4. Wait a few seconds

**Option 2: Transfer from Another Wallet**
If you're on mainnet:
1. Open your Phantom/Solflare wallet
2. Send at least 0.01 SOL to the address above
3. Wait for confirmation

**Option 3: Buy SOL**
1. Use an exchange (Coinbase, Binance, etc.)
2. Buy SOL
3. Withdraw to the address above

**After Funding:**
• Use \`/wallet\` to check your balance
• Use \`/fund_wallet\` to verify funding
` : `
✅ **Your wallet is funded and ready to use!**

You can now:
• Create groups with \`/create_group\`
• Join groups with \`/join\`
• Propose trades with \`/propose_trade\`
`}

**Need Help?**
• Check balance: \`/wallet\`
• View wallet details: \`/wallet\` → Wallet Details
      `;

      await ctx.reply(message, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Fund wallet command error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await ctx.reply(`❌ Failed to get wallet info: ${errorMessage}`);
    }
  }
}

