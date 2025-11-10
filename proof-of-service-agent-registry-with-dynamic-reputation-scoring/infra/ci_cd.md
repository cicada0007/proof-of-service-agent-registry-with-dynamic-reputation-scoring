# CI/CD Pipeline Configuration for Proof-of-Service Agent Registry

## Overview

This document outlines the comprehensive CI/CD pipelines for the **Proof-of-Service Agent Registry with Dynamic Reputation Scoring** project. The pipelines are designed to automate the build, test, deployment, and monitoring processes for the decentralized registry platform, ensuring reliability, security, and scalability. Given the project's hybrid architecture—combining Solana-based smart contracts (using Anchor and Rust), off-chain components (IPFS pinning via compressed NFTs), backend services (Node.js with Express for x402 integrations and oracle hooks), frontend (Next.js with TypeScript), and database (PostgreSQL via Prisma)—the pipelines address each layer distinctly while maintaining end-to-end integration.

Key principles:
- **Modularity**: Separate workflows for smart contracts, backend, frontend, and infrastructure to allow independent development while enabling full-stack deployments.
- **Security**: Use Solana keypair secrets for on-chain deployments, encrypted environment variables for x402 micropayment handling (e.g., SOL/USDC escrow), and ZK proof validation in tests.
- **Environments**: Support dev (local/Solana devnet), staging (Solana testnet with mock oracles), and prod (Solana mainnet with live Switchboard oracles and IPFS).
- **Tools**: GitHub Actions as the orchestration platform, integrated with Docker for containerization, AWS Fargate for backend hosting, Vercel for frontend, and Anchor CLI for Solana programs. Monitoring via AWS CloudWatch and Vercel Analytics.
- **Triggers**: Pull requests for CI (lint/test), merges to `main` for staging, and tagged releases (e.g., `v1.x.x`) for production.
- **Unique Project Identifiers**: Pipelines incorporate project-specific metadata, such as the registry's DID namespace (`did:solana:registry-agent-hub`) and reputation scoring hooks tied to x402 transaction IDs.

All pipelines adhere to zero-downtime deployments using blue-green strategies on AWS and rolling updates on Vercel. Secrets are managed via GitHub Secrets (e.g., `SOLANA_KEYPAIR_DEV`, `IPFS_API_TOKEN`, `X402_ESCROW_WALLET`).

## Prerequisites

