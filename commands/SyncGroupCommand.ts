import { Context } from "telegraf";
import { BaseCommand } from "./BaseCommand";
import { syncGroupFromChain, getAjoByChatId } from "../services/ajoService";
import getUser from "../services/getUserInfo";

export class SyncGroupCommand extends BaseCommand {
  name = "sync_group";
  description = "Sync group data from blockchain";

  async execute(ctx: Context): Promise<void> {
    try {
      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;
      const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

      if (!userId || !chatId) {
        await ctx.reply("❌ Unable to identify user or chat.");
        return;
      }

      // Check if user is registered
      try {
        await getUser(userId, username);
      } catch (error) {
        await ctx.reply("❌ Please register first using /start");
        return;
      }

      // Get the ajo group for this chat
      const ajoGroup = await getAjoByChatId(chatId);
      if (!ajoGroup) {
        await ctx.reply(
          "❌ No Ajo group found in this chat. Create one first with /create_group"
        );
        return;
      }

      await ctx.reply("🔄 Syncing group data from blockchain...");

      // Sync group from chain
      const syncData = await syncGroupFromChain(ajoGroup._id.toString());

      const message = `
✅ **Group Synced Successfully!**

${syncData.syncedRoles > 0 ? `🔄 **Synced ${syncData.syncedRoles} member role(s) from blockchain**\n` : ''}
**Database Info:**
• Name: ${syncData.database.name}
• Members: ${syncData.database.members.length}/${syncData.database.max_members}
• Balance: ${syncData.database.current_balance}

**On-Chain Info:**
• Owner: \`${syncData.onChain.owner.substring(0, 8)}...${syncData.onChain.owner.substring(syncData.onChain.owner.length - 8)}\`
• State: ${syncData.onChain.state}
• Traders: ${syncData.onChain.traders.length}
• Members: ${syncData.onChain.members.length}
• Entry Capital: ${syncData.onChain.entryCapital}
• Vote Threshold: ${syncData.onChain.voteThreshold}%
• Locked: ${syncData.onChain.locked ? "Yes" : "No"}
• Created: ${syncData.onChain.createdAt.toLocaleDateString()}

**On-Chain Address:** \`${ajoGroup.onchain_group_address}\`
      `;

      await ctx.reply(message, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Sync group error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await ctx.reply(`❌ Failed to sync group: ${errorMessage}`);
    }
  }
}


