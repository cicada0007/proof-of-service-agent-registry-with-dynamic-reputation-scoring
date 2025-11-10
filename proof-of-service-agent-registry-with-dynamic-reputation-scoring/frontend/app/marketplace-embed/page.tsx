"use client";

import { useEffect } from "react";
import { AgentCard } from "@/components/AgentCard";
import { useAgentStore } from "@/lib/stores/agentStore";

export default function MarketplaceEmbedPage() {
  const { featuredAgents, loadFeaturedAgents } = useAgentStore();

  useEffect(() => {
    loadFeaturedAgents();
  }, [loadFeaturedAgents]);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="text-center">
          <h1 className="text-lg font-semibold text-slate-200">Agent registry embed</h1>
          <p className="text-xs text-slate-500">
            Drop-in component for marketplaces. Replace with live data once backend endpoints are available.
          </p>
        </header>
        <div className="grid gap-4 md:grid-cols-2">
          {featuredAgents.map((agent) => (
            <AgentCard key={agent.did} agent={agent} />
          ))}
        </div>
      </div>
    </main>
  );
}


