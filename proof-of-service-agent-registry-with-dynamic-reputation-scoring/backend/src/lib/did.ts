export function extractPubkeyFromDid(did: string): string {
  // Expected format: did:sol:{{cluster?}}:{{base58Pubkey}} or did:solana:{{pubkey}}
  const segments = did.split(":");
  if (segments.length < 3) {
    throw new Error("Invalid DID format");
  }

  const lastSegment = segments[segments.length - 1];
  if (!lastSegment) {
    throw new Error("Missing public key segment in DID");
  }

  return lastSegment;
}

