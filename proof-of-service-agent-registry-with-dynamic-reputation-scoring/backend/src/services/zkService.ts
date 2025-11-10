import { generateCid } from "@/utils/cid";
import { logger } from "@/utils/logger";

export interface ProofRequest {
  did: string;
  capabilityHash: string;
}

/**
 * Stub ZK proof generator. Returns a pseudo proof CID to unblock integration.
 */
export async function createSelectiveDisclosureProof(request: ProofRequest): Promise<string> {
  const proofCid = generateCid({ ...request, timestamp: Date.now() });
  logger.debug({ proofCid, did: request.did }, "Generated selective disclosure proof (stub)");
  return proofCid;
}

