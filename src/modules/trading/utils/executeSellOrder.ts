import {
  Keypair, Connection, VersionedTransaction
} from "@solana/web3.js";
import { Context } from "telegraf";
import getUser from '@modules/users/getUserInfo';
import { decryptPrivateKey } from '@shared/utils/encryption';
import { config } from '@core/config/config';

const connection = new Connection(config.solMainnet, 'confirmed');

export async function executeSellOrder(ctx: Context, transactionBase64: string, requestId: string) {
  const telegramId = ctx.from?.id;
  const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

  if (!telegramId) {
    return {
      success: false,
      error: "Unable to identify your account.",
    };
  }

  const user = await getUser(telegramId, username);

  if (!user) {
    return {
      success: false,
      error: "User not found. Please use /start to register first.",
    };
  }
  const privKey = decryptPrivateKey(user.solanaWallets[0].encryptedPrivateKey);
  try {
    const fromWallet = Keypair.fromSecretKey(Buffer.from(privKey, 'hex'));

    const tx = VersionedTransaction.deserialize(Buffer.from(transactionBase64, 'base64'));
    tx.sign([fromWallet]);
    const signedTransaction = Buffer.from(tx.serialize()).toString('base64');
    const executeResponse = await (
      await fetch('https://lite-api.jup.ag/ultra/v1/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signedTransaction: signedTransaction,
          requestId,
        }),
      })
    ).json();

    if (executeResponse.signature) {
      console.log('Sell Order executed:', JSON.stringify(executeResponse, null, 2));
      console.log(`https://solscan.io/tx/${executeResponse.signature}`);
      return {
        success: true,
        explorerUrl: `https://solscan.io/tx/${executeResponse.signature}`,
        amountReceived: executeResponse.totalOutputAmount, // in smallest unit (e.g., lamports)
      };
    } else {
      console.error('Swap failed:', JSON.stringify(executeResponse, null, 2));
      return {
        success: false,
        error: executeResponse.error?.message || "Unknown error"
      };
    }
  } catch (error: any) {
    console.error('❌ Transfer failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
