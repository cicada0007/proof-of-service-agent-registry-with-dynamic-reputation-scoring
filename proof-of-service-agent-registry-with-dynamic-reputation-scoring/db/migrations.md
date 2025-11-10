# Database Migrations Guide for Proof-of-Service Agent Registry

This document outlines the Prisma migration strategy for the Proof-of-Service Agent Registry web application. The database (PostgreSQL) serves as an off-chain complement to the Solana-based core registry, handling user-facing operations such as developer accounts, agent query caches, marketplace embeddings, and selective disclosure logs for privacy features. It does not store core on-chain data (e.g., Solana DID-linked profiles, reputation badges, or x402 transaction proofs) but mirrors and indexes them for efficient querying by end-users and developers.

Migrations ensure schema evolution aligns with key features: agent capability registration (skills like NLP/auditing, metrics like success rate/speed, endpoints like API URLs/Solana program IDs), dynamic reputation scoring tied to task completions and x402 settlements, verifiable work histories via ZKPs/attestations, and privacy mechanisms (ZK selective disclosure, TEE-encrypted off-chain data). All migrations are designed for idempotency, rollback support, and compatibility with Docker-based deployments on AWS Fargate.

Prisma is used as the ORM, with migrations generated via `npx prisma migrate dev` and applied in production via `npx prisma migrate deploy`. The schema is defined in `prisma/schema.prisma`, which evolves through these migrations to support backend APIs (Node.js/Express) for frontend integration (Next.js).

## Migration Philosophy
- **Version Control**: Each migration is timestamped and named descriptively (e.g., `20240101T120000_add_agent_capabilities`). Commits reference migration hashes for traceability.
- **Data Integrity**: Migrations include seed data for testing (e.g., sample agent capabilities) and foreign key constraints to link user actions to on-chain Solana events.
- **Scalability**: Indexes on high-query fields (e.g., reputation scores, query timestamps) for fast agent selection in swarms. Support for JSONB columns for flexible off-chain metadata (e.g., IPFS-pinned compressed NFT hashes).
- **Privacy Compliance**: No storage of sensitive work history details; instead, hashes of ZKPs (zk-SNARKs) and oracle attestations (Switchboard) are stored. TEE-encrypted fields use Prisma's `EncryptedString` type (via `@prisma/extension-encryption`).
- **Integration Hooks**: Post-migration scripts trigger backend jobs to sync with Solana (via Anchor/Rust RPC calls) and x402 API endpoints for escrow/release verification.
- **Rollback Strategy**: Each migration includes a `down.sql` for reversibility. Use `npx prisma migrate reset` only in dev environments.
- **Testing**: Migrations are tested against a local PostgreSQL instance (Docker Compose) and validated with backend unit tests (Jest) simulating x402 micropayments (SOL/USDC).

## Migration History

### Initial Migration: Baseline Schema (20231215T090000_init_registry_db)
**Purpose**: Establishes foundational tables for user authentication and basic agent mirroring. Aligns with target audience needs: developers registering/querying agents, marketplaces embedding listings, end-users selecting swarms.

**Changes**:
- Create `users` table: For developers and end-users. Fields: `id` (UUID PK), `solana_did` (String, unique, links to Solana DIDs with revocable keys), `email` (String, unique), `role` (Enum: 'developer', 'marketplace', 'end_user'), `created_at` (Timestamp), `updated_at` (Timestamp).
- Create `agent_queries` table: Caches off-chain queries for agent discovery. Fields: `id` (UUID PK), `user_id` (FK to users), `query_params` (JSONB: e.g., {skills: ['NLP'], min_reputation: 0.8}), `results_hash` (String: IPFS hash of compressed NFT results), `timestamp` (Timestamp).
- Indexes: Composite index on `users.solana_did` and `agent_queries.user_id` for fast lookups.
- Seed Data: Insert sample user (developer with solana_did: 'did:solana:ExampleAgent123').

**SQL Snippet (up.sql excerpt)**:
```sql
CREATE TABLE "users" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "solana_did" TEXT UNIQUE NOT NULL,
    "email" TEXT UNIQUE NOT NULL,
    "role" TEXT NOT NULL CHECK ("role" IN ('developer', 'marketplace', 'end_user')),
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "agent_queries" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL REFERENCES "users"(id) ON DELETE CASCADE,
    "query_params" JSONB NOT NULL,
    "results_hash" TEXT,
    "timestamp" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "idx_users_solana_did" ON "users" ("solana_did");
CREATE INDEX "idx_agent_queries_user" ON "agent_queries" ("user_id", "timestamp" DESC);
```

**Post-Migration Action**: Run backend sync job to populate initial agent query cache from Solana registry (e.g., fetch sample capabilities via Anchor IDL).

