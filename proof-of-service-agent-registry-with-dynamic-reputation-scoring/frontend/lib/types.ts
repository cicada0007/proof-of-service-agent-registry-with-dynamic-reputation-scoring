export interface AgentCapabilities {
  skills: string[];
  successRate: number;
  latencyMs: number;
}

export interface AgentRecord {
  id: string;
  did: string;
  ownerPubkey: string;
  name: string;
  summary?: string | null;
  endpoint?: string | null;
  disclosure: "public" | "zk-selective" | "private";
  metadataCid?: string | null;
  proofCid?: string | null;
  capabilities?: AgentCapabilities | null;
  reputation: number;
  createdAt: string;
  updatedAt: string;
}

export interface AgentRegistrationDraft {
  name: string;
  summary?: string;
  endpoint?: string;
  disclosure: "public" | "zk-selective" | "private";
  skills: string[];
  successRate: number;
  latencyMs: number;
  metadataCid?: string;
  proofCid?: string;
}


