# Proof-of-Service Agent Registry with Dynamic Reputation Scoring: Project Rules

## Overview
This document outlines the mandatory rules and guidelines for contributing to, developing, and maintaining the "Proof-of-Service Agent Registry with Dynamic Reputation Scoring" project. As a decentralized web application built on Solana, integrating IPFS for off-chain storage, x402 protocol for micropayments, and zero-knowledge proofs (ZKPs) for privacy-preserving verifications, all team members (including Product Managers, FrontendDev, BackendDev, and other agents) must adhere to these rules to ensure consistency, security, scalability, and alignment with the project's core intent: creating a "credit bureau for AI agents" that enables verifiable capabilities, work histories, and dynamic reputation scores.

These rules are derived from the project's technical requirements, target audience (developers, AI agent marketplaces, and end-users), and key features such as DID-linked profiles, oracle integrations (e.g., Switchboard), and TEEs for private data handling. Violations may result in rejected pull requests (PRs) or code freezes. This file complements the [README.md](../README.md) (project overview), [db/schema.md](../db/schema.md) (database structure), and [db/migrations.md](../db/migrations.md) (migration procedures) without duplicating their content.

**Unique Identifier for This Document:** 1762759129203_proof_of_service_agent_registry_with_dynamic_reputation_scoring__docs_PROJECT_RULES_md_jagrbq  
**Last Updated:** [Insert Date]  
**Version:** 1.0

## 1. General Project Rules
- **Scope Adherence:** All features must directly support AI agent registration (capabilities like NLP skills, success metrics, and Solana program IDs), verifiable work history (via ZKPs or x402 transaction proofs), dynamic reputation scoring (updated on task completion and payment settlements), and query mechanisms for developers, marketplaces, and end-users. No off-topic features (e.g., unrelated social features) are allowed.
- **Decentralization First:** Prioritize on-chain logic for core registry operations using Solana Anchor/Rust programs. Off-chain elements (e.g., IPFS-pinned data via compressed NFTs) must be explicitly linked to on-chain DIDs with revocable keys for agent ownership.
- **Privacy and Ownership Mandates:** Agent data must use ZK selective disclosure (e.g., zk-SNARKs) for work histories to prevent doxxing. Public elements are limited to reputation badges; private data requires TEEs. Agents retain full ownership via Solana DIDs—implement revocation hooks in all profile updates.
- **Target Audience Focus:** Rules must ensure usability for primary users:
  - Developers: Easy registration/query APIs.
  - Marketplaces: Embeddable components for listings with reputation filters.
  - End-users: Intuitive selection interfaces for agent swarms, highlighting high-rep agents.
- **No Vendor Lock-in:** Avoid proprietary tools; stick to open-source stacks (e.g., no closed-source oracles beyond Switchboard).
- **Sustainability:** Code must optimize for Solana's high throughput—limit compute units per instruction to <200k for registry updates. IPFS pinning must use compressed NFTs to minimize gas costs.

## 2. Technical Guidelines
### Frontend (Next.js App Router, TailwindCSS, TypeScript, Zustand/Redux Toolkit)
- **UI/UX Rules:** Interfaces must display reputation scores as dynamic badges (e.g., color-coded based on success rates) without exposing private histories. Use selective disclosure prompts for ZK-verified queries. All components must be responsive for web access by end-users selecting agents.
- **State Management:** Zustand/Redux Toolkit stores must cache off-chain data (e.g., IPFS profiles) temporarily but fetch fresh on-chain reputation via Solana RPC on every interaction. No persistent local storage of sensitive data.
- **Integration Rules:** Frontend must hook into backend APIs for x402 micropayments (SOL/USDC)—implement HTTP 402 intercepts for task-triggered settlements. Coordinate with BackendDev: All API calls must include DID signatures for authentication.
- **TypeScript Strictness:** Enforce `strict: true` in tsconfig.json. Define interfaces for agent capabilities (e.g., `{ skills: string[], metrics: { successRate: number, speed: number }, endpoints: string[] }`) mirroring backend schemas.
- **Accessibility:** Follow WCAG 2.1 AA standards, especially for query results (e.g., alt text for reputation visualizations).

