import { Context } from "telegraf";
import { GroupCallbackHandlers } from "@modules/groups/callbacks/GroupCallbackHandlers";
import { WalletViewHandlers } from "./WalletViewHandlers";
import { ProfileHandlers } from "./ProfileHandlers";
import { HelpAboutHandlers } from "./HelpAboutHandlers";
import { WalletSetupHandlers } from "./WalletSetupHandlers";
import { AddWalletHandlers } from "./AddWalletHandlers";
import { DefaultWalletHandlers } from "./DefaultWalletHandlers";
import { MenuHandlers } from "./MenuHandlers";

export class StartCallbackHandlers {
  // Handle view wallet callback
  static async handleViewWallet(ctx: Context): Promise<void> {
    return WalletViewHandlers.handleViewWallet(ctx);
  }

  // Handle view profile callback
  static async handleViewProfile(ctx: Context): Promise<void> {
    return ProfileHandlers.handleViewProfile(ctx);
  }

  // Handle create callback
  static async handleCreateGroup(ctx: Context): Promise<void> {
    return GroupCallbackHandlers.handleCreateGroup(ctx);
  }

  // Handle join callback
  static async handleJoinGroup(ctx: Context): Promise<void> {
    return GroupCallbackHandlers.handleJoinGroup(ctx);
  }

  // Handle show help callback
  static async handleShowHelp(ctx: Context): Promise<void> {
    return HelpAboutHandlers.handleShowHelp(ctx);
  }

  // Handle show about callback
  static async handleShowAbout(ctx: Context): Promise<void> {
    return HelpAboutHandlers.handleShowAbout(ctx);
  }

  // Handle generate wallet callback
  static async handleGenerateWallet(ctx: Context): Promise<void> {
    return WalletSetupHandlers.handleGenerateWallet(ctx);
  }

  // Handle import wallet callback
  static async handleImportWallet(ctx: Context): Promise<void> {
    return WalletSetupHandlers.handleImportWallet(ctx);
  }

  // Handle private key import
  static async handlePrivateKeyImport(
    ctx: Context,
    privateKeyInput: string
  ): Promise<void> {
    return WalletSetupHandlers.handlePrivateKeyImport(ctx, privateKeyInput);
  }

  // Handle add wallet callback
  static async handleAddWallet(ctx: Context): Promise<void> {
    return AddWalletHandlers.handleAddWallet(ctx);
  }

  // Handle add Solana wallet callback
  static async handleAddSolanaWallet(ctx: Context): Promise<void> {
    return AddWalletHandlers.handleAddSolanaWallet(ctx);
  }

  // Handle add EVM wallet callback
  static async handleAddEVMWallet(ctx: Context): Promise<void> {
    return AddWalletHandlers.handleAddEVMWallet(ctx);
  }
  // Handle add EVM wallet callback
  static async handleGenerateEVMWallet(ctx: Context): Promise<void> {
    return AddWalletHandlers.handleGenerateEVMWallet(ctx);
  }

  // Handle add EVM private key input
  static async handleAddEVMPrivateKeyInput(
    ctx: Context,
    privateKeyInput: string
  ): Promise<void> {
    return AddWalletHandlers.handleAddEVMPrivateKeyInput(ctx, privateKeyInput);
  }

  // Handle add Solana private key input
  static async handleAddSolanaPrivateKeyInput(
    ctx: Context,
    privateKeyInput: string
  ): Promise<void> {
    return AddWalletHandlers.handleAddSolanaPrivateKeyInput(ctx, privateKeyInput);
  }

  // Handle set default Solana wallet callback
  static async handleSetDefaultSolanaWallet(ctx: Context): Promise<void> {
    return DefaultWalletHandlers.handleSetDefaultSolanaWallet(ctx);
  }

  // Handle set default EVM wallet callback
  static async handleSetDefaultEVMWallet(ctx: Context): Promise<void> {
    return DefaultWalletHandlers.handleSetDefaultEVMWallet(ctx);
  }

  // Handle delete Solana wallet callback
  static async handleDeleteSolanaWallet(ctx: Context): Promise<void> {
    return DefaultWalletHandlers.handleDeleteSolanaWallet(ctx);
  }

  // Handle delete EVM wallet callback
  static async handleDeleteEVMWallet(ctx: Context): Promise<void> {
    return DefaultWalletHandlers.handleDeleteEVMWallet(ctx);
  }

  // Handle back to main menu callback
  static async handleBackToMenu(ctx: Context): Promise<void> {
    return MenuHandlers.handleBackToMenu(ctx);
  }

  // Handle back to group menu callback
  static async handleBackToGroupMenu(ctx: Context): Promise<void> {
    return MenuHandlers.handleBackToGroupMenu(ctx);
  }
}
