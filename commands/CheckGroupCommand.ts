import { Context } from "telegraf";
import { BaseCommand } from "./BaseCommand";
import { checkGroupExists, deriveGroupPDA, fetchGroupAccount } from "../services/solanaService";
import { PublicKey } from "@solana/web3.js";
import getUser from "../services/getUserInfo";

export class CheckGroupCommand extends BaseCommand {
  name = "check_group";
  description = "Check if a group exists on-chain";

  async execute(ctx: Context): Promise<void> {
    const args =
      ctx.message && "text" in ctx.message
        ? ctx.message.text.split(" ").slice(1)
        : [];

    try {
      const userId = ctx.from?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!userId) {
        await ctx.reply("❌ Unable to identify user.");
        return;
      }

      if (args.length < 1) {
        await ctx.reply(
          "❌ Usage: `/check_group <group_name>`\n\n" +
            "**Example:** `/check_group arkshitters`",
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Check if user is registered
      try {
        await getUser(userId, username);
      } catch (error) {
        await ctx.reply("❌ Please register first using /start");
        return;
      }

      const groupName = args[0];

      // Get user's wallet (we need the signer to derive the PDA)
      const user = await getUser(userId, username);
      if (!user.private_key) {
        await ctx.reply("❌ No wallet found. Please register again.");
        return;
      }

      // Import the decryptPrivateKey function
      const { decryptPrivateKey } = await import("../utils/encryption");
      const privateKeyHex = decryptPrivateKey(user.private_key);
      const { Keypair } = await import("@solana/web3.js");
      const keypair = Keypair.fromSecretKey(Buffer.from(privateKeyHex, 'hex'));
      const signer = keypair.publicKey;

      // Check if group exists
      const exists = await checkGroupExists(groupName, signer);
      
      if (exists) {
        // Try to fetch the group data
        try {
          const [groupPDA] = deriveGroupPDA(groupName, signer);
          const groupData = await fetchGroupAccount(groupPDA.toBase58());
          
          const message = `
✅ **Group Found On-Chain!**

🏠 **Name:** ${groupName}
📍 **Address:** \`${groupPDA.toBase58()}\`
👤 **Owner:** \`${signer.toBase58()}\`

**Group Data:**
• Owner: ${groupData.owner}
• Name: ${groupData.name}
• Entry Capital: ${groupData.entryCapital} SOL
• Vote Threshold: ${groupData.voteThreshold}%
• Status: ${groupData.locked ? 'Locked' : 'Active'}

**This group was successfully created!**
          `;
          
          await ctx.reply(message, { parse_mode: "Markdown" });
        } catch (fetchError) {
          const [groupPDA] = deriveGroupPDA(groupName, signer);
          await ctx.reply(
            `✅ Group exists on-chain at: \`${groupPDA.toBase58()}\`\n\n` +
            `❌ But couldn't fetch group data. This might be a different program version.`
          );
        }
      } else {
        await ctx.reply(
          `❌ Group "${groupName}" does not exist on-chain.\n\n` +
          `You can create it with:\n` +
          `\`/create_group ${groupName} <max_members> <entry_capital> [consensus_threshold]\``
        );
      }
    } catch (error) {
      console.error("Check group error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await ctx.reply(`❌ Failed to check group: ${errorMessage}`);
    }
  }
}
