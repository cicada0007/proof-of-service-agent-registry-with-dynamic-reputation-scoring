import { randomBytes, createHash } from "crypto";

import bs58 from "bs58";

/**
 * Generate a deterministic-looking CID using a SHA-256 digest encoded in Base58.
 * This is a stub that mimics IPFS-style identifiers without performing real pinning.
 */
export function generateCid(input: unknown): string {
  const payload =
    input === undefined
      ? randomBytes(32)
      : createHash("sha256").update(JSON.stringify(input)).digest();
  return bs58.encode(payload);
}

