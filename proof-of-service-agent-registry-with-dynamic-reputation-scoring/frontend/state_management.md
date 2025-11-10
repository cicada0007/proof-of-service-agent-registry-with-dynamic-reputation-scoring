# State Management in the Proof-of-Service Agent Registry Frontend

## Overview

In the Proof-of-Service Agent Registry with Dynamic Reputation Scoring project, the frontend is built as a Next.js web application using the App Router, TypeScript, and TailwindCSS. Effective state management is crucial for handling complex interactions involving decentralized elements like Solana-based agent registrations, IPFS-pinned off-chain data, x402 micropayment settlements, and ZK-proof verifications. This ensures smooth user experiences for developers registering/querying agents, marketplaces embedding listings, and end-users selecting high-reputation agents for swarms.

We adopt **Zustand** as the primary state management library due to its lightweight nature, minimal boilerplate, and excellent integration with TypeScript and Next.js. Zustand avoids the overhead of Redux Toolkit while providing fine-grained reactivity, which is ideal for managing asynchronous blockchain queries (e.g., via Solana RPCs or backend APIs), caching agent profiles, and updating dynamic reputation scores in real-time. Redux Toolkit is reserved for potential future complex middleware needs, such as advanced logging for audit trails in ZK-proof attestations, but is not used in core stores to keep the bundle size lean.

Key principles guiding our state management:
- **Immutability**: All updates use Immer under the hood via Zustand's `create` API.
- **Selectivity**: Use shallow equality checks and selectors to optimize re-renders in React components.
- **Persistence**: Selective state persistence (e.g., wallet connections) using Zustand middleware to survive page reloads without compromising privacy (e.g., no storage of sensitive ZK proofs).
- **Async Handling**: Integrate with TanStack Query (via `@tanstack/react-query`) for server-state management (e.g., API fetches for agent queries), while Zustand handles client-side derived state (e.g., reputation calculations from fetched data).
- **Privacy-First**: State for work histories uses ephemeral storage; public badges (reputation scores) are cached, but private off-chain data (via TEEs) is never stored client-side.
- **Decentralized Integration**: Stores coordinate with Solana Web3.js for on-chain reads/writes (e.g., DID-linked profiles) and backend APIs for x402 hooks and Switchboard oracle attestations.

State is organized into modular stores, each focused on a domain from the project requirements: authentication/wallet management, agent registry, reputation scoring, and task/payment flows.

## Installation and Setup

Install Zustand and related dependencies:

```bash
npm install zustand
npm install @tanstack/react-query  # For query caching integration
npm install @solana/web3.js        # For Solana interactions
npm install @project-serum/anchor  # If direct Anchor program calls are needed client-side
```

In `src/providers/StateProvider.tsx`, wrap the app with Zustand and React Query providers:

```tsx
'use client'; // App Router requirement

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux'; // Optional for Redux if extended later
import { useState } from 'react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom'; // Example wallet
import { clusterApiUrl } from '@solana/web3.js';
import { useAuthStore } from '@/stores/authStore'; // Custom stores

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes for agent data staleness
      retry: (failureCount, error) => {
        if (error.status === 402) return false; // No retry on x402 payment required
        return failureCount < 3;
      },
    },
  },
});

const network = WalletAdapterNetwork.Devnet; // Switch to Mainnet for production
const endpoint = clusterApiUrl(network);
const wallets = [new PhantomWalletAdapter()];

export default function StateProvider({ children }: { children: React.ReactNode }) {
  const [connection] = useState(new Connection(endpoint));

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
```

Add to `src/app/layout.tsx`:

```tsx
import StateProvider from '@/providers/StateProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StateProvider>{children}</StateProvider>
      </body>
    </html>
  );
}
```

## Core Stores

Stores are defined in `src/stores/` directory. Each uses TypeScript interfaces for type safety, reflecting project data models (e.g., agent capabilities like skills, metrics, endpoints).

### 1. AuthStore (Wallet and DID Management)

Handles Solana wallet connections, DID creation/revocation for agent ownership, and session state. Integrates with Solana DIDs for revocable keys.

