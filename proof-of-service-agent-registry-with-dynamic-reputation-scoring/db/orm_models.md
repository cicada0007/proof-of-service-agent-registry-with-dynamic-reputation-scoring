# ORM Models for Proof-of-Service Agent Registry

This document defines the Object-Relational Mapping (ORM) models for the Proof-of-Service Agent Registry web application backend. These models are implemented using Prisma ORM with PostgreSQL as the underlying database. The schema captures centralized off-chain data that complements the decentralized Solana-based registry, including agent profiles, work histories, reputation metrics, and user interactions. On-chain data (e.g., Solana DIDs, compressed NFTs for IPFS pinning, x402 transaction proofs) is mirrored or referenced here for efficient querying, caching, and privacy-enhanced operations.

Key design principles:
- **Decentralization Alignment**: Models reference Solana program IDs, DIDs, and x402 hooks without storing sensitive on-chain proofs directly. ZK-selective disclosure is handled via backend logic (e.g., integrating zk-SNARK verifiers).
- **Privacy and Ownership**: Fields support Solana DID-linked ownership with revocable keys. Private data (e.g., detailed work histories) uses encrypted fields or TEE integrations for off-chain storage.
- **Performance**: Indexes on frequently queried fields (e.g., reputation scores, agent capabilities). Relations enable efficient joins for agent discovery and swarm selection.
- **Integration Points**:
  - x402 micropayments (SOL/USDC) trigger reputation updates via API hooks, updating models post-settlement.
  - IPFS CIDs for off-chain pinning (e.g., capability profiles) are stored as references.
  - Switchboard oracles feed into attestation models for off-chain validation.
- **Unique to Web App**: These models support frontend features like agent querying for developers/marketplaces and end-user selection for swarms, distinct from pure on-chain storage.

The full Prisma schema (`prisma/schema.prisma`) should incorporate these models. Below, each model is detailed with:
- **Description**: Purpose in the context of the agent registry.
- **Fields**: Type, constraints, and notes.
- **Relations**: Links to other models.
- **Indexes**: For query optimization.
- **Backend Hooks**: Suggested Prisma middleware or resolvers for dynamic updates (e.g., reputation scoring).

## Model: User

**Description**: Represents primary users of the web app, including developers (who register/query agents), marketplace operators (who embed registry listings), and end-users (who select agents for swarms). Users authenticate via wallet signatures (Solana) for DID linkage, enabling agent ownership and query permissions.

**Fields**:
- `id`: String (UUID) @id @default(cuid()) @unique - Auto-generated unique identifier.
- `walletAddress`: String @unique - Solana wallet address for authentication and DID derivation.
- `did`: String? - Solana DID (e.g., `did:solana:<walletAddress>`), nullable until registered.
- `role`: Enum('developer', 'marketplace', 'end_user') @default('end_user') - User type for access control (e.g., developers can register agents).
- `email`: String? @unique - Optional for non-custodial notifications (e.g., reputation alerts).
- `createdAt`: DateTime @default(now()) - Timestamp for user creation.
- `updatedAt`: DateTime @updatedAt - Auto-updated on changes.
- `isActive`: Boolean @default(true) - Flag for account status (e.g., revoked via DID).

**Relations**:
- `agents` Agent[] - Users own/register multiple agents.
- `queries` AgentQuery[] - Logs user queries for analytics.
- `selections` AgentSelection[] - Tracks end-user swarm selections.

**Indexes**:
- @@index([walletAddress]) - Fast wallet-based lookups.
- @@index([role, isActive]) - Role-filtered active users.

**Backend Hooks**: On user creation, derive DID and validate Solana signature. Middleware to sync with on-chain registry on role changes.

## Model: Agent

**Description**: Core model for registered AI agents, storing DID-linked profiles with capabilities, endpoints, and metadata. This off-chain mirror enables fast querying (e.g., by skill/success rate) while referencing Solana programs and IPFS for decentralized storage. Reputation is computed dynamically via hooks tied to x402 settlements.

**Fields**:
- `id`: String (UUID) @id @default(cuid()) @unique - Unique agent identifier.
- `userId`: String @map("user_id") - Foreign key to owning user.
- `did`: String @unique - Solana DID for agent identity and revocable keys.
- `programId`: String - Solana program ID (Anchor/Rust) for agent execution.
- `name`: String - Human-readable agent name (e.g., "NLP Auditor Bot").
- `description`: String? - Brief overview of agent's purpose.
- `ipfsCid`: String? - IPFS Content Identifier for pinned off-chain profile (via compressed NFT).
- `isActive`: Boolean @default(true) - Activation status, tied to DID revocation.
- `createdAt`: DateTime @default(now()).
- `updatedAt`: DateTime @updatedAt.

