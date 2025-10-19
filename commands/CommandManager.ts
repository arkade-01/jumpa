import { Telegraf, Context } from "telegraf";
import { BaseCommand } from "./BaseCommand";
import { StartCommand } from "./StartCommand";
import { HelpCommand } from "./HelpCommand";
import { WalletCommand } from "./WalletCommand";
import { AjoCommand } from "./AjoCommand";
import { PollCommand } from "./PollCommand";
import { CreateGroupCommand } from "./CreateGroupCommand";
import { AddMemberCommand } from "./AddMemberCommand";
import { GroupCommand } from "./GroupCommand";
import { AjoInfoCommand } from "./AjoInfoCommand";
import { AjoMembersCommand } from "./AjoMembersCommand";
import { AjoPollsCommand } from "./AjoPollsCommand";
import { AjoBalanceCommand } from "./AjoBalanceCommand";
import { PollTradeCommand } from "./PollTradeCommand";
import { PollEndCommand } from "./PollEndCommand";
import { PollResultsCommand } from "./PollResultsCommand";
import { PollExecuteCommand } from "./PollExecuteCommand";
import { ProposeTradeCommand } from "./ProposeTradeCommand";
import { SyncGroupCommand } from "./SyncGroupCommand";
import { FetchProposalsCommand } from "./FetchProposalsCommand";
import { CheckGroupCommand } from "./CheckGroupCommand";
import { RecoverGroupCommand } from "./RecoverGroupCommand";
import { FundWalletCommand } from "./FundWalletCommand";
import { PromoteTraderCommand } from "./PromoteTraderCommand";
import { VoteCommand } from "./VoteCommand";
import { LeaveGroupCommand } from "./LeaveGroupCommand";
import { DemoteTraderCommand } from "./DemoteTraderCommand";
import { WalletCallbackHandlers } from "./callbackHandlers/WalletCallbackHandlers";
import { StartCallbackHandlers } from "./callbackHandlers/StartCallbackHandlers";
import { AjoCallbackHandlers } from "./callbackHandlers/AjoCallbackHandlers";

export class CommandManager {
  private commands: Map<string, BaseCommand> = new Map();
  private bot: Telegraf<Context>;

  constructor(bot: Telegraf<Context>) {
    this.bot = bot;
    this.registerCommands();
    this.setupCommandHandlers();
  }

  private registerCommands(): void {
    const commandInstances = [
      new StartCommand(),
      new HelpCommand(),
      new WalletCommand(),
      new AjoCommand(),
      new PollCommand(),
      new CreateGroupCommand(),
      new AddMemberCommand(),
      new GroupCommand(),
      new AjoInfoCommand(),
      new AjoMembersCommand(),
      new AjoPollsCommand(),
      new AjoBalanceCommand(),
      new PollTradeCommand(),
      new PollEndCommand(),
      new PollResultsCommand(),
      new PollExecuteCommand(),
      new ProposeTradeCommand(),
      new SyncGroupCommand(),
      new FetchProposalsCommand(),
      new CheckGroupCommand(),
      new RecoverGroupCommand(),
      new FundWalletCommand(),
      new PromoteTraderCommand(),
      new VoteCommand(),
      new LeaveGroupCommand(),
      new DemoteTraderCommand(),
    ];

    commandInstances.forEach((command) => {
      this.commands.set(command.name, command);
    });
  }

  private setupCommandHandlers(): void {
    // Register each command with the bot
    this.commands.forEach((command, commandName) => {
      this.bot.command(commandName, async (ctx: Context) => {
        try {
          await command.execute(ctx);
        } catch (error) {
          console.error(`Error executing command ${commandName}:`, error);
          await ctx.reply("Sorry, something went wrong with that command!");
        }
      });
    });

    // Register callback handlers for wallet command
    this.bot.action(
      "refresh_balance",
      WalletCallbackHandlers.handleRefreshBalance
    );
    this.bot.action("copy_address", WalletCallbackHandlers.handleCopyAddress);
    this.bot.action(
      "show_private_key",
      WalletCallbackHandlers.handleShowPrivateKey
    );
    this.bot.action(
      "wallet_details",
      WalletCallbackHandlers.handleWalletDetails
    );
    this.bot.action("close_wallet", WalletCallbackHandlers.handleCloseWallet);

    // Register callback handlers for start command
    this.bot.action("view_wallet", StartCallbackHandlers.handleViewWallet);
    this.bot.action("view_profile", StartCallbackHandlers.handleViewProfile);
    this.bot.action("create_ajo", StartCallbackHandlers.handleCreateAjo);
    this.bot.action("join_ajo", StartCallbackHandlers.handleJoinAjo);
    this.bot.action("show_help", StartCallbackHandlers.handleShowHelp);
    this.bot.action("show_about", StartCallbackHandlers.handleShowAbout);
    this.bot.action("back_to_menu", StartCallbackHandlers.handleBackToMenu);

    // Register callback handlers for ajo command
    this.bot.action("ajo_info", AjoCallbackHandlers.handleAjoInfo);
    this.bot.action("ajo_members", AjoCallbackHandlers.handleAjoMembers);
    this.bot.action("ajo_polls", AjoCallbackHandlers.handleAjoPolls);
    this.bot.action("ajo_balance", AjoCallbackHandlers.handleAjoBalance);

    // Register new ajo callback handlers
    this.bot.action(
      "create_group_form",
      AjoCallbackHandlers.handleCreateGroupForm
    );
    this.bot.action(
      "add_members_form",
      AjoCallbackHandlers.handleAddMembersForm
    );
    this.bot.action("copy_group_id", AjoCallbackHandlers.handleCopyGroupId);
    this.bot.action(
      "add_bot_to_group",
      AjoCallbackHandlers.handleAddBotToGroup
    );
    this.bot.action(
      "bot_commands_help",
      AjoCallbackHandlers.handleBotCommandsHelp
    );
    this.bot.action(
      "bot_permissions_help",
      AjoCallbackHandlers.handleBotPermissionsHelp
    );
    this.bot.action("custom_create", AjoCallbackHandlers.handleCustomCreate);
    this.bot.action("ajo_help", AjoCallbackHandlers.handleAjoHelp);
    this.bot.action("browse_groups", AjoCallbackHandlers.handleBrowseGroups);
    this.bot.action("join_with_id", AjoCallbackHandlers.handleJoinWithId);
    this.bot.action("my_groups", AjoCallbackHandlers.handleMyGroups);
    this.bot.action("join_help", AjoCallbackHandlers.handleJoinHelp);
    this.bot.action("group_stats", AjoCallbackHandlers.handleGroupStats);
  }

  public getCommand(name: string): BaseCommand | undefined {
    return this.commands.get(name);
  }

  public getAllCommands(): BaseCommand[] {
    return Array.from(this.commands.values());
  }

  public getCommandNames(): string[] {
    return Array.from(this.commands.keys());
  }
}
