# Database Schema Design for Proof-of-Service Agent Registry

## Overview

This document outlines the database schema for the Proof-of-Service Agent Registry web application, built using PostgreSQL as the relational database and Prisma ORM for schema management and migrations. The schema is designed to support the core functionality of a decentralized registry for AI agents, where agents register capabilities, maintain verifiable work histories, and accumulate dynamic reputation scores tied to task completions and x402 protocol-based payment settlements.

Given the hybrid nature of the platform—Solana blockchain for on-chain immutability (e.g., DID-linked profiles, reputation badges via compressed NFTs) and off-chain components (IPFS for data pinning, TEEs for private storage)—this PostgreSQL schema serves as the centralized backend store for:
- Indexing and caching blockchain data for efficient querying (e.g., agent profiles synced from Solana via oracles like Switchboard).
- Storing web-app specific data, such as user sessions for developers/end-users, marketplace embeddings, and query logs.
- Handling off-chain validations, attestations, and selective disclosures without compromising privacy (e.g., hashed ZKP commitments instead of full proofs).
- Supporting x402 micropayment hooks, where payment settlements (SOL/USDC) trigger reputation updates mirrored on-chain.

The schema emphasizes data ownership via references to Solana DIDs, privacy through selective disclosure fields (e.g., encrypted blobs for private histories), and scalability for high-volume agent interactions in swarms or marketplaces. All tables include audit fields (`created_at`, `updated_at`, `agent_did` for ownership traceability).

**Key Design Principles:**
- **Normalization**: Entities are normalized to avoid redundancy, with foreign keys linking to Solana-derived IDs (e.g., program IDs, transaction signatures).
- **Privacy Compliance**: Use PostgreSQL's `BYTEA` for encrypted ZKP proofs and IPFS CIDs; avoid storing sensitive off-chain data directly—reference TEE-secured endpoints.
- **Performance**: Indexes on frequently queried fields (e.g., reputation scores for agent selection); support for JSONB columns for flexible capability profiles.
- **Integration Points**:
  - BackendDev: This schema enables Express/NestJS endpoints for CRUD operations (e.g., `/agents/register`, `/reputation/query`), with Prisma resolvers for blockchain sync hooks.
  - FrontendDev: Exposes structured data via APIs (e.g., agent lists with paginated reputation scores) for Next.js components like agent discovery dashboards.
- **Estimated Scale**: Supports up to 10,000+ agents initially, with sharding potential on `agent_did` for growth.

Prisma schema snippets are included for implementation reference. Full migrations will be generated via `prisma migrate dev`.

## Core Entities and Tables

### 1. Agents Table
Stores core agent profiles, linked to Solana DIDs for ownership and revocability. Capabilities are stored as JSONB for extensibility (e.g., skills like NLP, metrics like success_rate).

```prisma
model Agent {
  id                String   @id @default(cuid())
  did               String   @unique // Solana DID (e.g., did:solana:...), revocable key reference
  name              String   // Human-readable agent name
  description       String?  // Optional bio
  capabilities      Json?    // JSONB: { "skills": ["NLP", "auditing"], "metrics": { "success_rate": 0.95, "avg_speed_ms": 500 }, "endpoints": { "api_url": "https://agent.example/api", "solana_program_id": "Prog123..." } }
  is_active         Boolean  @default(true)
  owner_user_id     String?  // For developer-owned agents (FK to Users)
  ipfs_profile_cid  String?  // CID for off-chain pinned data via compressed NFT
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt
  revoked_at        DateTime?

  // Relations
  workHistories     WorkHistory[]
  reputationScores  ReputationScore[]
  payments          PaymentSettlement[]

  @@index([did])
  @@index([is_active])
  @@index([capabilities]) // GIN index for JSONB queries (e.g., skill-based search)
}
```

- **Purpose**: Enables agent registration and querying. Developers insert via API, triggering Solana program deployment for on-chain mirroring.
- **Uniqueness**: DID ensures decentralized identity; capabilities JSON allows dynamic profiling without schema changes.
- **Example Query (for FrontendDev)**: `SELECT * FROM Agent WHERE capabilities->>'skills' ? 'NLP' ORDER BY id LIMIT 20;` – Powers agent marketplace listings.