### Migration 1: Add Reputation and Work History Mirroring (20240101T120000_add_reputation_history)
**Purpose**: Introduces tables for dynamic reputation scoring and verifiable work histories, tied to x402 payment settlements. Supports automatic updates on task completion (e.g., escrow release triggers reputation delta calculation).

**Changes**:
- Create `reputation_scores` table: Mirrors on-chain badges. Fields: `id` (UUID PK), `agent_did` (String, unique, from Solana), `score` (Decimal: 0-1 scale, e.g., based on success rate/speed), `update_trigger` (Enum: 'x402_settlement', 'zkp_proof', 'oracle_attestation'), `last_updated` (Timestamp), `metadata` (JSONB: e.g., {task_count: 50, avg_speed_ms: 200}).
- Create `work_history_logs` table: Stores ZK-proof hashes for selective disclosure. Fields: `id` (UUID PK), `agent_did` (String), `task_hash` (String: x402 txn ID), `zkp_hash` (String: zk-SNARK proof), `attestation_source` (Enum: 'switchboard', 'third_party'), `disclosure_level` (Enum: 'public', 'private_zk'), `encrypted_data` (Bytes: TEE-encrypted off-chain details via Prisma extension).
- Foreign Key: `reputation_scores.agent_did` references external Solana but indexed locally.
- Indexes: B-tree on `reputation_scores.score DESC` for high-rep agent selection in swarms; GIN on `work_history_logs.zkp_hash` for proof verification.
- Seed Data: Sample reputation (agent_did: 'did:solana:HighRepAgent', score: 0.95, trigger: 'x402_settlement') and work log (zkp_hash: 'zkproof_example_abc123', disclosure: 'private_zk').

**SQL Snippet (up.sql excerpt)**:
```sql
CREATE TYPE "UpdateTrigger" AS ENUM ('x402_settlement', 'zkp_proof', 'oracle_attestation');
CREATE TYPE "AttestationSource" AS ENUM ('switchboard', 'third_party');
CREATE TYPE "DisclosureLevel" AS ENUM ('public', 'private_zk');

CREATE TABLE "reputation_scores" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "agent_did" TEXT UNIQUE NOT NULL,
    "score" DECIMAL(3,2) NOT NULL DEFAULT 0.0 CHECK ("score" >= 0 AND "score" <= 1),
    "update_trigger" "UpdateTrigger" NOT NULL,
    "last_updated" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB
);

CREATE TABLE "work_history_logs" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "agent_did" TEXT NOT NULL,
    "task_hash" TEXT NOT NULL,
    "zkp_hash" TEXT NOT NULL,
    "attestation_source" "AttestationSource",
    "disclosure_level" "DisclosureLevel" NOT NULL DEFAULT 'private_zk',
    "encrypted_data" BYTEA
);

CREATE INDEX "idx_reputation_score" ON "reputation_scores" ("score" DESC, "agent_did");
CREATE INDEX "idx_work_history_zkp" ON "work_history_logs" USING GIN ("zkp_hash");
```

**Post-Migration Action**: Backend webhook setup for x402 HTTP 402 callbacks to update `reputation_scores` (e.g., on SOL/USDC micropayment confirmation, increment score by 0.01 for successful tasks).

### Migration 2: Enhance Capabilities and Marketplace Integration (20240115T140000_add_capabilities_marketplace)
**Purpose**: Adds support for agent capability profiling and marketplace embeddings, enabling developers to register/query and end-users to select agents for swarms. Integrates IPFS pinning via compressed NFTs.

**Changes**:
- Create `agent_capabilities` table: Off-chain mirror of DID-linked profiles. Fields: `id` (UUID PK), `agent_did` (String), `skills` (Array<String>: e.g., ['NLP', 'auditing']), `metrics` (JSONB: {success_rate: 0.92, speed_ms: 150}), `endpoints` (JSONB: {api_url: 'https://agent.example.com', solana_program_id: 'ProgId123'}), `ipfs_pin_hash` (String: compressed NFT link).
- Create `marketplace_embeddings` table: For AI agent marketplaces. Fields: `id` (UUID PK), `marketplace_id` (UUID, FK to users where role='marketplace'), `embedded_agent_dids` (Array<String>), `listing_config` (JSONB: e.g., {filter: {min_reputation: 0.7}, embed_url: '/api/agents/query'}).
- Alter `agent_queries`: Add `capability_filter` (JSONB) for advanced searches.
- Indexes: Full-text search on `agent_capabilities.skills` using PostgreSQL tsvector; hash index on `ipfs_pin_hash`.
- Seed Data: Sample capability (agent_did: 'did:solana:NLPAgent', skills: ['NLP'], ipfs_pin_hash: 'QmExampleIPFSHash') and embedding (marketplace_id: sample UUID, embedded_agent_dids: ['did:solana:HighRepAgent']).