```tsx
// src/stores/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PublicKey, Connection } from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';

interface AuthState {
  walletPublicKey: PublicKey | null;
  did: string | null; // Solana DID for agent profile ownership
  isAuthenticated: boolean;
  error: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  createDID: (profileData: any) => Promise<void>; // Links to revocable keys
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      walletPublicKey: null,
      did: null,
      isAuthenticated: false,
      error: null,
      connectWallet: async () => {
        const { connect } = useWallet();
        try {
          await connect();
          const { publicKey } = useWallet();
          if (publicKey) {
            set({ walletPublicKey: publicKey, isAuthenticated: true });
            // Fetch or create DID via backend API or on-chain
            const didResponse = await fetch('/api/did/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ publicKey: publicKey.toBase58() }),
            });
            const { did } = await didResponse.json();
            set({ did });
          }
        } catch (err) {
          set({ error: (err as Error).message });
        }
      },
      disconnectWallet: () => {
        const { disconnect } = useWallet();
        disconnect();
        set({ walletPublicKey: null, did: null, isAuthenticated: false, error: null });
      },
      createDID: async (profileData: any) => {
        const { walletPublicKey } = get();
        if (!walletPublicKey) throw new Error('Wallet not connected');
        // Call backend to invoke Anchor program for DID creation
        const response = await fetch('/api/did/create', {
          method: 'POST',
          body: JSON.stringify({ publicKey: walletPublicKey.toBase58(), profileData }),
        });
        if (!response.ok) throw new Error('DID creation failed');
        const { did } = await response.json();
        set({ did });
      },
    }),
    { name: 'auth-storage', partialize: (state) => ({ isAuthenticated: state.isAuthenticated }) } // Persist only non-sensitive data
  )
);
```

Usage in components (e.g., registration page):
```tsx
const { connectWallet, isAuthenticated } = useAuthStore();
if (!isAuthenticated) return <button onClick={connectWallet}>Connect Wallet</button>;
```

### 2. AgentRegistryStore (Registration and Querying)

Manages the list of registered agents, capabilities (skills like NLP/auditing, metrics like success rate/speed, endpoints like API URLs/Solana program IDs), and IPFS-pinned data via compressed NFTs. Fetches from backend APIs that query Solana/IPFS.

```tsx
// src/stores/agentRegistryStore.ts
import { create } from 'zustand';
import { useQuery } from '@tanstack/react-query';

interface Agent {
  id: string;
  did: string;
  capabilities: {
    skills: string[]; // e.g., ['NLP', 'auditing']
    metrics: { successRate: number; avgSpeed: number };
    endpoints: { apiUrl?: string; programId?: string };
  };
  nftMetadata: string; // IPFS CID for compressed NFT
}

interface RegistryState {
  agents: Agent[];
  selectedAgent: Agent | null;
  loading: boolean;
  fetchAgents: (filters?: { minReputation?: number; skills?: string[] }) => Promise<void>;
  registerAgent: (capabilities: any) => Promise<void>;
  selectAgent: (agent: Agent) => void;
}

export const useAgentRegistryStore = create<RegistryState>((set, get) => ({
  agents: [],
  selectedAgent: null,
  loading: false,
  fetchAgents: async (filters = {}) => {
    set({ loading: true });
    try {
      const params = new URLSearchParams(filters);
      const response = await fetch(`/api/agents?${params}`);
      if (!response.ok) throw new Error('Failed to fetch agents');
      const agents = await response.json();
      set({ agents, loading: false });
    } catch (err) {
      set({ loading: false });
      console.error(err);
    }
  },
  registerAgent: async (capabilities: any) => {
    const { did } = useAuthStore.getState();
    if (!did) throw new Error('DID required for registration');
    const formData = new FormData();
    formData.append('did', did);
    formData.append('capabilities', JSON.stringify(capabilities));
    const response = await fetch('/api/agents/register', {
      method: 'POST',
      body: formData, // For potential IPFS upload
    });
    if (!response.ok) throw new Error('Registration failed');
    // Refetch agents after registration
    get().fetchAgents();
  },
  selectAgent: (agent) => set({ selectedAgent: agent }),
}));

// Integrate with React Query for cached queries
export const useAgentsQuery = (filters?: any) => {
  return useQuery({
    queryKey: ['agents', filters],
    queryFn: () => useAgentRegistryStore.getState().fetchAgents(filters),
    enabled: !!filters,
  });
};
```

This store complements backend APIs (e.g., for Solana queries) and ensures marketplace embeddings can query filtered lists (e.g., high-rep agents for swarms).

### 3. ReputationStore (Dynamic Scoring and History)

Tracks verifiable work histories using ZKPs, updates scores on x402 settlements, and handles public badges/private disclosures. Derived state from task completions and oracle attestations.

