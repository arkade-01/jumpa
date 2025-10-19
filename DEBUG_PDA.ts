import { PublicKey } from "@solana/web3.js";

// Test different seed combinations to find the right one
const PROGRAM_ID = new PublicKey("E4bVkwfeUuh1eWLuz9pjaAkuZYUGY8nWiybCBG3cpHpr");
const GROUP_SEED = Buffer.from("GROUP_SEED");
const owner = new PublicKey("A7Wx9ZrjaX4xxEKKTfxKrMfz9C71gd9o2eDNRisqw9uT");
const groupName = "arkshitters";

console.log("Testing different PDA derivations...\n");

// Test 1: Original (what we're doing now)
const [pda1] = PublicKey.findProgramAddressSync(
  [GROUP_SEED, Buffer.from(groupName, 'utf8'), owner.toBuffer()],
  PROGRAM_ID
);
console.log("1. [GROUP_SEED, name, owner]:", pda1.toBase58());

// Test 2: Without GROUP_SEED prefix
const [pda2] = PublicKey.findProgramAddressSync(
  [Buffer.from(groupName, 'utf8'), owner.toBuffer()],
  PROGRAM_ID
);
console.log("2. [name, owner]:", pda2.toBase58());

// Test 3: With lowercase name
const [pda3] = PublicKey.findProgramAddressSync(
  [GROUP_SEED, Buffer.from(groupName.toLowerCase(), 'utf8'), owner.toBuffer()],
  PROGRAM_ID
);
console.log("3. [GROUP_SEED, lowercase_name, owner]:", pda3.toBase58());

// Test 4: With name first, then GROUP_SEED
const [pda4] = PublicKey.findProgramAddressSync(
  [Buffer.from(groupName, 'utf8'), GROUP_SEED, owner.toBuffer()],
  PROGRAM_ID
);
console.log("4. [name, GROUP_SEED, owner]:", pda4.toBase58());

// Test 5: Just GROUP_SEED and owner (no name)
const [pda5] = PublicKey.findProgramAddressSync(
  [GROUP_SEED, owner.toBuffer()],
  PROGRAM_ID
);
console.log("5. [GROUP_SEED, owner]:", pda5.toBase58());

// Test 6: Name and owner, different order
const [pda6] = PublicKey.findProgramAddressSync(
  [owner.toBuffer(), Buffer.from(groupName, 'utf8')],
  PROGRAM_ID
);
console.log("6. [owner, name]:", pda6.toBase58());

console.log("\nExpected:", "6uEm8MpAqXJVjX1ytYBzRAeVzRaAFAfYBnJa4yGrF6h7");


