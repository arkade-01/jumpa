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
import { JoinGroupCommand } from "./JoinGroupCommand";
import { getBankUpdateState } from "../state/bankState";
import { WalletCallbackHandlers } from "./callbackHandlers/WalletCallbackHandlers";
import { StartCallbackHandlers } from "./callbackHandlers/StartCallbackHandlers";
import { AjoCallbackHandlers } from "./callbackHandlers/AjoCallbackHandlers";
import { BankHandler } from "./BankHandler";
import { getWithdrawalState } from "../state/withdrawalState";
import { handleDetectToken } from "../trading/DetectTokenAddress";
import { handleBuy } from "./BuyCommand";
import { BuyCallbackHandlers } from "./callbackHandlers/BuyCallbackHandlers";

export class CommandManager {
  private commands: Map<string, BaseCommand> = new Map();
  private bot: Telegraf<Context>;

  constructor(bot: Telegraf<Context>) {
    this.bot = bot;
    this.registerCommands();
    this.setupCommandHandlers();
    this.updateBotCommands();
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
      new JoinGroupCommand(),
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

    // Register callback handlers for start command
    this.bot.action("view_wallet", StartCallbackHandlers.handleViewProfile); //implement wallet view later
    this.bot.action("view_profile", StartCallbackHandlers.handleViewProfile);
    this.bot.action("create_group", StartCallbackHandlers.handleCreateAjo);
    this.bot.action("join_group", StartCallbackHandlers.handleJoinAjo);
    this.bot.action("show_help", StartCallbackHandlers.handleShowHelp);
    this.bot.action("show_about", StartCallbackHandlers.handleShowAbout);
    this.bot.action("back_to_menu", StartCallbackHandlers.handleBackToMenu);

    // Register callback handlers for wallet command
    this.bot.action("deposit_sol", WalletCallbackHandlers.handleDeposit);
    this.bot.action("withdraw_sol", WalletCallbackHandlers.handleWithdraw);
    this.bot.action("withdraw_to_bank", WalletCallbackHandlers.handleWithdrawToBank);
    this.bot.action("withdraw_onchain", WalletCallbackHandlers.handleWithdrawOnchain);
    this.bot.action(/withdraw_amount:/, WalletCallbackHandlers.handleWithdrawAmount);
    this.bot.action(/withdraw_confirm:/, WalletCallbackHandlers.handleWithdrawConfirmation);
    this.bot.action("withdraw_cancel", async (ctx) => {
      await ctx.answerCbQuery("Cancelled");
      await ctx.reply("Withdrawal cancelled.");
    });

    this.bot.action(/^buy:.+/, handleBuy);
    this.bot.action(/^approve_buy:.+/, BuyCallbackHandlers.handleApprove);
    this.bot.action("decline_buy", BuyCallbackHandlers.handleDecline);


    //register callback handlers for bank account
    this.bot.action(
      "view_bank_account", BankHandler.getBankAccount
    );
    this.bot.action(
      "update_bank_name", BankHandler.updateBankName
    );

    this.bot.action(/update_bank_name:confirm:/, BankHandler.handleBankNameConfirmation);
    this.bot.action("update_bank_name:cancel", BankHandler.handleBankNameConfirmation);

    this.bot.action("final_confirmation:confirm", BankHandler.handleFinalConfirmation);
    this.bot.action("final_confirmation:cancel", BankHandler.handleFinalConfirmation);
    //withdrawal pin handler
    this.bot.action("set_withdrawal_pin", BankHandler.handleSetWithdrawalPin);
    this.bot.action(/set_withdrawal_pin:confirm:/, BankHandler.handleSetWithdrawalPinConfirmation);
    this.bot.action("set_withdrawal_pin:cancel", BankHandler.handleSetWithdrawalPinConfirmation);

    this.bot.on('text', async (ctx) => {
      const text = ctx.message.text;
      console.log('Received text message:', text);
      const userId = ctx.from?.id;
      if (!userId) return;

      const state = getBankUpdateState(userId);
      const withdrawalState = getWithdrawalState(userId);
      // if (!state && !withdrawalState) return;
      if (withdrawalState) {
        await WalletCallbackHandlers.handleWithdrawPinVerification(ctx);
        return;
      }

      if (state) {
        if (state.step === 'awaiting_bank_name') {
          await BankHandler.handleBankNameSelection(ctx);
        } else {
          await BankHandler.handleBankUpdate(ctx);
        } return;
      }
      // Detect if a solana address is sent
      // Solana address pattern
      const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

      // Check if it looks like a contract address
      if (solanaAddressRegex.test(text)) {
        console.log('Detected potential Solana contract address:', text);
        await handleDetectToken(ctx, text);
        return;
      }
    });

    // Register callback handlers for group command
    this.bot.action("group_info", AjoCallbackHandlers.handleAjoInfo);
    this.bot.action("group_members", AjoCallbackHandlers.handleAjoMembers);
    this.bot.action("group_polls", AjoCallbackHandlers.handleAjoPolls);
    this.bot.action("group_balance", AjoCallbackHandlers.handleAjoBalance);

    // Register new group callback handlers
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
    this.bot.action("group_help", AjoCallbackHandlers.handleAjoHelp);
    this.bot.action("browse_groups", AjoCallbackHandlers.handleBrowseGroups);
    this.bot.action("join_with_id", AjoCallbackHandlers.handleJoinWithId);
    this.bot.action("my_groups", AjoCallbackHandlers.handleMyGroups);
    this.bot.action("join_help", AjoCallbackHandlers.handleJoinHelp);
    this.bot.action("group_stats", AjoCallbackHandlers.handleGroupStats)
  }

  public async updateBotCommands(): Promise<void> {
    const commandList = this.getAllCommands().map((command) => ({
      command: command.name,
      description: command.description,
    }));

    try {
      await this.bot.telegram.setMyCommands(commandList);
      console.log("Bot commands updated successfully.");
    } catch (error) {
      console.error("Failed to update bot commands:", error);
    }
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