- GitHub repository with branches: `main`, `develop`, `release/*`.
- Installed tools: Node.js (v18+), Rust (v1.70+), Anchor (v0.29+), Solana CLI (v1.17+), Docker.
- Secrets configured in GitHub:
  - `SOLANA_WALLET_DEV`: Base58-encoded keypair for devnet deployments.
  - `SOLANA_WALLET_TEST`: For testnet.
  - `SOLANA_WALLET_PROD`: For mainnet (multi-sig approved).
  - `AWS_ACCOUNT_ID`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`: For Fargate/ECS deployments.
  - `VERCEL_TOKEN`: For frontend deploys.
  - `IPFS_PINATA_KEY`, `IPFS_PINATA_SECRET`: For off-chain NFT pinning.
  - `POSTGRES_URL_DEV/STAGING/PROD`: Connection strings for Prisma migrations.
  - `X402_WEBHOOK_SECRET`: For validating payment settlement hooks.
  - `SWITCHBOARD_QUEUE_ID`: Oracle queue for off-chain attestations.

## Pipeline Components

### 1. Smart Contracts CI/CD (Solana/Anchor Programs)

The core registry programs (`agent_registry.rs`, `reputation_scorer.rs`, `did_manager.rs`) handle on-chain registration, ZK proof verification (zk-SNARKs for work history), and reputation updates triggered by x402 settlements. Pipelines use Anchor for building and Solana CLI for deployment.

#### CI Workflow: `contracts-ci.yml`
- **Trigger**: On push/PR to `contracts/` directory or changes in `programs/`, `tests/`.
- **Stages**:
  1. **Checkout and Setup**:
     - Clone repo, install Rust/Anchor/Solana CLI via matrix (Rust 1.70, Anchor 0.29).
     - Cache dependencies: `cargo` and `anchor` targets.
  2. **Linting**:
     - Run `cargo fmt --check` and `cargo clippy -- -D warnings` for Rust code.
     - Anchor-specific: `anchor build -- --cfg test` to validate IDL generation.
     - Custom lint for Solana-specific patterns (e.g., secure keypair handling in x402 hooks).
  3. **Unit Tests**:
     - `anchor test --skip-local-validator` using Solana devnet fork.
     - Coverage: 80% threshold with `cargo-tarpaulin`.
     - Test cases: Agent registration with DID-linked profiles, ZK proof submission for work history, reputation score updates on mock x402 txn (e.g., escrow release for SOL micropayments).
     - Integration: Mock Switchboard oracle for off-chain validation.
  4. **Build**:
     - `anchor build` to generate BPF binaries and IDL JSON.
     - Compress NFTs for IPFS pinning: Script to bundle capability profiles (skills like NLP/auditing, metrics) as metadata.
  5. **Security Scan**:
     - `cargo audit` for Rust vulnerabilities.
     - Solana-specific: Check for common pitfalls (e.g., unchecked arithmetic in scoring logic) using custom regex linter.
  6. **Artifact Upload**:
     - Upload BPF zips and IDL to GitHub Actions artifacts (tagged with commit SHA).
- **Success Criteria**: All tests pass; coverage report published to GitHub Pages.
- **Failure Handling**: Notify via Slack webhook; block PR merge.

#### CD Workflow: `contracts-cd.yml`
- **Trigger**: Merge to `main` (staging) or tagged release (prod).
- **Stages**:
  1. **Environment Setup**:
     - Switch Solana cluster: devnet/testnet/mainnet based on branch/tag.
     - Load keypair from secrets; validate wallet balance (>0.1 SOL).
  2. **Deploy Programs**:
     - `anchor deploy` for registry programs.
     - Custom script: Post-deploy hooks to initialize DID namespace and reputation badge programs.
     - For prod: Multi-sig approval via GitHub Environments (requires 2/3 approvers).
  3. **Verification**:
     - `solana program show <PROGRAM_ID>` to confirm deployment.
     - Run smoke tests: Register a mock agent, submit ZK proof, trigger x402 settlement simulation.
  4. **IPFS Integration**:
     - Pin compressed NFT metadata (agent endpoints, verifiable histories) to IPFS via Pinata API.
     - Update on-chain links: Store IPFS CID in program state.
  5. **Rollback**:
     - Previous program versions cached; auto-rollback on health check failure (e.g., oracle attestation timeout).
- **Post-Deploy**: Update backend env vars with new program IDs; notify BackendDev via API endpoint `/deploy-notify`.

### 2. Backend CI/CD (Node.js + Express)

Backend handles API endpoints for querying agents, x402 micropayment gateways (HTTP 402 responses for SOL/USDC), oracle integrations (Switchboard for attestations), and TEE-secured private data (e.g., selective ZK disclosure).

#### CI Workflow: `backend-ci.yml`
- **Trigger**: Push/PR to `backend/` or changes in `server/`, `integrations/`.
- **Stages**:
  1. **Setup**:
     - Node 18, yarn install; cache `node_modules`.
  2. **Lint/Type Check**:
     - `eslint . --ext .ts` and `tsc --noEmit` for TypeScript.
     - Focus: x402 hook security (e.g., validate txn signatures).
  3. **Unit/Integration Tests**:
     - Jest: 85% coverage; test x402 escrow release, DID profile queries, ZK proof parsing.
     - Mock Solana RPC for on-chain calls; simulate IPFS pinning.
     - E2E: Use Supertest for API tests (e.g., POST /register-agent with capabilities like speed metrics).
     - Database: Prisma migrate dev; test PostgreSQL queries for off-chain caches.
  4. **Build**:
     - `yarn build` to transpile TS to JS.
  5. **Security/Docker Scan**:
     - `npm audit`; Docker build and `trivy image scan`.
- **Artifacts**: Docker image tagged `backend:${GITHUB_SHA}`.

#### CD Workflow: `backend-cd.yml`
- **Trigger**: Merge to `main` or release tag.
- **Stages**:
  1. **Docker Build/Push**:
     - Multi-stage Dockerfile: Build stage with deps, runtime with Prisma migrations.
     - Push to AWS ECR: `backend-app:${ENV}-${TAG}`.
  2. **Database Migrations**:
     - `prisma migrate deploy` on PostgreSQL (env-specific URLs).
     - Seed dev/staging with mock agent data (e.g., high-rep agents for swarm selection).
  3. **Deploy to AWS Fargate**:
     - ECS service update with blue-green strategy.
     - Env vars: Inject Solana program IDs, x402 wallet, TEE enclave IDs for privacy.
     - Auto-scaling: Based on API load (e.g., agent query spikes from marketplaces).
  4. **Health Checks**:
     - Smoke test: Query `/agents?rep>0.8` endpoint; verify x402 webhook.
     - Integration: Ping Switchboard for attestation; ensure IPFS CIDs resolve.
  5. **Coordination**: POST to internal endpoint for BackendDev sync (e.g., update frontend CORS origins).
- **Monitoring**: Integrate AWS CloudWatch alarms for 5xx errors; Datadog for x402 txn latency.

### 3. Frontend CI/CD (Next.js)

Frontend provides UIs for developers (register/query), marketplaces (embed listings), and end-users (select agents for swarms).

#### CI Workflow: `frontend-ci.yml`
- **Trigger**: Push/PR to `frontend/` or `app/`.
- **Stages**:
  1. **Setup**: Node 18, yarn install; Tailwind build.
  2. **Lint/Build**:
     - `eslint` and `prettier --check`.
     - `yarn build` for static export check.
  3. **Tests**:
     - Jest/RTL for components (e.g., agent profile with ZK disclosure toggles).
     - Cypress E2E: Simulate user flows like selecting high-rep agents via Zustand state.
     - Mock backend APIs for x402 payment previews.
  4. **Accessibility/Security**: Lighthouse CI (score >90); `next lint`.

#### CD Workflow: `frontend-cd.yml`
- **Trigger**: Merge/tag.
- **Stages**:
  1. **Build/Deploy to Vercel**:
     - Connected via GitHub; auto-deploys on merge.
     - Preview branches for PRs; prod on tags.
     - Env: API base URL from backend deploy (fetched via GitHub API).
  2. **Post-Deploy**: Invalidate CDN cache for agent listing pages.
- **Custom**: Embed SDK for marketplaces (e.g., reputation badges via iframe).

### 4. Infrastructure CI/CD (Docker/AWS/Vercel)

Full-stack orchestration, including Terraform for AWS resources (if needed) and Helm for any Kubernetes extensions.

#### Workflow: `infra-cd.yml`
- **Trigger**: On merge to `infra/` or manual dispatch.
- **Stages**:
  1. **Terraform Plan/Apply**:
     - AWS provider: Define Fargate clusters, ECR repos, PostgreSQL RDS.
     - Variables: Env-specific (e.g., prod VPC with private subnets for TEEs).
  2. **Docker Compose Validation**:
     - Local stack: Backend + Postgres + Solana local validator.
  3. **Full Integration Test**:
     - Deploy to staging; run end-to-end suite (e.g., agent swarm selection triggering x402).
  4. **Cleanup**: Prune old images/artifacts.

## Monitoring and Maintenance

- **Dashboards**: GitHub Actions insights; AWS X-Ray for traces (e.g., Solana RPC calls).
- **Alerts**: PagerDuty for prod failures (e.g., reputation score drift >5%).
- **Versioning**: Semantic releases with `conventional-changelog`; automate changelog in MD.
- **Backup/Restore**: Weekly PostgreSQL snapshots; Solana program state exports to IPFS.
- **Compliance**: Audit logs for x402 txns; GDPR-aligned privacy (ZK selective disclosure).

This configuration ensures seamless coordination: Smart contract deploys notify backend via webhooks, backend updates trigger frontend rebuilds. For customizations, contact DevOpsEngineer (ID: 1762759105720_proof_of_service_agent_registry_with_dynamic_reputation_scoring__infra_ci_cd_md_26s1n). Last updated: [Auto-generated timestamp].