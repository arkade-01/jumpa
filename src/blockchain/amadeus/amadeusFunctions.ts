
import { AmadeusSDK, generateKeypair, derivePublicKeyFromSeedBase58, fromAtomicAma, deriveSkAndSeed64FromBase58Seed } from '@amadeus-protocol/sdk'
import { bls12_381 } from "@noble/curves/bls12-381.js";
import { hexToBytes } from "@noble/curves/utils.js";
import bs58 from "bs58";

// Initialize SDK (uses default node URL if not specified)
const sdk = new AmadeusSDK({
  baseUrl: 'https://nodes.amadeus.bot/api'
})

/**
 * Generates a new Amadeus wallet
 */
export async function generateAmadeusWallet() {
  const wallet = generateKeypair();
  console.log("keypair generated", wallet)

  const pubKey = wallet.publicKey;
  console.log("public key", pubKey)

  const privKey = wallet.privateKey;
  console.log("private key", privKey)

  const bal = await sdk.wallet.getBalance(pubKey);
  const balance = fromAtomicAma(bal.balance.flat).toFixed(4);
  console.log("wallet balance", balance)

  return {
    pubKey,
    privKey,
    balance
  }

}

/**
 * Gets the balance of an Amadeus wallet, default token is AMA
 */
export async function getAmadeusBalance(pubKey: string, token?: string) {
  const bal = await sdk.wallet.getBalance(pubKey, token);
  const balance = fromAtomicAma(bal.balance.flat).toFixed(4);
  console.log("wallet balance", balance)


  return balance
}

/**
 * Sign a transaction on amadeus network using the derived secret key
 */

export function signTransaction(signingPayload: string, privateKeyB58: string): string {
  // Derive the actual secret key scalar from the seed
  const { sk } = deriveSkAndSeed64FromBase58Seed(privateKeyB58);
  const blsl = bls12_381.longSignatures;

  const signingHash = hexToBytes(signingPayload);
  const DST = "AMADEUS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_TX_";
  const msgPoint = blsl.hash(signingHash, DST);
  const signature = blsl.sign(msgPoint, sk);
  return bs58.encode(signature.toBytes(true));
}

/**
 * Validates an Amadeus private key
 */
export function validateAmadeusPrivateKey(privKey: string) {
  const pubKey = derivePublicKeyFromSeedBase58(privKey);
  console.log("derived key", pubKey)
  if (pubKey) {
    return { success: true, pubKey };
  }
  return { success: false, pubKey: "" };
}