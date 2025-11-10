import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

export function verifySolanaSignature(message: string, signatureBase58: string, expectedPubkey: string) {
  const publicKey = new PublicKey(expectedPubkey);
  const signature = bs58.decode(signatureBase58);
  const messageBytes = Buffer.from(message, "utf8");

  return publicKey.verify(messageBytes, signature);
}