**Relations**:
- `user` User @relation(fields: [userId], references: [id], onDelete: Cascade)
- `capabilities` Capability[] - Linked skills and metrics.
- `workHistories` WorkHistory[] - Verifiable task completions.
- `reputation` Reputation? - Current dynamic score.
- `attestations` Attestation[] - Oracle/third-party validations.

**Indexes**:
- @@index([did, isActive]) - DID-based discovery.
- @@index([programId]) - Program-specific filtering for marketplaces.
- @@unique([userId, name]) - Prevent duplicate names per user.

**Backend Hooks**: On creation, pin profile to IPFS and mint compressed NFT reference on Solana. Post-x402 settlement, trigger reputation update. Integrate ZK verifier for capability proofs.

## Model: Capability

**Description**: Defines an agent's registered skills and performance metrics (e.g., NLP success rate), stored in DID-linked profiles. Supports selective disclosure via ZK mechanisms, with off-chain storage for privacy (e.g., via TEEs). Used for agent matching in queries and swarm selections.

**Fields**:
- `id`: String (UUID) @id @default(cuid()) @unique.
- `agentId`: String @map("agent_id") - Foreign key to agent.
- `skill`: String - Category (e.g., "NLP", "auditing", "data_analysis").
- `endpoint`: String? - API URL or Solana program endpoint for invocation.
- `successRate`: Float? - Percentage (0-100) based on historical tasks.
- `avgSpeed`: Float? - Average task completion time (seconds).
- `zkProofHash`: String? - Hash of zk-SNARK proof for verifiable metrics (without disclosure).
- `isPublic`: Boolean @default(true) - Flag for ZK-selective disclosure (public vs. private via TEE).
- `createdAt`: DateTime @default(now()).

**Relations**:
- `agent` Agent @relation(fields: [agentId], references: [id], onDelete: Cascade)

**Indexes**:
- @@index([agentId, skill]) - Quick skill lookups per agent.
- @@index([successRate, avgSpeed] DESC) - Sort by performance for high-rep selections.
- @@index([zkProofHash]) - Efficient ZK verification lookups.

**Backend Hooks**: Validate metrics against Switchboard oracle feeds. On update, recompute and store new zkProofHash if metrics change post-task.

## Model: WorkHistory

**Description**: Tracks verifiable work entries for agents, using x402 transactions as implicit proofs and ZKPs for privacy-preserving validation. Off-chain details (e.g., task outcomes) are pinned to IPFS, with attestations from oracles/third-parties. Enables dynamic reputation building without full disclosure.

**Fields**:
- `id`: String (UUID) @id @default(cuid()) @unique.
- `agentId`: String @map("agent_id") - Foreign key to agent.
- `taskId`: String - Unique task identifier (e.g., UUID or Solana tx hash).
- `x402TxHash`: String? - x402 settlement transaction hash (SOL/USDC) on Solana.
- `zkProof`: String? - zk-SNARK proof for task success (selective disclosure).
- `ipfsCid`: String? - IPFS pin for off-chain task details (e.g., inputs/outputs).
- `success`: Boolean - Task completion status.
- `timestamp`: DateTime - Completion time.
- `attestationSource`: Enum('switchboard', 'third_party', 'self')? - Validation method.
- `privateDataHash`: String? - Encrypted hash for TEE-stored private history (anti-doxxing).

**Relations**:
- `agent` Agent @relation(fields: [agentId], references: [id], onDelete: Cascade)
- `attestations` Attestation[] - Linked validations.

**Indexes**:
- @@index([agentId, timestamp DESC]) - Recent history per agent.
- @@index([x402TxHash]) - x402 hook lookups.
- @@index([success]) - Aggregate success rates.

**Backend Hooks**: On x402 webhook, create entry and verify zkProof. Auto-revoke on DID key changes. Aggregate for reputation scoring.

## Model: Reputation

**Description**: Stores dynamic reputation scores for agents, computed from work histories (e.g., weighted by success rate, recency, x402 volume). Public badges for discoverability; private scores via ZK. Updated automatically on task settlements.

**Fields**:
- `id`: String (UUID) @id @default(cuid()) @unique.
- `agentId`: String @map("agent_id") - Foreign key to agent.
- `score`: Float - Overall score (0-100), algorithm: (success_rate * 0.6) + (speed_factor * 0.2) + (settlement_volume * 0.2).
- `badgeLevel`: Enum('bronze', 'silver', 'gold', 'platinum') - Public tier based on score thresholds.
- `lastUpdated`: DateTime @default(now()) @updatedAt - Timestamp of last recalculation.
- `zkDisclosure`: String? - ZK proof for verifiable score without history reveal.
- `volume`: BigInt - Cumulative x402 settlement volume (in lamports for SOL).

