# Next.js App Router Structure for Proof-of-Service Agent Registry

This document outlines the Next.js App Router structure for the frontend of the "Proof-of-Service Agent Registry with Dynamic Reputation Scoring" project. Built with Next.js 14+ using the App Router paradigm, this setup leverages TypeScript for type safety, TailwindCSS for responsive styling, and Zustand for lightweight state management (e.g., handling wallet connections, agent data caching, and reputation scores). The structure is designed to support key project features: decentralized AI agent registration, capability profiling, verifiable work history queries, dynamic reputation scoring tied to x402 payments, and privacy-focused interactions via Solana DIDs and ZKPs.

The app integrates with the backend (Node.js/Express APIs for off-chain queries, Prisma for PostgreSQL-based caching of on-chain data) and Solana ecosystem (e.g., @solana/web3.js for wallet interactions, Anchor for program calls). Off-chain elements like IPFS-pinned agent profiles (via compressed NFTs) are fetched via API endpoints coordinated with BackendDev. x402 micropayments (SOL/USDC) are handled through API hooks that trigger escrow releases and reputation updates, with frontend UI for payment modals.

All routes are server-rendered where possible for SEO (e.g., public agent listings), with client-side interactivity for authenticated actions (e.g., registration via wallet signature). Error boundaries, loading skeletons, and metadata are implemented project-wide for production readiness.

## Project Setup and Dependencies

Install core dependencies via npm/yarn:

```bash
npm install next@latest react@latest react-dom@latest typescript @types/react @types/node
npm install tailwindcss postcss autoprefixer @tailwindcss/typography
npm install zustand @solana/web3.js @coral-xyz/anchor @project-serum/anchor
npm install prisma @prisma/client # For backend data caching
npm install lucide-react # Icons for UI components
npm install next-themes # For dark mode support in agent dashboards
```

Configure `tailwind.config.js` for custom themes (e.g., Solana-inspired colors: slate for backgrounds, emerald for reputation badges):

```js
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        solana: {
          green: '#14F195',
          blue: '#9945FF',
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
```

Zustand store example for global state (e.g., `lib/stores/agentStore.ts`):

```ts
import { create } from 'zustand';

interface AgentState {
  connectedWallet: string | null;
  agents: Array<{ id: string; reputation: number; capabilities: string[] }>;
  fetchAgents: () => Promise<void>;
  registerAgent: (capabilities: string[]) => Promise<void>;
}

export const useAgentStore = create<AgentState>((set) => ({
  connectedWallet: null,
  agents: [],
  fetchAgents: async () => {
    // API call to backend for querying Solana-indexed agents
    const res = await fetch('/api/agents');
    const data = await res.json();
    set({ agents: data });
  },
  registerAgent: async (capabilities) => {
    // Solana transaction via Anchor for DID-linked profile
    // Update state on success, trigger IPFS pin via backend
  },
}));
```

Root `app/layout.tsx` includes global providers (e.g., ThemeProvider, WalletAdapterProvider for Solana):

```tsx
import { Inter } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const network = WalletAdapterNetwork.Mainnet;
  const endpoint = 'https://api.mainnet-beta.solana.com';
  const wallets = [new PhantomWalletAdapter()];

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ConnectionProvider endpoint={endpoint}>
          <WalletProvider wallets={wallets} autoConnect>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
              <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
                {children}
              </main>
            </ThemeProvider>
          </WalletProvider>
        </ConnectionProvider>
      </body>
    </html>
  );
}
```

Metadata in `app/layout.tsx` for SEO-optimized agent discovery:

```tsx
export const metadata = {
  title: 'Proof-of-Service Agent Registry',
  description: 'Decentralized registry for AI agents with dynamic reputation scoring via Solana and x402.',
  openGraph: {
    title: 'Agent Registry',
    description: 'Build trust in AI ecosystems.',
    images: ['/og-image.png'],
  },
};
```

## App Directory Structure

The App Router uses file-based routing in the `app/` directory. Folders are auto-routed (e.g., `app/agents/page.tsx` → `/agents`). Parallel routes for dashboards (e.g., `@dashboard`), loading/error files for UX, and API routes in `app/api/` for serverless endpoints (coordinated with BackendDev for proxying Solana queries and x402 hooks).

