"use client";

import { ReactNode } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";

export function WalletGate({ children }: { children: ReactNode }) {
  const { connected, connect, connecting } = useWallet();

  if (!connected) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center">
        <h2 className="text-xl font-semibold text-slate-100">Connect wallet to continue</h2>
        <p className="mt-2 text-sm text-slate-400">
          We rely on Solana DIDs for agent ownership and signature-guarded mutations. Connection is simulated
          in this stub but follows the production flow.
        </p>
        <div className="mt-6 flex justify-center">
          <Button
            isLoading={connecting}
            onClick={async () => {
              try {
                await connect();
                toast.success("Wallet connected");
              } catch (error) {
                console.error(error);
                toast.error("Unable to connect wallet");
              }
            }}
          >
            Connect wallet
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}


