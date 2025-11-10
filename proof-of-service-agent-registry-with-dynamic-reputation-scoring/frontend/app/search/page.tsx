"use client";

import { FormEvent, useState } from "react";
import { useAgentStore } from "@/lib/stores/agentStore";
import { AgentCard } from "@/components/AgentCard";
import { Button } from "@/components/ui/Button";

export default function SearchPage() {
  const { searchAgents, searchResults, loading, loadAgents } = useAgentStore();
  const [skill, setSkill] = useState("");
  const [minScore, setMinScore] = useState(0.8);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await searchAgents({ skill, minScore });
  };

  return (
    <main className="container mx-auto flex flex-col gap-8 px-4 py-16">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold">Search agents</h1>
        <p className="text-sm text-slate-400">
          Filter by skill taxonomy, reputation thresholds, and velocity metrics. The backing data is mocked but
          mirrors the intended API contract.
        </p>
      </header>

      <form className="flex flex-col gap-4 rounded-xl bg-slate-900 p-6 shadow" onSubmit={onSubmit}>
        <label className="flex flex-col gap-2 text-sm">
          <span>Skill keyword</span>
          <input
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            placeholder="e.g. NLP, auditing"
            value={skill}
            onChange={(event) => setSkill(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span>Minimum reputation (0.0 - 1.0)</span>
          <input
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={minScore}
            onChange={(event) => setMinScore(Number(event.target.value))}
          />
        </label>
        <Button type="submit" disabled={loading}>
          {loading ? "Searching…" : "Run query"}
        </Button>
      </form>

      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {searchResults.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </section>
    </main>
  );
}