```
app/
├── (auth)/                    # Parallel route group for authenticated layouts
│   ├── dashboard/
│   │   ├── page.tsx           # /dashboard - User-specific agent management
│   │   ├── loading.tsx        # Skeleton for reputation updates
│   │   └── error.tsx          # Error boundary for transaction failures
│   └── layout.tsx             # Shared auth layout with wallet connect
├── agents/                    # Core route for agent discovery
│   ├── [id]/                  # Dynamic route for single agent profile
│   │   ├── page.tsx           # /agents/[id] - View capabilities, history, ZKP proofs
│   │   ├── reputation/
│   │   │   └── page.tsx       # /agents/[id]/reputation - Dynamic score with x402 history
│   │   └── loading.tsx
│   ├── page.tsx               # /agents - Paginated list with filters (skills, reputation)
│   ├── new/                   # Registration flow
│   │   └── page.tsx           # /agents/new - Form for DID-linked capabilities
│   └── layout.tsx             # Agents-specific layout with search bar
├── api/                       # API Routes (Serverless, integrates with BackendDev)
│   ├── agents/
│   │   ├── route.ts           # GET/POST for querying/registering agents (Prisma + Solana RPC)
│   │   └── [id]/
│   │       └── route.ts       # GET agent by ID, including IPFS metadata
│   ├── reputation/
│   │   └── route.ts           # POST for updating scores post-x402 settlement
│   ├── x402/
│   │   └── route.ts           # Proxy for HTTP 402 micropayments (SOL/USDC escrow)
│   └── zk-proof/
│       └── route.ts           # Verify ZKPs for work history (off-chain via TEEs)
├── register/                  # Entry point for agent onboarding
│   ├── capabilities/
│   │   └── page.tsx           # /register/capabilities - Multi-step form for skills/metrics/endpoints
│   ├── did/
│   │   └── page.tsx           # /register/did - Solana DID creation with revocable keys
│   └── page.tsx               # /register - Landing with wallet connect
├── globals.css                # Tailwind imports + custom styles (e.g., reputation badges)
├── layout.tsx                 # Root layout (as above)
├── loading.tsx                # Global loading UI (e.g., spinner for Solana txns)
├── error.tsx                  # Global error page
├── page.tsx                   # / - Home: Hero with project overview, featured high-rep agents
└── not-found.tsx              # 404 for invalid agent IDs
```

### Key Routes and Components Breakdown

#### Home Route (`app/page.tsx`)
Public landing page emphasizing the "credit bureau for AI agents" concept. Server-side fetches top agents via API for initial render.

```tsx
import { fetchTopAgents } from '@/lib/api'; // BackendDev-coordinated fetch
import AgentCard from '@/components/AgentCard';
import Hero from '@/components/Hero';

export default async function Home() {
  const topAgents = await fetchTopAgents({ limit: 6, minReputation: 80 });

  return (
    <div className="container mx-auto px-4 py-8">
      <Hero />
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
        {topAgents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </section>
    </div>
  );
}
```

- **Components**: `Hero.tsx` (explains features: registration, ZKP verification, x402 integration). `AgentCard.tsx` (displays reputation badge, skills teaser, link to `/agents/[id]`).

#### Agent Discovery (`app/agents/page.tsx`)
Paginated, filterable list for developers/marketplaces. Client-side filtering with Zustand for search state. Integrates Switchboard oracles for real-time reputation via WebSockets (if BackendDev exposes).

Uses `useAgentStore` for caching. Supports embeddings for marketplaces (e.g., iframe-friendly).

```tsx
'use client';
import { useState, useEffect } from 'react';
import { useAgentStore } from '@/lib/stores/agentStore';
import AgentList from '@/components/AgentList';
import Filters from '@/components/Filters'; // Skills (NLP, auditing), reputation range

export default function AgentsPage() {
  const { agents, fetchAgents } = useAgentStore();
  const [filters, setFilters] = useState({ skills: [], minRep: 0 });

  useEffect(() => {
    fetchAgents();
  }, []);

  const filteredAgents = agents.filter((agent) => 
    filters.skills.every(skill => agent.capabilities.includes(skill)) &&
    agent.reputation >= filters.minRep
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <Filters onChange={setFilters} />
      <AgentList agents={filteredAgents} />
    </div>
  );
}
```

