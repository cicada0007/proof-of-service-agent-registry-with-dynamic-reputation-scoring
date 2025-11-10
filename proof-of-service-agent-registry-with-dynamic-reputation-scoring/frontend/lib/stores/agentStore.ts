import { create } from "zustand";
import { AgentRecord, AgentRegistrationDraft } from "@/lib/types";

async function apiRequest(path: string, init?: RequestInit) {
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";
  const target = `${baseUrl.replace(/\/$/, "")}${path}`;
  const response = await fetch(target, {
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    },
    ...init
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error?.message ?? response.statusText);
  }

  return response.json();
}

interface AgentStoreState {
  agents: AgentRecord[];
  searchResults: AgentRecord[];
  loading: boolean;
  loadAgents: () => Promise<void>;
  searchAgents: (filters: { skill?: string; minScore?: number }) => Promise<void>;
  registerAgent: (input: {
    draft: AgentRegistrationDraft;
    did: string;
    message: string;
    signature: string;
    ownerPubkey: string;
  }) => Promise<AgentRecord>;
  resetSearch: () => void;
}

export const useAgentStore = create<AgentStoreState>((set, get) => ({
  agents: [],
  searchResults: [],
  loading: false,
  loadAgents: async () => {
    set({ loading: true });
    try {
      const payload = await fetch("/api/agents");
      const json = await payload.json();
      if (!payload.ok) {
        throw new Error(json?.error?.message ?? "Failed to fetch agents");
      }

      set({ agents: json.agents ?? [], loading: false });
    } catch (error) {
      console.error(error);
      set({ loading: false });
    }
  },
  searchAgents: async (filters) => {
    const agents = get().agents;
    const results = agents.filter((agent) => {
      const capability = agent.capabilities;
      const skills = capability?.skills ?? [];
      const matchSkill = filters.skill
        ? skills.some((skill) => skill.toLowerCase().includes(filters.skill!.toLowerCase()))
        : true;
      const matchScore = filters.minScore ? agent.reputation >= filters.minScore : true;
      return matchSkill && matchScore;
    });
    set({ searchResults: results });
  },
  registerAgent: async ({ draft, did, message, signature }) => {
    const payload = {
      did,
      name: draft.name,
      summary: draft.summary,
      endpoint: draft.endpoint,
      disclosure: draft.disclosure,
      metadataCid: draft.metadataCid,
      proofCid: draft.proofCid,
      capabilities: {
        skills: draft.skills,
        successRate: draft.successRate,
        latencyMs: draft.latencyMs
      },
      message,
      signature
    };

    const response = await fetch("/api/agents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result?.error?.message ?? "Registration failed");
    }

    const agent = result.agent as AgentRecord;
    set({ agents: [agent, ...get().agents] });
    return agent;
  },
  resetSearch: () => set({ searchResults: [] })
}));


