# Frontend Component Library: Proof-of-Service Agent Registry

## Overview

This document specifies the component library for the "Proof-of-Service Agent Registry with Dynamic Reputation Scoring" web application. Built with Next.js (App Router), TailwindCSS, TypeScript, and state management via Zustand, the library focuses on creating a secure, intuitive interface for AI agent registration, discovery, and verification. Components emphasize Solana wallet integration for DID-linked profiles, visual representations of dynamic reputation scores, ZK-proof verifications, and x402 micropayment hooks.

The library is modular, reusable, and optimized for the target audience: developers registering/querying agents, AI marketplaces embedding listings, and end-users selecting high-reputation agents for swarms. All components are responsive, accessible (WCAG 2.1 compliant), and integrate with backend APIs (e.g., via Prisma/Express for on-chain queries to Solana Anchor programs and IPFS data fetching).

Key design principles:
- **Privacy-First UI**: Selective disclosure via ZKPs (e.g., badges showing verified metrics without full history).
- **Decentralized UX**: Prominent Solana wallet connect for agent ownership and revocable keys.
- **Dynamic Feedback**: Real-time updates for reputation scores post-x402 settlements (e.g., via WebSocket hooks to Switchboard oracles).
- **Off-Chain Efficiency**: IPFS-pinned data loaded lazily to avoid blockchain bloat.

Components are organized into categories: Layout & Navigation, Forms & Inputs, Cards & Displays, Modals & Overlays, and Utility. Each includes props interfaces, usage examples, and integration notes with backend (e.g., API contracts for agent queries).

**Unique Identifier**: 1762759105701_proof_of_service_agent_registry_with_dynamic_reputation_scoring__frontend_components_md_vyjb8s

**Version**: 1.0.0 (Initial production spec aligned with Solana/IPFS/x402 stack)

## Layout & Navigation Components

### AppLayout
A full-page wrapper providing consistent structure with sidebar navigation for registered agents, search bar, and wallet status.

**Props Interface** (TypeScript):
```typescript
interface AppLayoutProps {
  children: React.ReactNode;
  sidebarItems?: { label: string; href: string; icon?: React.ComponentType }[];
  walletConnected?: boolean;
  reputationScore?: number; // Dynamic score from x402 settlements
  onWalletConnect?: () => void;
}
```

**Description**: Handles responsive layout with TailwindCSS grid. Sidebar includes links to "Register Agent", "My Profile", "Search Agents", and "Marketplace Embed". Displays a floating reputation badge updated via Zustand store from backend oracle feeds.

**Usage Example**:
```tsx
import { AppLayout } from '@/components/layout/AppLayout';

export default function Dashboard() {
  return (
    <AppLayout 
      walletConnected={true} 
      reputationScore={85.7}
      sidebarItems={[
        { label: 'Register Agent', href: '/register' },
        { label: 'Search Agents', href: '/search' }
      ]}
      onWalletConnect={connectSolanaWallet}
    >
      <div>Dashboard content</div>
    </AppLayout>
  );
}
```

**Backend Integration**: Subscribes to `/api/agent/reputation` WebSocket for real-time score updates post-task completion. Uses Solana Web3.js for wallet state.

### SearchHeader
A sticky header with agent query input, filters for skills (e.g., NLP, auditing), and reputation thresholds.

**Props Interface**:
```typescript
interface SearchHeaderProps {
  onSearch: (query: string, filters: AgentFilters) => void;
  initialFilters?: AgentFilters; // { skills: string[], minReputation: number, chain: 'solana' }
}
```

**Description**: Integrates with IPFS for off-chain capability previews. Filters leverage ZK-selective disclosure to show aggregated metrics without revealing private histories.

**Usage Example**:
```tsx
<SearchHeader 
  onSearch={handleAgentSearch}
  initialFilters={{ minReputation: 80, skills: ['NLP'] }}
/>
```

**Backend Integration**: Triggers GET `/api/agents/search` with query params, returning compressed NFT-linked profiles from Solana.

## Forms & Inputs Components

### AgentRegistrationForm
Multi-step form for registering agent capabilities, endpoints, and DID-linked profiles.

**Props Interface**:
```typescript
interface AgentRegistrationFormProps {
  onSubmit: (formData: AgentRegistrationData) => Promise<void>;
  initialData?: Partial<AgentRegistrationData>; // { skills: string[], metrics: { successRate: number }, endpoints: string[] }
  walletAddress?: string; // From Solana connect
}
```

**Description**: Steps include: 1) Basic info (name, description), 2) Capabilities (skills dropdown, metrics sliders for success rate/speed), 3) Endpoints (API URLs, Solana program IDs), 4) Privacy setup (ZK disclosure toggles, TEE opt-in). Validates with Zod schema, submits to IPFS pinning then on-chain via Anchor.

**Usage Example**:
```tsx
<AgentRegistrationForm 
  onSubmit={async (data) => {
    await fetch('/api/agent/register', { method: 'POST', body: JSON.stringify(data) });
  }}
  walletAddress={publicKey.toString()}
/>
```

**Backend Integration**: POST `/api/agent/register` handles IPFS upload, ZKP generation (zk-SNARKs for initial metrics), and Solana transaction for DID creation with revocable keys.

### ReputationVerifierInput
Input for verifying work history proofs, supporting ZKP uploads or oracle attestations.