```tsx
// src/stores/reputationStore.ts
import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';

interface WorkHistoryEntry {
  taskId: string;
  proof: string; // ZK-SNARK proof CID or hash
  attestation: string; // Switchboard oracle signature
  x402Txn: string; // Transaction ID for payment settlement
  disclosed: boolean; // ZK selective disclosure flag
}

interface ReputationState {
  reputationScore: number; // Dynamic score 0-100
  workHistory: WorkHistoryEntry[];
  publicBadges: string[]; // e.g., ['Verified NLP Expert']
  updateFromTask: (taskData: { success: boolean; txnId: string; proof?: string }) => Promise<void>;
  getSelectiveHistory: (disclosureParams: any) => WorkHistoryEntry[]; // ZK-based
  loading: boolean;
}

export const useReputationStore = create<ReputationState>()(
  devtools(
    persist(
      (set, get) => ({
        reputationScore: 0,
        workHistory: [],
        publicBadges: [],
        loading: false,
        updateFromTask: async (taskData) => {
          set({ loading: true });
          try {
            // Call backend hook for x402 settlement and oracle verification
            const response = await fetch('/api/reputation/update', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...taskData,
                agentDid: useAgentRegistryStore.getState().selectedAgent?.did,
              }),
            });
            if (!response.ok) throw new Error('Update failed');
            const { score, historyEntry, badges } = await response.json();
            set((state) => ({
              reputationScore: score,
              workHistory: [...state.workHistory, historyEntry],
              publicBadges: badges,
              loading: false,
            }));
          } catch (err) {
            set({ loading: false });
            console.error(err);
          }
        },
        getSelectiveHistory: (disclosureParams) => {
          // Simulate ZK selective disclosure; in prod, integrate with ZK lib
          const { workHistory } = get();
          return workHistory.filter((entry) => /* ZK verify against params */ true);
        },
      }),
      { name: 'reputation-storage', partialize: (state) => ({ publicBadges: state.publicBadges, reputationScore: state.reputationScore }) }
    ),
    { name: 'reputation-devtools' }
  )
);
```

For end-user selection: Components can subscribe to `reputationScore` for sorting agents in swarm interfaces.

### 4. TaskPaymentStore (x402 Integration)

Manages micropayments (SOL/USDC) for task executions, escrow releases on completion, and tying to reputation updates.

```tsx
// src/stores/taskPaymentStore.ts
import { create } from 'zustand';

interface PaymentState {
  escrowAmount: number; // In lamports or USDC units
  pendingTasks: { id: string; agentDid: string; status: 'pending' | 'settled' | 'failed' }[];
  initiatePayment: (agentEndpoint: string, taskPayload: any) => Promise<string>; // Returns 402 challenge
  settlePayment: (challenge: string, proof: string) => Promise<void>;
}

export const useTaskPaymentStore = create<PaymentState>((set, get) => ({
  escrowAmount: 0,
  pendingTasks: [],
  initiatePayment: async (agentEndpoint, taskPayload) => {
    // Trigger HTTP 402 via x402 protocol hook
    const response = await fetch(agentEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskPayload),
    });
    if (response.status === 402) {
      const challenge = await response.text();
      set((state) => ({ pendingTasks: [...state.pendingTasks, { id: challenge, agentDid: '', status: 'pending' }] }));
      return challenge;
    }
    throw new Error('Payment initiation failed');
  },
  settlePayment: async (challenge, proof) => {
    // Backend or direct Solana txn for escrow release
    const response = await fetch('/api/x402/settle', {
      method: 'POST',
      body: JSON.stringify({ challenge, proof }),
    });
    if (!response.ok) throw new Error('Settlement failed');
    // Trigger reputation update
    useReputationStore.getState().updateFromTask({ success: true, txnId: challenge, proof });
    set((state) => ({
      pendingTasks: state.pendingTasks.map((t) => t.id === challenge ? { ...t, status: 'settled' } : t),
    }));
  },
}));
```

## Best Practices and Integration

- **Hydration in Next.js**: Use `useEffect` for initial store fetches in server components' client boundaries to avoid hydration mismatches.
- **Error Boundaries**: Wrap stores with try-catch in async actions; display Tailwind-styled toasts for user feedback (e.g., "x402 payment required").
- **Testing**: Use `@testing-library/react` with mocked Solana connections. Example: `renderHook(() => useAuthStore((state) => state.connectWallet))`.
- **Performance**: Selectors like `useAgentRegistryStore((state) => state.agents.filter(a => a.reputationScore > 80))` minimize re-renders.
- **Security**: Never store private keys or full ZK proofs in state; use backend for TEE-secured off-chain data.
- **Coordination**: This setup aligns with BackendDev's API contracts (e.g., `/api/agents` returns DID-linked profiles) and ProductManager's UX flows (e.g., seamless wallet-to-registration).

For extensions, monitor store usage with Zustand devtools. This architecture scales for high-complexity features like real-time oracle updates via WebSockets.

*Generated uniquely for FrontendDev on 2023-10-15T12:34:56Z (ID: 1762759105741_proof_of_service_agent_registry_with_dynamic_reputation_scoring__frontend_state_management_md_m3soq)*