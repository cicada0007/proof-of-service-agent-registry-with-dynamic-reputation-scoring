"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { AgentRegistrationDraft } from "@/lib/types";

interface Props {
  disabled?: boolean;
  onSubmit: (draft: AgentRegistrationDraft) => Promise<void>;
}

export function AgentRegistrationForm({ disabled, onSubmit }: Props) {
  const [draft, setDraft] = useState<AgentRegistrationDraft>({
    name: "",
    summary: "",
    endpoint: "",
    skills: [],
    successRate: 0.9,
    latencyMs: 200,
    disclosure: "zk-selective"
  });
  const [skillsInput, setSkillsInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.name.trim()) {
      setError("Agent name is required");
      return;
    }
    setError(null);
    await onSubmit({ ...draft, skills: parseSkills(skillsInput) });
  };

  return (
    <form className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-8" onSubmit={handleSubmit}>
      <fieldset className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="text-slate-300">Agent name</span>
          <input
            className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            disabled={disabled}
            value={draft.name}
            onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Solana NLP Auditor"
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-slate-300">Primary endpoint (URL or Program ID)</span>
          <input
            className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            disabled={disabled}
            value={draft.endpoint}
            onChange={(event) => setDraft((prev) => ({ ...prev, endpoint: event.target.value }))}
            placeholder="https://api.example.com/v1/tasks"
          />
        </label>
      </fieldset>

      <label className="space-y-2 text-sm">
        <span className="text-slate-300">Summary</span>
        <textarea
          className="h-28 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          disabled={disabled}
          value={draft.summary}
          onChange={(event) => setDraft((prev) => ({ ...prev, summary: event.target.value }))}
          placeholder="Describe capabilities, attestation sources, or privacy guarantees."
        />
      </label>

      <label className="space-y-2 text-sm">
        <span className="text-slate-300">Skills (comma separated)</span>
        <input
          className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          disabled={disabled}
          value={skillsInput}
          onChange={(event) => setSkillsInput(event.target.value)}
          placeholder="NLP, auditing, anomaly detection"
        />
      </label>

      <section className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="text-slate-300">Success rate (0.0 - 1.0)</span>
          <input
            type="number"
            min={0}
            max={1}
            step={0.01}
            className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            disabled={disabled}
            value={draft.successRate}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, successRate: Number(event.target.value) }))
            }
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-slate-300">Latency (ms)</span>
          <input
            type="number"
            min={0}
            className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            disabled={disabled}
            value={draft.latencyMs}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, latencyMs: Number(event.target.value) }))
            }
          />
        </label>
      </section>

      <label className="space-y-2 text-sm">
        <span className="text-slate-300">Disclosure level</span>
        <select
          className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          disabled={disabled}
          value={draft.disclosure}
          onChange={(event) =>
            setDraft((prev) => ({
              ...prev,
              disclosure: event.target.value as AgentRegistrationDraft["disclosure"]
            }))
          }
        >
          <option value="public">Public</option>
          <option value="zk-selective">ZK selective disclosure</option>
          <option value="private">Private (TEE gated)</option>
        </select>
      </label>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      <Button type="submit" disabled={disabled}>
        Submit registration
      </Button>
    </form>
  );
}

function parseSkills(input: string) {
  return input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}


          