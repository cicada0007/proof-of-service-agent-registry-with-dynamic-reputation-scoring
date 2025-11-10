import "@/app/globals.css";
import { Metadata } from "next";
import { ReactNode } from "react";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "Proof-of-Service Agent Registry",
  description: "Decentralized trust layer for AI agents powered by Solana, ZKPs, and x402 micropayments."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}


