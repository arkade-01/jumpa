import { PublicKey, Keypair } from "@solana/web3.js";
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import idlJson from "./config/idl.json";

const PROGRAM_ID = new PublicKey(idlJson.address);
const owner = new PublicKey("A7Wx9ZrjaX4xxEKKTfxKrMfz9C71gd9o2eDNRisqw9uT");
const groupName = "arkshitters";

console.log("Using Anchor's Program.findProgramAddress...\n");

// Create a dummy provider
const connection = new web3.Connection("https://api.devnet.solana.com");
const dummyKeypair = Keypair.generate();
const dummyWallet = {
  publicKey: dummyKeypair.publicKey,
  payer: dummyKeypair,
  signTransaction: async (tx: any) => tx,
  signAllTransactions: async (txs: any[]) => txs,
};
const provider = new AnchorProvider(connection, dummyWallet as any, {});
const program = new Program(idlJson as any, provider);

// Use Anchor's PDAs() method if available
console.log("Program ID:", PROGRAM_ID.toBase58());
console.log("Owner:", owner.toBase58());
console.log("Group Name:", groupName);
console.log("\nTrying to use program's PDA utils...");

// Method 1: Check if program has PDA helpers
if ((program as any).account?.group?.associatedAddress) {
  console.log("Program has associatedAddress method");
}

// Method 2: Check program methods
console.log("\nAvailable methods:", Object.keys((program as any).methods || {}));
console.log("Available accounts:", Object.keys((program as any).account || {}));


