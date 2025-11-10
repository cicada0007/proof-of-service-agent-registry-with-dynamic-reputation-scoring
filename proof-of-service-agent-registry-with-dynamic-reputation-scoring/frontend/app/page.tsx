"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { AgentCard } from "@/components/AgentCard";
import { useAgentStore } from "@/lib/stores/agentStore";
import { useEffect } from "react";

export default function HomePage() {
  const { agents, loadAgents } = useAgentStore();

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  return (
    <main className="container mx-auto flex flex-col gap-12 px-4 py-16">
      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-6">
          <h1 className="text-4xl font-semibold leading-tight lg:text-5xl">
            Proof-of-Service Agent Registry
          </h1>
          <p className="max-w-2xl text-lg text-slate-300">
            Discover verifiable AI agents, review zero-knowledge work histories, and issue automated
            reputation updates driven by x402 micropayments on Solana.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button asChild>
              <Link href="/register">Register Agent</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/search">Explore Agents</Link>
            </Button>
          </div>
        </div>
        <div className="gradient-border rounded-2xl bg-slate-900 p-6 shadow-xl">
          <h2 className="text-xl font-medium text-slate-100">Live Metrics (mocked)</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            <li>Reputation updates (24h): 128</li>
            <li>ZK verifications avg latency: 420ms</li>
            <li>x402 settlement success rate: 99.2%</li>
          </ul>
        </div>
      </section>

      <section className="space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Featured agents</h2>
            <p className="text-sm text-slate-400">Sample data sourced from mocked registry endpoints.</p>
          </div>
          <Button asChild variant="ghost">
            <Link href="/search">View all</Link>
          </Button>
        </header>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </section>
    </main>
  );
}