### 2. WorkHistory Table
Tracks verifiable task completions, with ZKP proofs and oracle attestations. References x402 transactions as implicit proofs; private details stored off-chain via IPFS/TEEs.

```prisma
model WorkHistory {
  id                   String   @id @default(cuid())
  agent_id             String   // FK to Agent.id
  task_description     String   // Hashed or selective disclosure of task (e.g., SHA256 of "audit financial report")
  task_status          EnumTaskStatus // PENDING, COMPLETED, FAILED
  proof_type           EnumProofType  // ZKP (zk-SNARK), ORACLE (Switchboard), TXN (x402)
  proof_data           ByteA?         // Encrypted ZKP commitment or oracle attestation (never full proof)
  verification_hash    String?        // Merkle root or IPFS CID for off-chain validation
  offchain_private_cid String?        // TEE-secured IPFS link for agent-only disclosure
  completed_at         DateTime?
  agent                Agent          @relation(fields: [agent_id], references: [id], onDelete: Cascade)

  @@index([agent_id])
  @@index([task_status])
  @@index([completed_at]) // For history timelines in agent dashboards
}
```

- **Enums**:
  - `enum EnumTaskStatus { PENDING COMPLETED FAILED }`
  - `enum EnumProofType { ZKP ORACLE TXN }`
- **Purpose**: Builds verifiable histories; on task completion (e.g., via x402 hook), insert record and trigger reputation update. Supports ZK selective disclosure—e.g., prove success rate without revealing specific tasks.
- **Privacy Note**: `proof_data` uses PostgreSQL encryption extensions (e.g., pgcrypto); full histories queryable only by agent DID.
- **Coordination**: BackendDev implements webhook from x402 for auto-insertion; FrontendDev uses for displaying badges (e.g., "95% success in last 100 tasks").

### 3. ReputationScore Table
Dynamic scores computed from work histories and payments, with on-chain mirroring via Solana badges. Scores decay over time if inactive.

```prisma
model ReputationScore {
  id             String   @id @default(cuid())
  agent_id       String   // FK to Agent.id
  overall_score  Float    @default(0.0) // 0-1 scale, weighted by task success and payment confirmations
  component_scores Json?  // JSONB: { "success_rate": 0.95, "reliability": 0.88, "speed": 0.92 }
  calculation_ts DateTime @default(now()) // Timestamp of last update
  decay_factor   Float    @default(1.0)   // For inactivity adjustments
  onchain_badge_id String? // Reference to Solana compressed NFT for public badge
  agent          Agent    @relation(fields: [agent_id], references: [id], onDelete: Cascade)

  @@unique([agent_id, calculation_ts]) // One score per update cycle
  @@index([agent_id])
  @@index([overall_score]) // For sorting high-rep agents in swarms
}
```

- **Purpose**: Auto-updated via backend jobs (e.g., on x402 settlement: score += weight * success). Public badges queryable for end-user selection.
- **Computation Logic**: Defined in backend service—e.g., `overall_score = (successes / total_tasks) * payment_confirmation_rate`, integrated with Switchboard for oracle-fed metrics.
- **Example**: For an NLP agent completing 50 tasks with 47 successes and settled payments, score = 0.94; decay applies if no activity in 30 days.

### 4. PaymentSettlement Table
Integrates x402 protocol for micropayments (SOL/USDC), triggering escrow releases and reputation ties. Stores txn references without full blockchain data.

```prisma
model PaymentSettlement {
  id                String   @id @default(cuid())
  agent_id          String   // FK to Agent.id
  task_id           String?  // Link to external task ID (e.g., from swarm)
  x402_txn_sig      String   @unique // Solana transaction signature for HTTP 402 settlement
  amount            Decimal(18, 9) // e.g., 0.001 SOL or USDC
  currency          EnumCurrency // SOL USDC
  status            EnumSettlementStatus // PENDING SETTLED REFUNDED
  escrow_release_ts DateTime?
  fee               Decimal(18, 9)? // x402 processing fee
  agent             Agent    @relation(fields: [agent_id], references: [id], onDelete: Cascade)
  workHistory       WorkHistory? @relation(fields: [task_id], references: [id]) // Optional link if tied to specific history

  @@index([agent_id])
  @@index([status])
  @@index([x402_txn_sig])
}
```

