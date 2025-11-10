import User from "@database/models/user";
import getBalance from "@shared/utils/getBalance";

async function getUser(telegram_id: Number, username: string) {
  let user = await User.findOne({ telegram_id });
  if (user) {
    // Don't auto-update balance on every getUser call
    // Balance fetching is now handled by getBalance() with caching
    return user;
  }

  // Create new user without wallet
  const newUser = new User({
    telegram_id: telegram_id,
    username: username,
    solanaWallets: [],
  });

  await newUser.save();
  console.log(`New user created: ${telegram_id}`);
  return newUser;
}

// Separate function for balance updates. Only call this when user requests for his balance or before making any transaction.
export async function updateUserBalance(telegram_id: Number, forceUpdate = false) {
  console.log("updateUserBalance triggered");
  const user = await User.findOne({ telegram_id });
  if (!user || !user.solanaWallets || user.solanaWallets.length === 0 || !user.solanaWallets[0].address) {
    throw new Error("User not found or no wallet address");
  }

  // Check if balance is still fresh (within cache duration)
  const now = new Date().getTime();
  const lastUpdated = user.solanaWallets[0].last_updated_balance?.getTime() || 0;
  const cacheAge = now - lastUpdated;

  if (!forceUpdate) {
    console.log(`Using cached balance for ${user.solanaWallets[0].address} (age: ${Math.round(cacheAge / 1000)}s)`);
    return user.solanaWallets[0].balance;
  }

  // Fetch fresh balance
  try {
    const currentBalance = await getBalance(user.solanaWallets[0].address);
    user.solanaWallets[0].balance = currentBalance;
    user.solanaWallets[0].last_updated_balance = new Date();
    await user.save();
    console.log(`Balance updated: ${currentBalance} SOL for ${user.solanaWallets[0].address}`);
    return currentBalance;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`Failed to update balance: ${errorMessage}`);
    // Return cached balance even if stale
    return user.solanaWallets[0].balance;
  }
}
// Helper function to add a solana wallet to user
export async function addSolanaWalletToUser(
  telegram_id: Number,
  address: string,
  encryptedPrivateKey: string
) {
  const user = await User.findOne({ telegram_id });
  if (!user) {
    throw new Error("User not found");
  }

  // Check if wallet already exists
  const existingWallet = user.solanaWallets.find(
    (wallet) => wallet.address === address
  );
  if (existingWallet) {
    throw new Error("Wallet already exists");
  }

  // Add new wallet
  user.solanaWallets.push({
    address,
    encryptedPrivateKey,
    balance: 0,
    last_updated_balance: new Date(0),
  });

  await user.save();
  return user;
}

// Helper function to add an EVM wallet to user
export async function addEVMWalletToUser(
  telegram_id: Number,
  address: string,
  encryptedPrivateKey: string
) {
  const user = await User.findOne({ telegram_id });
  if (!user) {
    throw new Error("User not found");
  }

  // Check if wallet already exists
  const existingWallet = user.evmWallets.find(
    (wallet) => wallet.address.toLowerCase() === address.toLowerCase()
  );
  if (existingWallet) {
    throw new Error("Wallet already exists");
  }

  // Add new wallet
  user.evmWallets.push({
    address: address.toLowerCase(), // Store in lowercase for consistency
    encryptedPrivateKey,
    balance: 0,
    last_updated_balance: new Date(0),
  });

  await user.save();
  return user;
}

//THE getUserInfo and the getBalcnce files can be combined together later for optimization

export default getUser;
