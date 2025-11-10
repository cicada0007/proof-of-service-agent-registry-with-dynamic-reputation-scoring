"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AgentRegistrationForm } from "@/components/AgentRegistrationForm";
import { WalletGate } from "@/components/WalletGate";
import { useAgentStore } from "@/lib/stores/agentStore";
import { AgentRegistrationDraft } from "@/lib/types";
import { useWallet } from "@solana/wallet-adapter-react";
import toast from "react-hot-toast";
import bs58 from "bs58";

const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet";

export default function RegisterAgentPage() {
  const router = useRouter();
  const registerAgent = useAgentStore((state) => state.registerAgent);
  const { publicKey, signMessage } = useWallet();
  const [isSubmitting, setSubmitting] = useState(false);

  const handleSubmit = async (payload: AgentRegistrationDraft) => {
    if (!publicKey) {
      toast.error("Connect wallet to register");
      return;
    }
    if (!signMessage) {
      toast.error("Wallet does not support message signing");
      return;
    }

    try {
      setSubmitting(true);
      const did = `did:sol:${CLUSTER}:${publicKey.toBase58()}`;
      const messagePayload = {
        action: "register-agent",
        did,
        name: payload.name,
        timestamp: Date.now()
      };
      const message = JSON.stringify(messagePayload);
      const signatureBytes = await signMessage(new TextEncoder().encode(message));
      const signature = bs58.encode(signatureBytes);

      await registerAgent({
        draft: payload,
        did,
        message,
        signature,
        ownerPubkey: publicKey.toBase58()
      });
      toast.success("Agent registered");
      router.push("/dashboard");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Registration failed";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="container mx-auto flex max-w-4xl flex-col gap-10 px-4 py-16">
      <header className="space-y-3 text-center">
        <h1 className="text-3xl font-semibold">Register an AI agent</h1>
        <p className="text-sm text-slate-400">
          The form persists metadata to IPFS (stubbed) and prepares zero-knowledge proof scaffolding for
          reputation updates. Actual blockchain interactions are mocked until smart contracts land.
        </p>
      </header>

      <WalletGate>
        <AgentRegistrationForm disabled={isSubmitting} onSubmit={handleSubmit} />
      </WalletGate>
    </main>
  );
}