**SQL Snippet (up.sql excerpt)**:
```sql
ALTER TABLE "agent_queries" ADD COLUMN "capability_filter" JSONB;

CREATE TABLE "agent_capabilities" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "agent_did" TEXT NOT NULL,
    "skills" TEXT[] NOT NULL,
    "metrics" JSONB,
    "endpoints" JSONB,
    "ipfs_pin_hash" TEXT
);

CREATE TABLE "marketplace_embeddings" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "marketplace_id" UUID NOT NULL REFERENCES "users"(id) ON DELETE CASCADE,
    "embedded_agent_dids" TEXT[] NOT NULL,
    "listing_config" JSONB NOT NULL
);

CREATE INDEX "idx_capabilities_skills_fts" ON "agent_capabilities" USING GIN (to_tsvector('english', array_to_string(skills, ' ')));
CREATE INDEX "idx_ipfs_pin" ON "agent_capabilities" USING HASH ("ipfs_pin_hash");
```

**Post-Migration Action**: Integrate with backend FastAPI optional endpoint for IPFS pinning (e.g., on capability registration, upload metadata to IPFS and store hash).

### Migration 3: Privacy and ZK Enhancements (20240130T160000_add_zk_privacy_features)
**Purpose**: Bolsters privacy with ZK selective disclosure and TEE support, ensuring agents own data without doxxing risks. Prepares for revocable Solana DID updates.

**Changes**:
- Alter `work_history_logs`: Add `revocable_key_hash` (String: hash of Solana revocable key) and `tee_enclave_id` (String: for private off-chain validation).
- Create `selective_disclosures` table: Tracks ZK disclosures. Fields: `id` (UUID PK), `log_id` (FK to work_history_logs), `disclosed_to` (UUID, FK to users), `zk_proof_type` (Enum: 'zk-snark', 'zk-stark'), `disclosure_timestamp` (Timestamp).
- Add constraint: Ensure `encrypted_data` is non-null for 'private_zk' levels.
- Indexes: Index on `selective_disclosures.disclosed_to` for audit trails.
- Seed Data: Sample disclosure (log_id: sample UUID, disclosed_to: end-user UUID, zk_proof_type: 'zk-snark').

**SQL Snippet (up.sql excerpt)**:
```sql
CREATE TYPE "ZKProofType" AS ENUM ('zk-snark', 'zk-stark');

ALTER TABLE "work_history_logs" 
ADD COLUMN "revocable_key_hash" TEXT,
ADD COLUMN "tee_enclave_id" TEXT,
ADD CONSTRAINT "chk_private_zk_encrypted" CHECK (
    CASE WHEN "disclosure_level" = 'private_zk' THEN "encrypted_data" IS NOT NULL ELSE true END
);

CREATE TABLE "selective_disclosures" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "log_id" UUID NOT NULL REFERENCES "work_history_logs"(id) ON DELETE CASCADE,
    "disclosed_to" UUID NOT NULL REFERENCES "users"(id),
    "zk_proof_type" "ZKProofType" NOT NULL,
    "disclosure_timestamp" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "idx_disclosures_to" ON "selective_disclosures" ("disclosed_to", "disclosure_timestamp" DESC);
```

**Post-Migration Action**: Backend job to validate TEE enclaves (e.g., via AWS Nitro Enclaves integration) and sync revocable key changes from Solana webhooks.

## Running Migrations
- **Development**: `npx prisma migrate dev --name <description>` (auto-generates and applies).
- **Production**: `npx prisma migrate deploy` in Docker entrypoint script. Use environment vars: `DATABASE_URL=postgresql://user:pass@host:5432/registry_db`.
- **Seeding**: `npx prisma db seed` after migrations, populating with workflow-context samples (e.g., NLP agent with 0.85 reputation post-x402 settlement).
- **Monitoring**: Integrate with Prisma Accelerate for query insights; alert on migration failures via AWS CloudWatch.
- **Rollback**: `npx prisma migrate resolve --rolled-back <migration_name>` for targeted reversals.

## Dependencies and Coordination
- **BackendDev Alignment**: These migrations expose models for Express routes (e.g., `/api/agents/:did/reputation` queries `reputation_scores`). Ensure API responses include on-chain links (Solana RPC) and off-chain hashes (IPFS).
- **FrontendDev Alignment**: TypeScript types generated via `npx prisma generate` for Next.js Zustand stores (e.g., agent query results).
- **Solana Integration**: Migrations do not alter blockchain; backend uses Anchor client to bridge (e.g., update DB on Solana event emissions).
- **Version**: Current schema version: v1.4 (post all migrations). Next migration planned for x402 v2 hooks.

For issues, reference Unique Identifier: 1762759105739_proof_of_service_agent_registry_with_dynamic_reputation_scoring__db_migrations_md_40jhup. Update this doc on schema changes.