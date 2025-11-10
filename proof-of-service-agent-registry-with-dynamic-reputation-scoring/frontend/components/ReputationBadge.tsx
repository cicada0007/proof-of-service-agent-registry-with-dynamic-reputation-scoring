import { cn } from "@/lib/utils/cn";

interface Props {
  score: number;
  variant?: "public" | "zk-selective" | "private";
}

export function ReputationBadge({ score, variant = "public" }: Props) {
  const tier = getTier(score);
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
        tier === "platinum" && "border-solana-green/40 bg-solana-green/20 text-solana-green",
        tier === "gold" && "border-amber-400/40 bg-amber-400/20 text-amber-200",
        tier === "silver" && "border-slate-400/60 bg-slate-400/20 text-slate-200",
        tier === "bronze" && "border-orange-400/40 bg-orange-400/10 text-orange-200"
      )}
    >
      <span>{(score * 100).toFixed(0)} pts</span>
      <span className="uppercase tracking-wide text-slate-200/80">{variant}</span>
    </div>
  );
}

function getTier(score: number) {
  if (score >= 0.9) return "platinum";
  if (score >= 0.8) return "gold";
  if (score >= 0.6) return "silver";
  return "bronze";
}


