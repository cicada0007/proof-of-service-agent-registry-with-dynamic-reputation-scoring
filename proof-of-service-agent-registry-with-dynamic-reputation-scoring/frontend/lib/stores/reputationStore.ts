import { create } from "zustand";

export interface ReputationEvent {
  id: string;
  delta: number;
  reference: string;
  description?: string | null;
  createdAt: string;
}

interface ReputationStoreState {
  scores: Record<string, { score: number; events: ReputationEvent[] }>;
  fetchReputation: (did: string) => Promise<void>;
}

export const useReputationStore = create<ReputationStoreState>((set, get) => ({
  scores: {},
  fetchReputation: async (did: string) => {
    const response = await fetch(`/api/reputation/${encodeURIComponent(did)}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message ?? "Failed to load reputation");
    }
    const events: ReputationEvent[] = (data.events ?? []).map((event: any) => ({
      id: event.id,
      delta: event.delta,
      reference: event.reference,
      description: event.description,
      createdAt: event.createdAt
    }));
    set({
      scores: {
        ...get().scores,
        [did]: {
          score: data.score ?? 0,
          events
        }
      }
    });
  }
}));
