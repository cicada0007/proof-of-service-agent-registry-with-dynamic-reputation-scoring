# Backend Services Architecture

## Overview

The backend services for the Proof-of-Service Agent Registry with Dynamic Reputation Scoring form a robust, scalable layer that bridges the decentralized Solana-based core registry with off-chain components for user interactions, data persistence, and external integrations. Built primarily on Node.js with Express.js for API handling, the architecture leverages Prisma ORM for PostgreSQL interactions to manage hybrid on-chain/off-chain data. This setup ensures efficient handling of AI agent registrations, capability profiling, work history verification, dynamic reputation scoring, and x402 micropayment settlements.

The services are modular, designed as a monorepo with potential for microservices scaling via Docker containers on AWS Fargate. Key principles include:
- **Decentralization Alignment**: All critical operations (e.g., reputation updates, DID-linked profiles) interact with Solana Anchor programs via Rust-generated TypeScript bindings (using `@coral-xyz/anchor`).
- **Privacy-First Design**: Integration of ZK-SNARK libraries (e.g., via `snarkjs` for Node.js) for selective disclosure of work histories, with TEEs (e.g., AWS Nitro Enclaves) for sensitive off-chain computations.
- **Payment Hooks**: x402 protocol implementation using HTTP 402 responses for API-triggered SOL/USDC settlements, with webhooks to Solana programs for escrow release upon task verification.
- **Scalability and Reliability**: Asynchronous processing with BullMQ for queues (e.g., reputation score calculations), Redis for caching, and IPFS pinning services (via `ipfs-http-client`) for compressed NFT-linked data storage.

Services coordinate with the frontend (Next.js) via RESTful APIs and GraphQL (using Apollo Server) for complex queries, ensuring API contracts define clear schemas for agent discovery and selection by developers, marketplaces, and end-users.

## Core Services

### 1. Agent Registry Service
This service handles AI agent onboarding, profile management, and querying. It acts as the entry point for decentralized registration, syncing DID-linked data from Solana to PostgreSQL for fast reads.

- **Key Responsibilities**:
  - Validate and register agent capabilities: Skills (e.g., NLP, auditing), metrics (success rate, average speed), and endpoints (API URLs, Solana program IDs).
  - Generate Solana DIDs with revocable keys for agent ownership; store profiles as compressed NFTs on Solana, pinning metadata to IPFS.
  - Query mechanisms: Filter agents by reputation badges, skills, or swarm compatibility for end-user selection.

- **Database Schema (Prisma)**:
  ```prisma
  model Agent {
    id                String   @id @default(cuid())
    did               String   @unique // Solana DID
    capabilities      Json     // { skills: string[], metrics: { successRate: number, avgSpeed: number }, endpoints: string[] }
    owner             String   // Agent wallet address
    isActive          Boolean  @default(true)
    createdAt         DateTime @default(now())
    updatedAt         DateTime @updatedAt
    reputationId      String?  @unique
    reputation        Reputation? @relation(fields: [reputationId], references: [id], onDelete: Cascade)
    workHistories     WorkHistory[]
  }

  model DIDProfile {
    id          String @id @default(cuid())
    agentId     String @unique
    agent       Agent  @relation(fields: [agentId], references: [id], onDelete: Cascade)
    nftMint     String // Compressed NFT mint address on Solana
    ipfsCid     String // IPFS pinning hash for off-chain profile data
    revocationKey String // For agent-controlled revocation
  }
  ```

- **API Contracts** (Exposed via Express routes):
  - `POST /api/agents/register`: Body: `{ capabilities: {...}, wallet: string }`. Response: `{ agentId: string, did: string, txSignature: string }`. Integrates with Solana program to create DID and NFT.
  - `GET /api/agents/:id`: Returns agent profile with ZK-selective disclosure (e.g., query param `?disclose=metrics` triggers SNARK proof generation).
  - `GET /api/agents/search?skills=nlp&minReputation=0.8`: Paginated results for marketplace embeddings, cached in Redis.

- **Server Logic Flow**:
  1. Receive registration request → Validate wallet signature.
  2. Call Solana Anchor IDL to invoke `register_agent` instruction, generating DID and minting compressed NFT.
  3. Pin profile JSON to IPFS → Store CID and metadata in PostgreSQL.
  4. Emit event to Reputation Service for initial score setup.

- **Integrations**:
  - Solana: `@solana/web3.js` for transactions; Anchor for program interactions.
  - IPFS: Asynchronous pinning queue to ensure data durability.

### 2. Reputation Scoring Service
A dynamic service that computes and updates reputation scores based on verifiable task completions, using on-chain events and off-chain attestations. Scores are public badges on Solana but computed privately via TEEs for nuanced metrics.

- **Key Responsibilities**:
  - Calculate scores: Weighted formula (e.g., 0.6 * success_rate + 0.3 * payment_settlements + 0.1 * attestation_count), updated on x402 hooks.
  - Handle ZKPs for proof submission without revealing full histories.
  - Public exposure: Reputation as on-chain u64 score (0-1000 basis points) tied to agent DID.

- **Database Schema (Prisma)**:
  ```prisma
  model Reputation {
    id           String   @id @default(cuid())
    agentId      String   @unique
    agent        Agent    @relation(fields: [agentId], references: [id], onDelete: Cascade)
    currentScore Float    @default(500) // 0-1000 scale
    history      Json[]   // Array of { timestamp: Date, delta: number, reason: string }
    lastUpdated  DateTime @default(now())
    onChainBadge String?  // Solana PDA address for public badge
  }
  ```

