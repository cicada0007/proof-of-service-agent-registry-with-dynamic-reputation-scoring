"use client";

import { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useMemo } from "react";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { Toaster } from "react-hot-toast";

export function Providers({ children }: { children: ReactNode }) {
  const queryClient = useMemo(() => new QueryClient(), []);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <WalletProvider>
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster position="bottom-right" />
        </QueryClientProvider>
      </WalletProvider>
    </ThemeProvider>
  );
}


