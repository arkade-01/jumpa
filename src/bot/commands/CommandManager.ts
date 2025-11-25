import { Telegraf, Context } from "telegraf";
import { BaseCommand } from "./BaseCommand";
import { StartCommand } from "@modules/onboarding/commands/StartCommand";
import { HelpCommand } from "@modules/onboarding/commands/HelpCommand";
import { WalletCommand } from "@modules/wallets/commands/WalletCommand";
import { CreateGroupCommand } from "@modules/groups/commands/CreateGroupCommand";
import { GroupCommand } from "@modules/groups/commands/GroupCommand";
import { GroupInfoCommand } from "@modules/groups/commands/GroupInfoCommand";
import { GroupMembersCommand } from "@modules/groups/commands/GroupMembersCommand";
import { GroupPollsCommand } from "@modules/groups/commands/GroupPollsCommand";
import { GroupBalanceCommand } from "@modules/groups/commands/GroupBalanceCommand";
import { CheckGroupCommand } from "@modules/groups/commands/CheckGroupCommand";
import { RecoverGroupCommand } from "@modules/groups/commands/RecoverGroupCommand";
import { FundWalletCommand } from "@modules/wallets/commands/FundWalletCommand";
import { PromoteTraderCommand } from "@modules/groups/commands/PromoteTraderCommand";
import { LeaveGroupCommand } from "@modules/groups/commands/LeaveGroupCommand";
import { DemoteTraderCommand } from "@modules/groups/commands/DemoteTraderCommand";
import { JoinGroupCommand } from "@modules/groups/commands/JoinGroupCommand";
import { getBankUpdateState } from "@shared/state/bankState";
import { WalletCallbackHandlers } from "@modules/wallets/callbacks/WalletCallbackHandlers";
import { StartCallbackHandlers } from "@modules/onboarding/callbacks/StartCallbackHandlers";
import { GroupCallbackHandlers } from "@modules/groups/callbacks/GroupCallbackHandlers";
import { DepositHandlers } from "@modules/groups/callbacks/DepositHandlers";
import { CloseGroupHandlers } from "@modules/groups/callbacks/CloseGroupHandlers";
import { ExitGroupHandlers } from "@modules/groups/callbacks/ExitGroupHandlers";
import { DistributeProfitHandlers } from "@modules/groups/callbacks/DistributeProfitHandlers";
import { BankHandler } from "@modules/payments/commands/BankHandler";
import { getWithdrawalState, clearWithdrawalState } from "@shared/state/withdrawalState";
import { handleDetectToken, handleGroupToken } from "@modules/trading/utils/DetectTokenAddress";
import { handleBuy, handleGroupBuy } from "@modules/trading/commands/BuyCommand";
import { BuyCallbackHandlers } from "@modules/trading/callbacks/BuyCallbackHandlers";
import { handleSell } from "@modules/trading/commands/SellCommand";
import { SellCallbackHandlers } from "@modules/trading/callbacks/SellCallbackHandlers";
import { handleBuyCustomAmountRequest } from "@modules/trading/callbacks/CustomAmountCallbackHandler";
import { getUserActionState, clearUserActionState } from "@shared/state/userActionState";
import { createBuyOrder } from "@modules/trading/utils/createBuyOrder";
import { handleRefresh } from "@bot/callbacks/RefreshCallbackHandler";
import { handleExportPrivateKey, handleSelectWalletForExport, handleCancelExport, handlePinForExport } from "@modules/wallets/callbacks/ExportWalletCallbackHandler";
import { ReferralCommand } from "@modules/referral/commands/ReferralCommand";
import { ImageTestCommand } from "@modules/onboarding/commands/ImageTestCommand";

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
      new CreateGroupCommand(),
      new GroupCommand(),
      new GroupInfoCommand(),
      new GroupMembersCommand(),
      new GroupPollsCommand(),
      new GroupBalanceCommand(),
      new CheckGroupCommand(),
      new RecoverGroupCommand(),
      new FundWalletCommand(),
      new PromoteTraderCommand(),
      new LeaveGroupCommand(),
      new JoinGroupCommand(),
      new DemoteTraderCommand(),
      new ReferralCommand(),
      new ImageTestCommand(),
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
    this.bot.action("create_group", StartCallbackHandlers.handleCreateGroup);
    this.bot.action("join", StartCallbackHandlers.handleJoinGroup);
    this.bot.action("show_help", StartCallbackHandlers.handleShowHelp);
    this.bot.action("show_about", StartCallbackHandlers.handleShowAbout);
    this.bot.action("back_to_menu", StartCallbackHandlers.handleBackToMenu);
    this.bot.action("back_to_group_menu", StartCallbackHandlers.handleBackToGroupMenu);
    this.bot.action("generate_wallet", StartCallbackHandlers.handleGenerateWallet);
    this.bot.action("import_wallet", StartCallbackHandlers.handleImportWallet);
    this.bot.action("add_wallet", StartCallbackHandlers.handleAddWallet);
    this.bot.action("add_wallet_solana", StartCallbackHandlers.handleAddSolanaWallet);
    this.bot.action("add_wallet_evm", StartCallbackHandlers.handleAddEVMWallet);
    this.bot.action("generate_evm_wallet", StartCallbackHandlers.handleGenerateEVMWallet);
    this.bot.action(/set_default_solana:/, StartCallbackHandlers.handleSetDefaultSolanaWallet);
    this.bot.action(/set_default_evm:/, StartCallbackHandlers.handleSetDefaultEVMWallet);
    this.bot.action(/delete_solana_wallet:/, StartCallbackHandlers.handleDeleteSolanaWallet);
    this.bot.action(/delete_evm_wallet:/, StartCallbackHandlers.handleDeleteEVMWallet);
    this.bot.action(/confirm_delete_solana:/, StartCallbackHandlers.handleDeleteSolanaWallet);
    this.bot.action(/confirm_delete_evm:/, StartCallbackHandlers.handleDeleteEVMWallet);

    // Register referral callback handler
    this.bot.action("referral", async (ctx) => {
      const referralCommand = this.commands.get("referral");
      if (referralCommand) {
        await referralCommand.execute(ctx);
      }
    });

    // Register callback handlers for exporting private key
    this.bot.action("export_private_key", handleExportPrivateKey);
    this.bot.action("show_private_key", handleExportPrivateKey); // Alias from /wallet command
    this.bot.action(/^select_export_(sol|evm):\d+$/, handleSelectWalletForExport);
    this.bot.action("cancel_export", handleCancelExport);

    // Register callback handlers for wallet command
    this.bot.action("deposit_sol", WalletCallbackHandlers.handleDeposit);
    this.bot.action("withdraw_sol", WalletCallbackHandlers.handleWithdraw);
    this.bot.action("withdraw_to_bank", WalletCallbackHandlers.handleWithdrawToBank);
    this.bot.action("refresh_balance", WalletCallbackHandlers.handleRefreshBalance);
    this.bot.action(/withdraw_currency:/, WalletCallbackHandlers.handleWithdrawCurrencySelection);
    this.bot.action(/withdraw_custom_amount:/, WalletCallbackHandlers.handleWithdrawCustomAmount);
    this.bot.action(/withdraw_amount:/, WalletCallbackHandlers.handleWithdrawAmount);
    this.bot.action(/withdraw_confirm:/, WalletCallbackHandlers.handleWithdrawConfirmation);

    // Register delete message action (reusable for any command)
    this.bot.action("delete_message", async (ctx) => {
      try {
        await ctx.deleteMessage();
        await ctx.answerCbQuery("Cancelled");
      } catch (error) {
        console.error("Error deleting message:", error);
        await ctx.answerCbQuery("Message deleted");
      }
    });

    // Register close_wallet as alias for delete_message
    this.bot.action("close_wallet", async (ctx) => {
      try {
        await ctx.deleteMessage();
        await ctx.answerCbQuery("Closed");
      } catch (error) {
        console.error("Error deleting message:", error);
        await ctx.answerCbQuery("Message closed");
      }
    });

    // Register wallet_details to show full wallet view
    this.bot.action("wallet_details", StartCallbackHandlers.handleViewWallet);

    //register buy and sell commands
    this.bot.action(/^buy:.+/, handleBuy);
    this.bot.action(/^approve_buy:.+/, BuyCallbackHandlers.handleApprove);
    this.bot.action("decline_buy", BuyCallbackHandlers.handleDecline);
    this.bot.action(/^buy_custom:.+/, handleBuyCustomAmountRequest);
    this.bot.action(/^refresh:.+/, handleRefresh);

    this.bot.action(/^sell:.+/, handleSell);
    this.bot.action(/^approve_sell:.+/, SellCallbackHandlers.handleApprove);
    this.bot.action("decline_sell", SellCallbackHandlers.handleDecline);

    //register buy and sell commands for groups
    this.bot.action(/^groupBuy:.+/, handleGroupBuy);


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
        // Check if message came from a group and call the group function
        if (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') {
          // Call your group-specific function here
          await handleGroupToken(ctx, text);
        } else {
          // Call this for private chats
          await handleDetectToken(ctx, text);
        }
        return;
      }
    });

    // Register callback handlers for group command
    this.bot.action("group_info", GroupCallbackHandlers.handleGroupInfo);
    this.bot.action("group_members", GroupCallbackHandlers.handleGroupMembers);
    this.bot.action("group_balance", GroupCallbackHandlers.handleGroupBalance);

    // Register new group callback handlers
    this.bot.action(
      "create_group_form",
      GroupCallbackHandlers.handleCreateGroupForm
    );
    this.bot.action("copy_group_id", GroupCallbackHandlers.handleCopyGroupId);
    this.bot.action(
      "add_bot_to_group",
      GroupCallbackHandlers.handleAddBotToGroup
    );
    this.bot.action(
      "bot_commands_help",
      GroupCallbackHandlers.handleBotCommandsHelp
    );
    this.bot.action(
      "bot_permissions_help",
      GroupCallbackHandlers.handleBotPermissionsHelp
    );
    this.bot.action("custom_create", GroupCallbackHandlers.handleCustomCreate);
    this.bot.action("group_help", GroupCallbackHandlers.handleGroupHelp);
    this.bot.action("browse_groups", GroupCallbackHandlers.handleBrowseGroups);
    this.bot.action("join_with_id", GroupCallbackHandlers.handleJoinWithId);
    this.bot.action("my_groups", GroupCallbackHandlers.handleMyGroups);
    this.bot.action("join_help", GroupCallbackHandlers.handleJoinHelp);
    this.bot.action("group_stats", GroupCallbackHandlers.handleGroupStats);

    // Register deposit callback handlers
    this.bot.action("group_deposit", DepositHandlers.handleDepositFunds);
    this.bot.action("deposit_custom", DepositHandlers.handleDepositCustom);
    this.bot.action("deposit_cancel", DepositHandlers.handleDepositCancel);
    this.bot.action("group_manage_refresh", GroupCallbackHandlers.handleGroupManageRefresh);
    this.bot.action("group_more_actions", GroupCallbackHandlers.handleMoreActions);

    // Register close group callback handlers
    this.bot.action("group_close", CloseGroupHandlers.handleCloseGroup);
    this.bot.action("close_group_confirm", CloseGroupHandlers.handleCloseGroupConfirm);
    this.bot.action("close_group_cancel", CloseGroupHandlers.handleCloseGroupCancel);

    // Register exit group callback handlers
    this.bot.action("group_exit", ExitGroupHandlers.handleExitGroup);
    this.bot.action("exit_group_confirm", ExitGroupHandlers.handleExitGroupConfirm);
    this.bot.action("exit_group_cancel", ExitGroupHandlers.handleExitGroupCancel);

    // Register distribute profit callback handlers
    this.bot.action("group_distribute", DistributeProfitHandlers.handleDistributeProfit);
    this.bot.action("distribute_custom", DistributeProfitHandlers.handleCustomAmount);
    this.bot.action("distribute_cancel", DistributeProfitHandlers.handleDistributeCancel);

    // Register distribute profit member selection callbacks
    this.bot.action(/^distribute_select_member_(.+)$/, async (ctx) => {
      const match = ctx.match;
      if (match && match[1]) {
        await DistributeProfitHandlers.handleMemberSelection(ctx, match[1]);
      }
    });

    // Register distribute profit amount callbacks
    this.bot.action(/^distribute_amount_(.+)$/, async (ctx) => {
      const match = ctx.match;
      if (match && match[1]) {
        await DistributeProfitHandlers.handleAmountSelection(ctx, match[1]);
      }
    });

    // Register distribute profit confirm callbacks
    this.bot.action(/^distribute_confirm_(.+)$/, async (ctx) => {
      const match = ctx.match;
      if (match && match[1]) {
        await DistributeProfitHandlers.handleDistributeConfirm(ctx, match[1]);
      }
    });

    // Register deposit amount callbacks
    this.bot.action(/^deposit_amount_(.+)$/, async (ctx) => {
      const match = ctx.match;
      if (match && match[1]) {
        await DepositHandlers.handleDepositAmount(ctx, match[1]);
      }
    });

    // Register deposit confirm callbacks
    this.bot.action(/^deposit_confirm_(.+)$/, async (ctx) => {
      const match = ctx.match;
      if (match && match[1]) {
        await DepositHandlers.handleDepositConfirm(ctx, match[1]);
      }
    });
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