- **API Contracts**:
  - `POST /api/reputation/update`: Body: `{ agentId: string, proof: { zkSnark: string, taskId: string } }`. Triggers score recalculation and Solana update.
  - `GET /api/reputation/:agentId`: Returns `{ score: number, badge: string }` with optional ZK proof for verification.
  - Webhook endpoint: `POST /webhooks/x402-settlement` for payment-triggered updates.

- **Server Logic Flow**:
  1. On task completion event (from x402 hook or oracle) → Queue score update in BullMQ.
  2. Verify ZKP using `snarkjs` → If valid, compute delta in TEE (e.g., via AWS Nitro for privacy).
  3. Invoke Solana `update_reputation` instruction → Sync score to PostgreSQL.
  4. Invalidate Redis cache for affected agent queries.

- **Integrations**:
  - Switchboard Oracles: Fetch off-chain attestations via Solana program calls.
  - ZKPs: Generate/verify proofs for work history without full disclosure (e.g., prove "success rate > 80%" without listing tasks).
  - TEEs: Offload scoring logic to prevent doxxing of private metrics.

### 3. Work History Verification Service
Manages verifiable proofs for agent task histories, using ZKPs, oracles, and x402 transactions as implicit evidence. Ensures privacy through selective disclosure.

- **Key Responsibilities**:
  - Store and attest work histories: Link to x402 txn signatures for payments as proofs.
  - Off-chain validation: Use third-party oracles for non-blockchain tasks.
  - Revocation: Agents can revoke histories via DID keys, triggering IPFS unpinning.

- **Database Schema (Prisma)**:
  ```prisma
  model WorkHistory {
    id              String   @id @default(cuid())
    agentId         String
    agent           Agent    @relation(fields: [agentId], references: [id], onDelete: Cascade)
    taskId          String   @unique
    proofType       String   // "zkp", "oracle", "x402_txn"
    proofData       Json     // { snark: string, oracleAttestation: string, txnSig: string }
    isVerified      Boolean  @default(false)
    disclosedTo     String[] // Selective disclosure recipients (e.g., marketplace IDs)
    revokedAt       DateTime?
    createdAt       DateTime @default(now())
  }
  ```

- **API Contracts**:
  - `POST /api/history/submit-proof`: Body: `{ taskId: string, proof: {...}, agentId: string }`. Verifies and stores.
  - `GET /api/history/:taskId/verify?discloseTo=marketplace123`: Returns ZK-proof if authorized.
  - `DELETE /api/history/:taskId/revoke`: Requires agent DID signature.

- **Server Logic Flow**:
  1. Proof submission → Verify signature and type (e.g., check x402 txn on Solana explorer API).
  2. For ZKP: Run verifier circuit → Mark as verified.
  3. Oracle integration: Query Switchboard for attestation → Store result.
  4. Notify Reputation Service on verification → Trigger score update.
  5. For revocation: Update DB flag and call IPFS unpin service.

- **Integrations**:
  - Solana: Parse x402 txn logs for implicit proofs.
  - Oracles: Switchboard V2 for real-time attestations (e.g., task success from external APIs).

### 4. Payment Settlement Service (x402 Integration)
Implements HTTP 402 micropayments for API-triggered settlements, with hooks for escrow and reputation updates. Supports SOL/USDC via Solana programs.

- **Key Responsibilities**:
  - Enforce x402: Return 402 on protected endpoints, settling via wallet challenge.
  - Escrow management: Create/release funds on task completion verification.
  - Auto-updates: Link settlements to reputation boosts.

- **Database Schema (Prisma)**:
  ```prisma
  model PaymentSettlement {
    id         String   @id @default(cuid())
    taskId     String   @unique
    agentId    String
    payer      String   // Requester wallet
    amount     Float    // In USDC lamports
    currency   String   @default("USDC")
    status     String   @default("pending") // pending, settled, failed
    txnSig     String?
    createdAt  DateTime @default(now())
    agent      Agent    @relation(fields: [agentId], references: [id])
  }
  ```

- **API Contracts** (x402-Enabled):
  - All registry APIs (e.g., `/api/agents/search`) check for 402 if rate-limited.
  - `POST /api/payments/settle`: Internal hook; Body: `{ taskId: string, amount: number }`. Returns `{ txnSig: string }`.
  - `GET /api/payments/:taskId/status`: For end-user tracking.

- **Server Logic Flow**:
  1. On API call → If protected, respond with 402 WWW-Authenticate: WalletChallenge.
  2. On settlement txn → Verify on Solana → Release escrow via Anchor instruction.
  3. Emit webhook to Reputation and History Services.
  4. Log in PostgreSQL for auditing.

- **Integrations**:
  - Solana SPL Tokens: For USDC transfers.
  - Webhooks: Secure endpoints with HMAC verification.

## Cross-Service Orchestration
- **Event Bus**: Use Kafka or Redis Pub/Sub for inter-service communication (e.g., task completion → reputation update → history log).
- **Error Handling & Monitoring**: Winston for logging, Sentry for errors; rate-limiting with `express-rate-limit`.
- **Security**: JWT for auth (DID-signed), CORS for frontend, OWASP best practices; ZK for privacy.
- **Deployment**: Dockerized services with health checks; CI/CD via GitHub Actions to AWS Fargate. Environment vars for Solana RPC (mainnet/devnet), IPFS gateway, and oracle keys.

## Performance Considerations
- Caching: Redis for agent queries (TTL: 5min); invalidate on updates.
- Async Queues: BullMQ for heavy ops like ZKP generation (scale workers horizontally).
- Load Testing: Target 1000 RPS for queries, using Artillery; optimize Solana calls with batching.

This architecture ensures the backend services provide a seamless, trust-enhanced foundation for the AI agent ecosystem, aligning with project requirements for decentralization, privacy, and verifiable interactions. For API contract refinements, coordinate with FrontendDev.