- **Privacy Note**: Reputation badges are public; detailed histories use ZK selective disclosure (button triggers ZKP verification modal).

#### Agent Profile (`app/agents/[id]/page.tsx`)
Dynamic route for detailed view. Server component fetches agent data (Solana DID profile + IPFS metadata). Client components for actions like hiring (triggers x402 payment flow).

```tsx
import { fetchAgentById } from '@/lib/api';
import CapabilitiesTable from '@/components/CapabilitiesTable';
import ReputationChart from '@/components/ReputationChart'; // Dynamic scoring visualization
import ZKProofVerifier from '@/components/ZKProofVerifier';

interface Props { params: { id: string }; }

export default async function AgentProfile({ params }: Props) {
  const agent = await fetchAgentById(params.id);

  if (!agent) return <div>Agent not found</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">{agent.name}</h1>
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
        <ReputationChart scores={agent.history} />
        <CapabilitiesTable capabilities={agent.capabilities} />
        <ZKProofVerifier proofs={agent.zkProofs} /> {/* For verifiable history */}
      </div>
    </div>
  );
}
```

- **x402 Integration**: "Hire Agent" button opens modal for micropayment, calling `/api/x402` to handle escrow and auto-update reputation.

#### Registration Flow (`app/register/page.tsx` and sub-routes)
Multi-step form for agent owners (developers). Steps: Connect wallet → Create Solana DID → Define capabilities (skills, metrics, endpoints) → Pin to IPFS via compressed NFT → Submit Anchor program call.

Uses client-side state for form progression. Privacy: Selective disclosure checkboxes for history sharing.

Example step (`app/register/capabilities/page.tsx`):

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAgentStore } from '@/lib/stores/agentStore';

export default function CapabilitiesStep() {
  const [capabilities, setCapabilities] = useState({ skills: [], metrics: {}, endpoints: [] });
  const router = useRouter();
  const { registerAgent } = useAgentStore();

  const handleSubmit = async () => {
    await registerAgent(capabilities.skills);
    router.push('/dashboard');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Inputs for NLP, auditing skills; success rate slider; API URL fields */}
      <button type="submit" className="bg-solana-green text-white px-6 py-2 rounded">
        Register Agent
      </button>
    </form>
  );
}
```

#### Dashboard (`app/(auth)/dashboard/page.tsx`)
Authenticated route (parallel group with auth guard). Views personal agents, work history, reputation trends. Integrates TEEs for private data (fetched via encrypted API).

- Features: List owned agents, pending x402 settlements, ZKP generation for proofs.

#### API Routes (`app/api/`)
Serverless handlers proxying to BackendDev (e.g., Express endpoints for Prisma queries). Examples:

- `app/api/agents/route.ts`: GET lists agents (filtered by reputation), POST registers (validates Solana sig, pins IPFS).
- `app/api/x402/route.ts`: Handles 402 responses, integrates with Solana for USDC transfers, updates reputation on-chain.
- Security: Rate limiting, wallet verification via signatures.

## Additional Production Considerations

- **Performance**: Use `generateStaticParams` for static agent pages (pre-render high-rep agents). Streaming for dynamic lists.
- **Accessibility**: ARIA labels for reputation charts; keyboard-navigable forms.
- **Testing**: Folder `tests/` with Jest/RTL for components (e.g., test AgentCard renders ZKP badge).
- **Deployment**: Vercel-friendly (auto-deploys from Git). Env vars for Solana RPC, IPFS gateway.
- **Integration Points**:
  - BackendDev: APIs for `/api/agents` (Prisma queries mirror Solana data).
  - ProductManager: UI aligns with features like end-user swarm selection (e.g., multi-agent hiring modal).
  - Uniqueness: This structure emphasizes Solana-native elements (e.g., wallet-first UX) and privacy (ZK modals), distinct from generic registries.

This structure ensures a scalable, user-centric frontend tailored to the decentralized AI agent ecosystem. For updates, coordinate with BackendDev on API contracts.