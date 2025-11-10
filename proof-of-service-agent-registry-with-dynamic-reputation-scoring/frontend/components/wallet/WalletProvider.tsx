"use client";

import { ReactNode, useMemo } from "react";
import { ConnectionProvider, WalletProvider as BaseWalletProvider } from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";

const DEFAULT_NETWORK =
  (process.env.NEXT_PUBLIC_SOLANA_CLUSTER as WalletAdapterNetwork) ?? WalletAdapterNetwork.Devnet;

const DEFAULT_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.devnet.solana.com";

export function WalletProvider({ children }: { children: ReactNode }) {
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={DEFAULT_ENDPOINT}>
      <BaseWalletProvider autoConnect wallets={wallets}>
        {children}
      </BaseWalletProvider>
    </ConnectionProvider>
  );
}