**Props Interface**:
```typescript
interface ReputationVerifierInputProps {
  onVerify: (proof: ZKProof | OracleAttestation) => Promise<boolean>;
  supportedTypes: ('zk-snark' | 'switchboard' | 'x402-txn')[];
}
```

**Description**: File upload for ZK proofs or input for x402 txn hashes. Visualizes verification status with animated badges (e.g., green check for successful escrow release).

**Usage Example**:
```tsx
<ReputationVerifierInput 
  onVerify={verifyProof}
  supportedTypes={['zk-snark', 'x402-txn']}
/>
```

**Backend Integration**: POST `/api/proof/verify` integrates with Switchboard for off-chain validation and x402 hooks for payment proofs.

## Cards & Displays Components

### AgentCard
Compact card for displaying agent profiles in search results or marketplace listings.

**Props Interface**:
```typescript
interface AgentCardProps {
  agent: AgentProfile; // { id: string, name: string, reputation: number, skills: string[], endpoints: string[], workHistorySummary: ZKSummary }
  onSelect: (agentId: string) => void;
  showFullHistory?: boolean; // Triggers ZK disclosure modal
  embedMode?: boolean; // For marketplace iframes
}
```

**Description**: Features reputation score as a dynamic radial progress bar (Tailwind + CSS animations), skill badges, endpoint QR codes for quick API access, and a "Select for Swarm" button. Privacy: Shows public badges only; private details via TEE-secured modals.

**Usage Example**:
```tsx
<AgentCard 
  agent={fetchedAgent}
  onSelect={addToSwarm}
  showFullHistory={false}
/>
```

**Backend Integration**: Fetches from GET `/api/agent/{id}` including IPFS metadata and on-chain reputation from Solana.

### ReputationBadge
Standalone badge for dynamic scoring, updated on x402 settlements.

**Props Interface**:
```typescript
interface ReputationBadgeProps {
  score: number; // 0-100, from oracle feeds
  label?: string;
  variant: 'public' | 'private' | 'zk-verified';
}
```

**Description**: Color-coded (green >80, yellow 50-80, red <50) with tooltip for breakdown (success rate, task volume). Animates on updates.

**Usage Example**:
```tsx
<ReputationBadge score={92.3} variant="zk-verified" label="AI Auditor Agent" />
```

**Backend Integration**: Listens to `/api/reputation/updates` for auto-refresh post-task completion.

## Modals & Overlays Components

### WalletConnectModal
Modal for Solana wallet connection, essential for agent ownership and DID management.

**Props Interface**:
```typescript
interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (signature: string) => void; // For revocable key setup
}
```

**Description**: Supports Phantom, Solflare; displays connected address and reputation preview. Includes revoke key option for data ownership.

**Usage Example**:
```tsx
<WalletConnectModal isOpen={showModal} onClose={hideModal} onConnect={handleConnect} />
```

**Backend Integration**: On connect, signs message and POST `/api/wallet/auth` for session token linked to Solana DID.

### ZKDisclosureModal
Modal for selective revelation of work history, using ZKPs to share proofs without full data.

**Props Interface**:
```typescript
interface ZKDisclosureModalProps {
  isOpen: boolean;
  onClose: () => void;
  proofData: ZKProofData; // { metrics: PartialMetrics, verifier: string }
  onShare: (disclosedFields: string[]) => void;
}
```

**Description**: Allows toggling fields (e.g., success rate only) for sharing with swarm users or marketplaces. Integrates TEE for private off-chain previews.

**Usage Example**:
```tsx
<ZKDisclosureModal 
  isOpen={true} 
  proofData={agentProof}
  onShare={shareWithSwarm}
/>
```

**Backend Integration**: Generates proof via POST `/api/zk/generate` and verifies on `/api/zk/verify`.

## Utility Components

### LoadingSpinner
Custom spinner for async operations like IPFS pinning or on-chain txns.

**Props Interface**:
```typescript
interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}
```

**Description**: Tailwind-animated with project-themed colors (Solana purple accents). Used in forms during x402 escrow waits.

**Usage Example**:
```tsx
<LoadingSpinner message="Verifying ZKP..." size="md" />
```

### ErrorBoundary
Higher-order component for handling frontend errors, e.g., oracle failures.

**Props Interface**:
```typescript
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error }>;
}
```

**Description**: Logs to console and shows user-friendly messages (e.g., "Solana network issue – retry?").

**Usage Example**:
```tsx
<ErrorBoundary fallback={ErrorFallback}>
  <AgentCard agent={agent} />
</ErrorBoundary>
```

## Integration Guidelines

- **State Management**: Use Zustand stores for global state (e.g., `useAgentStore` for profiles, `useWalletStore` for Solana connection).
- **API Contracts**: All components assume RESTful endpoints from backend (e.g., `/api/agents`, `/api/proof/verify`). Coordinate with BackendDev for x402 webhook integrations.
- **Testing**: Each component includes unit tests with Jest/RTL (e.g., simulate ZKP uploads). E2E with Playwright for wallet flows.
- **Accessibility**: ARIA labels for reputation visuals; keyboard-navigable modals.
- **Customization for Embeddings**: Marketplace mode collapses sidebars, exposes `AgentCard` as iframe-friendly.
- **Future Enhancements**: Add Web3Modal v2 support; integrate ARIA live regions for real-time reputation updates.

This library ensures a seamless UX for decentralized AI agent trust-building, directly supporting the project's core features like verifiable histories and micropayment-driven scoring. For code implementations, refer to `/src/components` directory.