- **Enums**:
  - `enum EnumCurrency { SOL USDC }`
  - `enum EnumSettlementStatus { PENDING SETTLED REFUNDED }`
- **Purpose**: Hooks into x402 API—e.g., task completion sends HTTP 402, settles payment, inserts record, and updates reputation. Ensures "pay-for-proof" model.
- **Coordination**: BackendDev exposes `/payments/settle` endpoint with Solana RPC integration; FrontendDev displays settlement history in agent profiles.

### 5. Users Table
For primary users (developers, marketplace admins, end-users) interacting with the registry.

```prisma
model User {
  id             String   @id @default(cuid())
  email          String   @unique
  role           EnumUserRole // DEVELOPER MARKETPLACE END_USER
  wallet_address String?  // Solana wallet for auth (e.g., via SIWE)
  created_agents Agent[]  // Agents owned by this user
  query_logs     Json?    // Audit log of searches/selections (JSONB array)

  @@index([email])
  @@index([role])
}
```

- **Enums**: `enum EnumUserRole { DEVELOPER MARKETPLACE END_USER }`
- **Purpose**: Session management and access control; e.g., developers register agents, end-users query high-rep lists.

## Relationships and Constraints

- **One-to-Many**:
  - Agent → WorkHistory (one agent has many histories).
  - Agent → ReputationScore (multiple scores over time).
  - Agent → PaymentSettlement (many settlements per agent).
  - User → Agent (developers own multiple agents).
- **Optional Many-to-One**: WorkHistory → PaymentSettlement (a history may link to a settlement for proof).
- **Constraints**:
  - All tables enforce `NOT NULL` on key fields (e.g., `did` in Agent).
  - Foreign keys use `CASCADE` delete for cleanup (e.g., revoke agent → remove histories).
  - Unique constraints on blockchain refs (e.g., `x402_txn_sig`) prevent duplicates.
- **Data Integrity**: Triggers (via Prisma extensions) for auto-updating `updated_at`; custom functions for reputation recalculation on settlement inserts.

## Indexes and Optimization

- **Primary Indexes**: As noted per table (e.g., GIN on JSONB for capabilities search).
- **Composite Indexes**:
  - `Agent`: `(is_active, overall_score DESC)` – For top agent recommendations.
  - `WorkHistory`: `(agent_id, completed_at DESC)` – Recent history feeds.
- **Full-Text Search**: PostgreSQL `tsvector` on `Agent.description` for semantic queries (e.g., "find auditing agents").
- **Partitioning**: Future-proof for `WorkHistory` by `completed_at` (monthly partitions) to handle high-volume task data.

## Security and Privacy Considerations

- **Encryption**: Use `pgcrypto` for `proof_data` and private CIDs; keys managed via agent DIDs.
- **Access Control**: Row-Level Security (RLS) policies—e.g., users can only query own agents' private histories.
- **ZK Integration**: Store only commitments; full proofs verified off-chain via Solana programs.
- **Compliance**: GDPR-aligned—agents can revoke data (set `revoked_at`, cascade delete).

## Migration and Deployment Notes

- **Prisma Setup**: Run `prisma db push` for initial schema; use `prisma generate` for type-safe queries.
- **BackendDev Guidance**: Implement seed data for demo agents (e.g., NLP agent with sample history). Expose GraphQL/REST APIs aligned to this schema (e.g., `getAgentsByReputation` resolver).
- **FrontendDev Guidance**: Use generated Prisma types in Next.js for type-safe fetches (e.g., `useQuery` for agent lists with filters on `capabilities`).
- **Testing**: Include schema validation in CI (e.g., jest tests for relations); mock blockchain data for unit tests.
- **Version**: Schema v1.0 (Initial release tied to project milestone 1762759105700).

This schema is production-ready and directly supports the project's decentralized trust model while enabling efficient web app operations. For updates, reference Solana on-chain changes via oracle sync jobs.