**Relations**:
- `agent` Agent @relation(fields: [agentId], references: [id], onUpdate: Cascade, onDelete: Restrict)

**Indexes**:
- @@index([agentId] UNIQUE) - One-to-one with agent.
- @@index([score DESC, badgeLevel]) - High-rep sorting for end-user queries.

**Backend Hooks**: Middleware on WorkHistory creation/update: Recalculate score, generate zkDisclosure, and emit event for frontend sync. Integrate with Solana oracle for on-chain badge minting.

## Model: Attestation

**Description**: Records off-chain validations from oracles (e.g., Switchboard) or third-parties for work histories and capabilities. Supports verifiable claims without central trust, tied to ZKPs.

**Fields**:
- `id`: String (UUID) @id @default(cuid()) @unique.
- `workHistoryId`: String? @map("work_history_id") - Optional link to specific history.
- `capabilityId`: String? @map("capability_id") - Optional link to capability.
- `source`: String - Oracle/third-party identifier (e.g., "Switchboard V2").
- `claim`: Json - Structured claim (e.g., { "verified": true, "metric": "success_rate=95%" }).
- `proof`: String - ZK or signature proof.
- `timestamp`: DateTime @default(now()).
- `isRevoked`: Boolean @default(false) - Flag for invalidations.

**Relations**:
- `workHistory` WorkHistory? @relation(fields: [workHistoryId], references: [id])
- `capability` Capability? @relation(fields: [capabilityId], references: [id])

**Indexes**:
- @@index([source, timestamp DESC]) - Recent attestations per source.
- @@index([isRevoked, proof]) - Filtered valid proofs.

**Backend Hooks**: On oracle webhook, validate and store claim. Propagate to reputation recalculation if tied to history.

## Model: AgentQuery

**Description**: Logs developer/marketplace queries for agents (e.g., by skill/reputation), enabling analytics and rate-limiting. Supports embedding in marketplaces.

**Fields**:
- `id`: String (UUID) @id @default(cuid()) @unique.
- `userId`: String @map("user_id") - Querying user.
- `queryParams`: Json - Search criteria (e.g., { "skills": ["NLP"], "minScore": 80 }).
- `resultsCount`: Int - Number of agents returned.
- `timestamp`: DateTime @default(now()).
- `context`: Enum('developer', 'marketplace_embed', 'swarm_selection') - Query purpose.

**Relations**:
- `user` User @relation(fields: [userId], references: [id])

**Indexes**:
- @@index([userId, timestamp]) - User query history.
- @@index([context]) - Analytics by use case.

**Backend Hooks**: Rate-limit based on user role. Anonymize for privacy.

## Model: AgentSelection

**Description**: Tracks end-user selections of high-reputation agents for swarms/tasks, logging for feedback loops and reputation incentives.

**Fields**:
- `id`: String (UUID) @id @default(cuid()) @unique.
- `userId`: String @map("user_id") - Selecting user.
- `agentId`: String @map("agent_id") - Selected agent.
- `swarmId`: String? - Optional swarm identifier.
- `timestamp`: DateTime @default(now()).
- `feedbackScore`: Float? - Post-task user rating (1-5) for future reputation weighting.

**Relations**:
- `user` User @relation(fields: [userId], references: [id])
- `agent` Agent @relation(fields: [agentId], references: [id])

**Indexes**:
- @@index([userId, agentId]) - Avoid duplicate selections.
- @@index([timestamp DESC]) - Recent selections for trends.

**Backend Hooks**: On selection, increment agent's query volume for reputation. Post-feedback, update work history aggregate.

## Additional Schema Notes

- **Enums**: Define in Prisma: `UserRole`, `BadgeLevel`, `AttestationSource`, `QueryContext`.
- **Database Constraints**: Enforce data integrity with `@db.VarChar(255)` for strings where needed. Use `BigInt` for Solana lamports.
- **Migrations**: Generate via `prisma migrate dev --name init_registry_models`. Include seed data for example agents (e.g., NLP bot with 90% success rate).
- **Security**: Encrypt sensitive fields (e.g., privateDataHash) using Prisma extensions. Integrate with backend auth for DID verification.
- **Scalability**: For high-volume x402 updates, use PostgreSQL partitioning on `timestamp` for WorkHistory.
- **Unique Identifier**: This schema version is tied to project UID `1762759105744_proof_of_service_agent_registry_with_dynamic_reputation_scoring__db_orm_models_md_akvac`. Update on major changes (e.g., new ZK integrations).

This ORM setup ensures clear, implementable requirements for BackendDev (e.g., API endpoints for agent registration/query) and FrontendDev (e.g., Zustand stores for reputation data). Coordinates with Solana smart contracts by referencing on-chain elements without duplication.