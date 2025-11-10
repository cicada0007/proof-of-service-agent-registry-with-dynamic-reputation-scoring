"use client";

import { WalletGate } from "@/components/WalletGate";
import { useAgentStore } from "@/lib/stores/agentStore";
import { useReputationStore } from "@/lib/stores/reputationStore";
import { Button } from "@/components/ui/Button";
import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";

export default function DashboardPage() {
  const { agents, loadAgents } = useAgentStore();
  const { scores, fetchReputation } = useReputationStore();
  const { publicKey } = useWallet();

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const ownedAgents = useMemo(
    () => agents.filter((agent) => agent.ownerPubkey === publicKey?.toBase58()),
    [agents, publicKey]
  );

  useEffect(() => {
    ownedAgents.forEach((agent) => {
      fetchReputation(agent.did).catch((error) => {
        console.error("Failed to fetch reputation", error);
      });
    });
  }, [ownedAgents, fetchReputation]);

  const reputationEvents = ownedAgents
    .flatMap((agent) => {
      const entry = scores[agent.did];
      return (entry?.events ?? []).map((event) => ({
        agent,
        event
      }));
    })
    .sort((a, b) => new Date(b.event.createdAt).getTime() - new Date(a.event.createdAt).getTime());

  return (
    <WalletGate>
      <main className="container mx-auto flex flex-col gap-10 px-4 py-16">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">Agent control center</h1>
          <p className="text-sm text-slate-400">
            Monitor DID-linked assets, pending x402 settlements, and zero-knowledge proof queues. This page
            consumes live registry data once the backend is connected.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-medium">Registered agents</h2>
            <Button asChild size="sm" variant="outline">
              <Link href="/register">Register new agent</Link>
            </Button>
          </div>
          <div className="mt-4 space-y-4">
            {ownedAgents.length === 0 ? (
              <p className="text-sm text-slate-400">
                No agents registered yet. Use the button above to bootstrap your first DID profile.
              </p>
            ) : (
              ownedAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-200"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{agent.name}</p>
                      <p className="text-xs text-slate-400">{agent.did}</p>
                    </div>
                    <span className="rounded bg-solana-purple/10 px-3 py-1 text-xs text-solana-purple">
                      Score {Math.round((scores[agent.did]?.score ?? agent.reputation) * 100)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow">
          <h2 className="text-xl font-medium">Recent reputation events</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-300">
            {reputationEvents.length === 0 ? (
              <li>No reputation events available yet.</li>
            ) : (
              reputationEvents.map(({ agent, event }) => (
                <li key={event.id} className="flex flex-col rounded border border-slate-800 bg-slate-950/60 p-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium text-slate-100">{agent.name}</p>
                    <p className="text-xs text-slate-400">{event.description ?? "No description provided."}</p>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-slate-400 md:mt-0">
                    <span>Δ {(event.delta * 100).toFixed(1)} pts</span>
                    <span>{new Date(event.createdAt).toLocaleString()}</span>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>
      </main>
    </WalletGate>
  );
}


