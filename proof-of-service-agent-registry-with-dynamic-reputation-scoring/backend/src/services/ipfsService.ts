import { generateCid } from "@/utils/cid";
import { logger } from "@/utils/logger";

export interface AgentMetadataPayload {
  did: string;
  name: string;
  summary?: string;
  endpoint?: string;
  capabilities: Record<string, unknown>;
}

/**
 * Stub IPFS pinning service. In production, replace with actual Pinata/web3.storage requests.
 */
export async function pinAgentMetadata(payload: AgentMetadataPayload): Promise<string> {
  const cid = generateCid({ ...payload, timestamp: Date.now() });
  logger.debug({ cid, did: payload.did }, "Pinned agent metadata (stub)");
  return cid;
}

