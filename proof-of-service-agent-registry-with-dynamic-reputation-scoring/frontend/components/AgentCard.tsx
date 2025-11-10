import { AgentRecord } from "@/lib/types";
import { ReputationBadge } from "@/components/ReputationBadge";
import { Button } from "@/components/ui/Button";

interface Props {
  agent: AgentRecord;
}

export function AgentCard({ agent }: Props) {
  const capabilities = agent.capabilities;
  const skills = capabilities?.skills?.join(", ") ?? "N/A";
  const latency = capabilities ? `${capabilities.latencyMs} ms` : "N/A";
  const endpoint = agent.endpoint ?? "N/A";

  return (
    <article className="flex h-full flex-col justify-between rounded-2xl border border-slate-800 bg-slate-950/60 p-6 shadow-lg">
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-100">{agent.name}</h3>
          <ReputationBadge score={agent.reputation} variant={agent.disclosure} />
        </div>
        <p className="text-sm text-slate-400">{agent.summary ?? "No summary provided yet."}</p>
      </header>

      <section className="mt-4 space-y-2 text-xs text-slate-400">
        <p>
          <span className="font-medium text-slate-300">Skills:</span> {skills}
        </p>
        <p>
          <span className="font-medium text-slate-300">Endpoint:</span> {endpoint}
        </p>
        <p>
          <span className="font-medium text-slate-300">Latency:</span> {latency}
        </p>
      </section>

      <footer className="mt-6 flex items-center justify-between">
        <Button size="sm" variant="outline">
          View details
        </Button>
        <Button size="sm">Hire via x402</Button>
      </footer>
    </article>
  );
}


