//read the group data from the JumpaGroup contract
import { Contract, ethers, Wallet } from "ethers";
import { jumpaFactoryProxyAbi } from "./JumpaFactoryProxyAbi";
import { jumpaFactoryAbi } from "./JumpaFactoryAbi";
import getUser from "@features/users/getUserInfo";
import { Context } from "telegraf";
import { decryptPrivateKey } from "@shared/utils/encryption";
import { config } from "@core/config/environment";
import Group from "@core/database/models/group";
// ‼️ use proxy address but factory abi to read data

const provider = new ethers.JsonRpcProvider(config.evmRpcUrl);

/**
 * Create a new group on the JumpaFactory contract
 * uses the JumpaFactoryProxy address with the JumpaFactory ABI
 * Change the RPC URL from the env file if needed
 */

export async function createBaseGroup(
  ctx: Context,
  name: string,
  type: boolean
) {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;

  if (!userId || !chatId) {
    await ctx.reply("❌ Unable to identify user or chat.");
    return;
  }
  //check if group already exists for the chat id
  const existingGroup = await Group.findOne({ telegram_chat_id: chatId });
  if (existingGroup) {
    return { success: false, data: "A Group already exists for this chat" };
  }
  const contractAddress = jumpaFactoryProxyAbi.contractAddress;
  const contract = new Contract(contractAddress, jumpaFactoryAbi.abi, provider);

  //verify user first
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
  const contractWithSigner = new Contract(
    contractAddress,
    jumpaFactoryAbi.abi,
    wallet
  );

  try {
    const newGroup = await contractWithSigner.createGroup(name, type);
    const receipt = await newGroup.wait();
    console.log("---- New Group Transaction: ----", receipt);

    // Extract GroupCreated event from transaction receipt
    const groupCreatedEvent = receipt.logs.find((log: any) => {
      try {
        const parsedLog = contract.interface.parseLog(log);
        return parsedLog?.name === "GroupCreated";
      } catch {
        return false;
      }
    });

    if (groupCreatedEvent) {
      const parsedEvent = contract.interface.parseLog(groupCreatedEvent);
      const groupAddress = parsedEvent?.args.groupAddress;
      const owner = parsedEvent?.args.owner;
      const timestamp = parsedEvent?.args.timestamp;

      console.log("---- Group Created Event ----");
      console.log("Group Address:", groupAddress);
      console.log("Owner:", owner);
      console.log("Timestamp:", timestamp?.toString());

      //save group to the db
      const saveGrp = await Group.create({
        name: name,
        creator_id: userId,
        telegram_chat_id: chatId,
        is_private: !type,
        group_address: groupAddress,
        blockchain_type: "base",
        onchain_tx_signature: receipt.hash,
        members: [
          {
            user_id: userId,
          },
        ],
      });
      console.log("saveGrp", saveGrp);

      return {
        success: true,
        data: {
          hash: receipt.hash,
          blockNumber: receipt.blockNumber,
          groupAddress: groupAddress,
          owner: owner,
          name: name,
          isPrivate: !type,
          timestamp: timestamp?.toString(),
        },
      };
    }

    // Fallback if event not found
    return {
      success: true,
      data: { hash: receipt.hash, blockNumber: receipt.blockNumber },
    };
  } catch (error) {
    console.error("Error creating group:", error);
    console.log("short error msg", error.code);
    console.log("detailed error 2", error.info?.error?.message);
    return {
      success: false,
      data: error.info?.error?.message || error.message,
    };
  }
}