### Backend (Node.js + Express, Optional FastAPI/NestJS; PostgreSQL with Prisma ORM)
- **API Design Rules:** Expose RESTful endpoints for agent registration/query (e.g., `/agents/register`, `/agents/query?repMin=0.8`), with GraphQL optional for complex filters (e.g., by skills or swarm compatibility). All responses must include ZK-proof verification status.
- **Database Rules:** Use PostgreSQL for off-chain indexing (e.g., caching IPFS hashes). Prisma schemas must extend [db/schema.md](../db/schema.md) with fields for DID links, reputation scores (as decimals 0-1), and x402 txn IDs. No direct storage of private histories—use TEE-encrypted blobs.
- **Blockchain Integration:** Backend must orchestrate Solana program calls via Anchor (Rust) for on-chain updates (e.g., reputation increments post-x402 settlement). Implement webhooks for Switchboard oracles to validate off-chain task completions. Coordinate with FrontendDev: APIs return compressed NFT metadata for IPFS data.
- **Payment Handling:** x402 protocol hooks are mandatory—task completion triggers escrow release (e.g., via Solana SPL tokens). Log settlements as implicit proofs but anonymize via ZKPs. Support SOL/USDC only; no fiat integrations.
- **Error Handling:** All endpoints must return structured errors (e.g., `{ code: 'ZK_VERIFICATION_FAILED', details: 'Invalid proof' }`). Rate-limit queries to 100/min per IP to prevent oracle spam.

### Infrastructure and Deployment (Docker, AWS Fargate/Lambda, Vercel)
- **Containerization:** All services (frontend, backend, Solana relayer) must be Dockerized with multi-stage builds. Include health checks for Solana RPC connectivity.
- **Deployment Rules:** Use Vercel for frontend, AWS Fargate for backend/Solana interactions. Secrets (e.g., oracle keys, TEE enclaves) via AWS SSM. No direct IPFS node hosting—use public gateways with custom pinning services.
- **Scaling:** Auto-scale backend based on Solana congestion metrics. Ensure 99.9% uptime for x402 hooks to avoid reputation update delays.
- **Monitoring:** Integrate Prometheus/Grafana for metrics like reputation update latency and ZKP verification times. Alert on oracle failures.

## 3. Security and Privacy Rules
- **ZK and Privacy Enforcement:** Every work history entry requires zk-SNARK proofs (e.g., via circom circuits) for task success without revealing details. TEEs (e.g., AWS Nitro) must enclose private off-chain computations.
- **Authentication:** Mandate Solana wallet signatures for all mutations (e.g., registration). DIDs must support key rotation every 90 days.
- **Vulnerability Scans:** Run Snyk/OWASP ZAP weekly on backend APIs. Audit Solana programs with Certik or similar before mainnet.
- **Data Rules:** No logging of x402 payment details beyond txn hashes. IPFS data must be encrypted client-side before pinning.
- **Compliance:** Adhere to GDPR for end-user queries (e.g., anonymize swarm selections). No storage of PII; agent profiles are pseudonymous.

## 4. Development and Contribution Process
- **Branching Strategy:** Use Git Flow: `main` for production, `develop` for integration, feature branches as `feature/[agent-capability-registration]`. Prefix PRs with `[FE]`, `[BE]`, or `[BLOCKCHAIN]` for coordination.
- **Code Review Rules:** Minimum 2 approvals per PR. ProductManager must sign off on feature completeness against key requirements (e.g., x402 integration). BackendDev reviews frontend API usages; FrontendDev reviews backend endpoints.
- **Testing Mandates:** 
  - Unit: 80% coverage with Jest/Vitest.
  - Integration: Test Solana program interactions with Anchor tests; simulate x402 flows with mock oracles.
  - E2E: Cypress for frontend flows (e.g., agent query to swarm selection).
  - Security: Include ZKP fuzzing in CI/CD.
- **Commit Standards:** Conventional Commits (e.g., `feat(registry): add DID revocation hook`). Include JIRA-like tickets if applicable.
- **Documentation:** Every PR must update relevant docs (e.g., API specs in Swagger). Maintain examples in code comments for ZK proof generation.
- **Coordination Protocol:** Weekly syncs: ProductManager clarifies requirements; FrontendDev/BackendDev flag implementability issues. Use Slack/ Discord for ad-hoc (e.g., "IPFS pinning bottleneck?").

## 5. Quality Assurance and Best Practices
- **Performance Rules:** Reputation scoring updates must complete in <5s (on-chain + oracle). Optimize queries for <100ms response times.
- **Error and Logging:** Centralized logging with ELK stack; trace IDs for x402 flows. No console.logs in production.
- **Versioning:** Semantic versioning for packages. Solana programs: Use Anchor's upgradeable pattern for reputation logic.
- **Ethical AI Rules:** Reputation scores must penalize (e.g., -0.1) for detected biases in capabilities (e.g., NLP fairness checks via third-party attestations).
- **Sustainability Checks:** CI/CD must enforce Solana compute limits; flag high-gas PRs.

## Enforcement and Updates
- **Enforcement:** ProductManager oversees compliance; repeated violations trigger code ownership reassignment.
- **Updates:** Revise this document via PR with changelog. Notify team via project channels.
- **Exceptions:** Rare deviations (e.g., new oracle) require ProductManager approval in writing.

By following these rules, we ensure the project delivers a robust, trust-enabled registry that empowers AI agents in decentralized ecosystems. For questions, reference the [README.md](../README.md) or contact the ProductManager.