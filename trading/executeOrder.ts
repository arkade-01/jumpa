//use the tx details from getOrder to execute the swap by making a post request to /ultra/v1/execute
//steps
//1. import sol web3 library
//2. create a connection to solana mainnet
//3. extract transaction from getOrder response
//4. Deserialize, sign and serialize the transaction
//5. make a post request to /ultra/v1/execute with the signed transaction
//6. log the response and get tx status

import {
  Keypair, Connection, LAMPORTS_PER_SOL,  VersionedTransaction
} from "@solana/web3.js";
import { Telegraf, Markup, Context } from "telegraf";
import getUser from '../services/getUserInfo';
import { decryptPrivateKey } from '../utils/encryption';
import { config } from '../config/config';


//tx has to be executed on mainnet
const connection = new Connection(config.solMainnet, 'confirmed');

async function executeOrder(ctx: Context, transactionBase64: string) {
  //<--------code starts here
  const amount = 0.001; //amount in SOL
  const requestId = "019a12d7-868b-75c9-bdf7-84bed1aedf6e"; //from getOrder response



  console.log("initiating buy function...")
  const telegramId = ctx.from?.id;
  const username = ctx.from?.username || ctx.from?.first_name || "Unknown";

  if (!telegramId) {
    await ctx.answerCbQuery("❌ Unable to identify your account.");
    return;
  }

  const user = await getUser(telegramId, username);

  if (!user) {
    await ctx.reply(
      "❌ User not found. Please use /start to register first."
    );
    return;
  }
  const privKey = decryptPrivateKey(user.private_key);
  try {
    // 1. Load sender's wallet from private key
    const fromWallet = Keypair.fromSecretKey(Buffer.from(privKey, 'hex'));

    // 2. Check sender's balance
    const balance = await connection.getBalance(fromWallet.publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;

    console.log(`Sender: ${fromWallet.publicKey.toString()}`);
    console.log(`Balance: ${solBalance} SOL`);
    // console.log(`Recipient: ${toAddress}`);
    // console.log(`Amount: ${amount} SOL`);

    // 3. Verify sufficient balance (amount + fee)
    const amountInLamports = amount * LAMPORTS_PER_SOL;
    const estimatedFee = 5000; // ~0.000005 SOL
    const totalNeeded = (amountInLamports + estimatedFee) / LAMPORTS_PER_SOL;

    if (balance < amountInLamports + estimatedFee) {
      return {
        success: false,
        error: `Insufficient balance. You have: ${solBalance.toFixed(2)} SOL, You need a minimum of ${totalNeeded.toFixed(6)} SOL to cover both transaction fee and amount you are trying to withdraw`
      };
    }

    //4. Deserialize, sign and serialize the transaction
    const tx = VersionedTransaction.deserialize(Buffer.from(transactionBase64, 'base64'));
    tx.sign([fromWallet]);
    const signedTransaction = Buffer.from(tx.serialize()).toString('base64');

    //make a post request to /ultra/v1/execute with the signed transaction
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

    if (executeResponse.status === "Success") {
      console.log('Swap successful:', JSON.stringify(executeResponse, null, 2));
      console.log(`https://solscan.io/tx/${executeResponse.signature}`);
    } else {
      console.error('Swap failed:', JSON.stringify(executeResponse, null, 2));
      console.log(`https://solscan.io/tx/${executeResponse.signature}`);
    }

    // 7. Check user balance after  the tx
    const newBalance = await connection.getBalance(fromWallet.publicKey);
    console.log(`\nNew sender balance: ${newBalance / LAMPORTS_PER_SOL} SOL`);

    return {
      success: true,
      fromAddress: fromWallet.publicKey.toString(),
      toAddress: "toAddress",
      amount: "amount",
      explorerUrl: `https://solscan.io/tx/${executeResponse.signature}`
    };

  } catch (error) {
    console.error('❌ Transfer failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

