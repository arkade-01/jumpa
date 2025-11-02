import { Context } from "telegraf";
import { BaseCommand } from "@bot/commands/BaseCommand";
import { checkGroupExists, deriveGroupPDA, fetchGroupAccount } from "@blockchain/solana/solanaService";
import getUser from "@modules/users/getUserInfo";
import { decryptPrivateKey } from "@shared/utils/encryption";
import { Keypair } from "@solana/web3.js";

export class RecoverGroupCommand extends BaseCommand {
  name = "recover_group";
  description = "Recover an existing on-chain group and sync it with the database";

  async execute(ctx: Context): Promise<void> {
    const args =
      ctx.message && "text" in ctx.message
        ? ctx.message.text.split(" ").slice(1)
        : [];

    try {
      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!userId || !chatId) {
        await ctx.reply("❌ Unable to identify user or chat.");
        return;
      }

      if (args.length < 3) {
        await ctx.reply(
          "❌ Usage: `/recover_group <group_name> <max_members> <entry_capital> [consensus_threshold]`\n\n" +
            "**Example:** `/recover_group arkshitters 5 100 50`\n\n" +
            "**Note:** This command will recover an existing on-chain group and create a database record for it.",
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Parse arguments
      const groupName = args[0];
      const maxMembers = parseInt(args[1]);
      const entryCapital = parseInt(args[2]);
      const consensusThreshold = args[3] ? parseInt(args[3]) : 67;

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
      const signer = keypair.publicKey;

      // Check if group exists on-chain
      const exists = await checkGroupExists(groupName, signer);
      if (!exists) {
        await ctx.reply(
          `❌ Group "${groupName}" does not exist on-chain.\n\n` +
          `You can create it with:\n` +
          `\`/create_group ${groupName} ${maxMembers} ${entryCapital} ${consensusThreshold}\``
        );
        return;
      }

      // Check if group already exists in database
      const AjoGroup = (await import("@database/models/ajoGroup")).default;
      const existingDbGroup = await AjoGroup.findOne({
        telegram_chat_id: chatId,
      });

      if (existingDbGroup) {
        await ctx.reply(
          "❌ This chat already has a group in the database.\n\n" +
          "Use `/sync_group` to sync with the existing database record."
        );
        return;
      }

      // Fetch on-chain group data
      const [groupPDA] = deriveGroupPDA(groupName, signer);
      const groupData = await fetchGroupAccount(groupPDA.toBase58());

      // Create the database record
      const ajoGroup = await AjoGroup.create({
        name: groupName,
        creator_id: userId,
        telegram_chat_id: chatId,
        initial_capital: entryCapital,
        max_members: maxMembers,
        consensus_threshold: consensusThreshold,
        status: "active",
        members: [
          {
            user_id: userId,
            role: "trader", // Creator is automatically a trader
            contribution: 0, // Will be updated when they contribute
            joined_at: new Date(),
          },
        ],
        polls: [],
        trades: [],
        current_balance: 0,
        // Store on-chain addresses
        onchain_group_address: groupPDA.toBase58(),
        onchain_tx_signature: "recovered", // Mark as recovered
      });

      const successMessage = `
✅ **Group Successfully Recovered!**

🏠 **Name:** ${ajoGroup.name}
👥 **Max Members:** ${ajoGroup.max_members}
💰 **Entry Capital:** ${ajoGroup.initial_capital} SOL
🗳️ **Consensus:** ${ajoGroup.consensus_threshold}%
📊 **Status:** Active

**On-Chain Address:** \`${groupPDA.toBase58()}\`
**Database ID:** \`${ajoGroup._id}\`

**Group Data from Blockchain:**
• Owner: ${groupData.owner}
• Vote Threshold: ${groupData.voteThreshold}%
• Locked: ${groupData.locked ? 'Yes' : 'No'}
• Created: ${groupData.createdAt.toLocaleString()}

**Next Steps:**
1. Share the Group ID with people you want to invite
2. They can join using: \`/join ${ajoGroup._id}\`
3. Start creating polls with: \`/poll trade <token> <amount>\`

**You are now a trader and can create polls!**
      `;

      await ctx.reply(successMessage, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Recover group error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await ctx.reply(`❌ Failed to recover group: ${errorMessage}`);
    }
  }
}
