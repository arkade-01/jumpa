//Deposit to a JumpaGroup contract
import { Contract, ethers, Wallet } from "ethers";
import { jumpaGroupAbi } from "./JumpaGroupAbi";
import { config } from "@core/config/environment";
import getUser from "@features/users/getUserInfo";
import { Context } from "telegraf";
import { decryptPrivateKey } from "@shared/utils/encryption";
import { getMinimumDeposit } from "./getGroupConstants";

const provider = new ethers.JsonRpcProvider(config.evmRpcUrl);

/** Deposit to a base group address
 * Requires the group address, amount to deposit, and user context
 * Calls the deposit function with the zero address (ETH) and amount
 * Returns deposit event data on success
 */

export const DepositBaseGroup = async (
  ctx: Context,
  address: string,
  amount: number
) => {
  const userId = ctx.from?.id;

  if (!userId) {
    await ctx.reply("❌ Unable to identify user.");
    return { success: false, data: "User not identified" };
  }

  // Verify user and get wallet
  const user = await getUser(userId, ctx.from?.username);
  if (!user) {
    await ctx.reply("❌ Please register first using /start");
    return { success: false, data: "User not registered" };
  } else if (!user.evmWallets[0].address) {
    await ctx.reply("❌ Please create a new EVM wallet");
    return { success: false, data: "Wallet not linked" };
  }

  const pkey = user.evmWallets[0].encryptedPrivateKey;
  const decryptedKey = decryptPrivateKey(pkey);
  const wallet = new Wallet(decryptedKey, provider);

  const contractAddress = address; //always interact with the user's created group trading CA
  const contract = new Contract(contractAddress, jumpaGroupAbi.abi, provider);
  const contractWithSigner = new Contract(
    contractAddress,
    jumpaGroupAbi.abi,
    wallet
  );
  try {
    const minDeposit = await getMinimumDeposit(contractAddress);
    if (!minDeposit.success) {
      return {
        success: false,
        data: minDeposit.data,
      };
    } else if (minDeposit.data.formattedMinDeposit > amount) {
      return {
        success: false,
        data:
          "Deposit amount is less than minimum required deposit of " +
          minDeposit.data.formattedMinDeposit +
          " ETH",
      };
    }
  } catch (error) {
    return {
      success: false,
      data: error.code,
    };
  }

  try {
    // Call deposit function - this is a transaction, not a view function

    const depositTx = await contractWithSigner.deposit(ethers.ZeroAddress, 1, {
      value: ethers.parseEther(amount.toString()),
    });
    console.log("---- Deposit Transaction ----", depositTx);

    // Wait for transaction to be mined
    const receipt = await depositTx.wait();
    console.log("---- Deposit Receipt ----", receipt);

    // Extract DepositMade event from transaction receipt
    const depositMadeEvent = receipt.logs.find((log: any) => {
      try {
        const parsedLog = contract.interface.parseLog(log);
        return parsedLog?.name === "DepositMade";
      } catch {
        return false;
      }
    });

    if (depositMadeEvent) {
      const parsedEvent = contract.interface.parseLog(depositMadeEvent);
      const member = parsedEvent?.args.member;
      const token = parsedEvent?.args.token;
      const depositAmount = parsedEvent?.args.amount;
      const newTotal = parsedEvent?.args.newTotal;
      const timestamp = parsedEvent?.args.timestamp;

      console.log("---- Deposit Made Event ----");
      console.log("Member:", member);
      console.log("Token:", token);
      console.log("Amount:", depositAmount?.toString());
      console.log("New Total:", newTotal?.toString());
      console.log("Timestamp:", timestamp?.toString());

      return {
        success: true,
        data: {
          member: member as string,
          token: token as string,
          amount: depositAmount?.toString(),
          newTotal: newTotal?.toString(),
          timestamp: timestamp?.toString(),
          hash: receipt.hash,
          blockNumber: receipt.blockNumber,
        },
      };
    }

    // Fallback if event not found
    return {
      success: true,
      data: { hash: receipt.hash, blockNumber: receipt.blockNumber },
    };
  } catch (error) {
    // console.error("Error fetching group info:", error);
    console.log("short error msg", error.code);
    console.log("detailed error 2", error);
    return {
      success: false,
      data: error.code,
    };
  }
};
