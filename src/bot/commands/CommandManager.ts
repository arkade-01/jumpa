import { Telegraf, Context } from "telegraf";
import { BaseCommand } from "./BaseCommand";
import { StartCommand } from "@modules/onboarding/commands/StartCommand";
import { HelpCommand } from "@modules/onboarding/commands/HelpCommand";
import { WalletCommand } from "@modules/wallets/commands/WalletCommand";
import { AjoCommand } from "@modules/ajo-groups/commands/AjoCommand";
import { PollCommand } from "@modules/governance/commands/PollCommand";
import { CreateGroupCommand } from "@modules/ajo-groups/commands/CreateGroupCommand";
import { AddMemberCommand } from "@modules/ajo-groups/commands/AddMemberCommand";
import { GroupCommand } from "@modules/ajo-groups/commands/GroupCommand";
import { AjoInfoCommand } from "@modules/ajo-groups/commands/AjoInfoCommand";
import { AjoMembersCommand } from "@modules/ajo-groups/commands/AjoMembersCommand";
import { AjoPollsCommand } from "@modules/ajo-groups/commands/AjoPollsCommand";
import { AjoBalanceCommand } from "@modules/ajo-groups/commands/AjoBalanceCommand";
import { PollTradeCommand } from "@modules/governance/commands/PollTradeCommand";
import { PollEndCommand } from "@modules/governance/commands/PollEndCommand";
import { PollResultsCommand } from "@modules/governance/commands/PollResultsCommand";
import { PollExecuteCommand } from "@modules/governance/commands/PollExecuteCommand";
import { ProposeTradeCommand } from "@modules/governance/commands/ProposeTradeCommand";
import { SyncGroupCommand } from "@modules/ajo-groups/commands/SyncGroupCommand";
import { FetchProposalsCommand } from "@modules/governance/commands/FetchProposalsCommand";
import { CheckGroupCommand } from "@modules/ajo-groups/commands/CheckGroupCommand";
import { RecoverGroupCommand } from "@modules/ajo-groups/commands/RecoverGroupCommand";
import { FundWalletCommand } from "@modules/wallets/commands/FundWalletCommand";
import { PromoteTraderCommand } from "@modules/ajo-groups/commands/PromoteTraderCommand";
import { VoteCommand } from "@modules/governance/commands/VoteCommand";
import { LeaveGroupCommand } from "@modules/ajo-groups/commands/LeaveGroupCommand";
import { DemoteTraderCommand } from "@modules/ajo-groups/commands/DemoteTraderCommand";
import { JoinGroupCommand } from "@modules/ajo-groups/commands/JoinGroupCommand";
import { getBankUpdateState } from "@shared/state/bankState";
import { WalletCallbackHandlers } from "@modules/wallets/callbacks/WalletCallbackHandlers";
import { StartCallbackHandlers } from "@modules/onboarding/callbacks/StartCallbackHandlers";
import { AjoCallbackHandlers } from "@modules/ajo-groups/callbacks/AjoCallbackHandlers";
import { BankHandler } from "@modules/payments/commands/BankHandler";
import { getWithdrawalState, clearWithdrawalState } from "@shared/state/withdrawalState";
import { handleDetectToken } from "@modules/trading/utils/DetectTokenAddress";
import { handleBuy } from "@modules/trading/commands/BuyCommand";
import { BuyCallbackHandlers } from "@modules/trading/callbacks/BuyCallbackHandlers";
import { handleSell } from "@modules/trading/commands/SellCommand";
import { SellCallbackHandlers } from "@modules/trading/callbacks/SellCallbackHandlers";
import { handleBuyCustomAmountRequest } from "@modules/trading/callbacks/CustomAmountCallbackHandler";
import { getUserActionState, clearUserActionState } from "@shared/state/userActionState";
import { createBuyOrder } from "@modules/trading/utils/createBuyOrder";
import { handleRefresh } from "@bot/callbacks/RefreshCallbackHandler";
import { handleExportPrivateKey, handleProceedExport, handleCancelExport, handlePinForExport } from "@modules/wallets/callbacks/ExportWalletCallbackHandler";

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
    this.bot.action("view_wallet", StartCallbackHandlers.handleViewWallet);
    this.bot.action("view_profile", StartCallbackHandlers.handleViewProfile);
    this.bot.action("create_group", StartCallbackHandlers.handleCreateAjo);
    this.bot.action("join_group", StartCallbackHandlers.handleJoinAjo);
    this.bot.action("show_help", StartCallbackHandlers.handleShowHelp);
    this.bot.action("show_about", StartCallbackHandlers.handleShowAbout);
    this.bot.action("back_to_menu", StartCallbackHandlers.handleBackToMenu);
    this.bot.action("generate_wallet", StartCallbackHandlers.handleGenerateWallet);
    this.bot.action("import_wallet", StartCallbackHandlers.handleImportWallet);
    this.bot.action("add_wallet", StartCallbackHandlers.handleAddWallet);
    this.bot.action("add_wallet_solana", StartCallbackHandlers.handleAddSolanaWallet);
    this.bot.action("add_wallet_evm", StartCallbackHandlers.handleAddEVMWallet);

    // Register callback handlers for exporting private key
    this.bot.action("export_private_key", handleExportPrivateKey);
    this.bot.action("proceed_export", handleProceedExport);
    this.bot.action("cancel_export", handleCancelExport);

    // Register callback handlers for wallet command
    this.bot.action("deposit_sol", WalletCallbackHandlers.handleDeposit);
    this.bot.action("withdraw_sol", WalletCallbackHandlers.handleWithdraw);
    this.bot.action("withdraw_to_bank", WalletCallbackHandlers.handleWithdrawToBank);
    this.bot.action("withdraw_onchain", WalletCallbackHandlers.handleWithdrawOnchain);
    this.bot.action(/withdraw_currency:/, WalletCallbackHandlers.handleWithdrawCurrencySelection);
    this.bot.action(/withdraw_custom_amount:/, WalletCallbackHandlers.handleWithdrawCustomAmount);
    this.bot.action(/withdraw_amount:/, WalletCallbackHandlers.handleWithdrawAmount);
    this.bot.action(/withdraw_confirm:/, WalletCallbackHandlers.handleWithdrawConfirmation);
    this.bot.action("withdraw_cancel", async (ctx) => {
      const userId = ctx.from?.id;
      if (userId) {
        clearWithdrawalState(userId);
      }
      await ctx.answerCbQuery("Cancelled");
      await ctx.reply("Withdrawal cancelled.");
    });

    //register buy and sell commands
    this.bot.action(/^buy:.+/, handleBuy);
    this.bot.action(/^approve_buy:.+/, BuyCallbackHandlers.handleApprove);
    this.bot.action("decline_buy", BuyCallbackHandlers.handleDecline);
    this.bot.action(/^buy_custom:.+/, handleBuyCustomAmountRequest);
    this.bot.action(/^refresh:.+/, handleRefresh);

    this.bot.action(/^sell:.+/, handleSell);
    this.bot.action(/^approve_sell:.+/, SellCallbackHandlers.handleApprove);
    this.bot.action("decline_sell", SellCallbackHandlers.handleDecline);


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

      const userAction = getUserActionState(userId);
      if (userAction?.action === 'awaiting_custom_buy_amount') {
        const amount = parseFloat(text);
        if (isNaN(amount) || amount <= 0) {
          await ctx.reply("Invalid amount. Please enter a positive number.");
          return;
        }
        // Clear the state
        clearUserActionState(userId);
        // Create the buy order
        await createBuyOrder(ctx, userAction.tradeId, amount);
        return; // Stop further processing
      }

      // Handle pin for private key export
      if (userAction?.action === "awaiting_export_pin") {
        await handlePinForExport(ctx);
        return;
      }

      // Handle private key import
      if (userAction?.action === "awaiting_import_private_key") {
        // Check if user wants to cancel
        if (text.toLowerCase().trim() === "/cancel") {
          clearUserActionState(userId);
          await ctx.reply("❌ Wallet import cancelled.");
          return;
        }
        await StartCallbackHandlers.handlePrivateKeyImport(ctx, text);
        return;
      }

      // Handle add Solana private key input
      if (userAction?.action === "awaiting_add_solana_private_key") {
        // Check if user wants to cancel
        if (text.toLowerCase().trim() === "/cancel") {
          clearUserActionState(userId);
          await ctx.reply("❌ Add wallet cancelled.");
          return;
        }
        await StartCallbackHandlers.handleAddSolanaPrivateKeyInput(ctx, text);
        return;
      }

      // Handle add EVM private key input
      if (userAction?.action === "awaiting_add_evm_private_key") {
        // Check if user wants to cancel
        if (text.toLowerCase().trim() === "/cancel") {
          clearUserActionState(userId);
          await ctx.reply("❌ Add wallet cancelled.");
          return;
        }
        await StartCallbackHandlers.handleAddEVMPrivateKeyInput(ctx, text);
        return;
      }

      const state = getBankUpdateState(userId);
      const withdrawalState = getWithdrawalState(userId);
      // if (!state && !withdrawalState) return;
      if (withdrawalState) {
        if (withdrawalState.step === 'awaiting_custom_amount') {
          await WalletCallbackHandlers.handleCustomAmountInput(ctx);
          return;
        } else if (withdrawalState.step === 'awaiting_pin') {
          await WalletCallbackHandlers.handleWithdrawPinVerification(ctx);
          return;
        }
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