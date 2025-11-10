# Unit Tests Structure for Proof-of-Service Agent Registry with Dynamic Reputation Scoring

## Overview

This document outlines the unit testing strategy for the Proof-of-Service Agent Registry platform, a decentralized web application built on Solana for AI agent registration, verifiable work histories, and dynamic reputation scoring integrated with x402 micropayments. Unit tests focus on isolated validation of individual components, ensuring reliability across the stack: Solana smart contracts (Anchor/Rust), backend services (Node.js/Express), frontend components (Next.js/TypeScript), and database interactions (PostgreSQL/Prisma).

The testing approach emphasizes:
- **Coverage Goals**: Aim for 85%+ code coverage, prioritizing critical paths like agent registration, reputation updates, ZKP verification, and x402 settlement hooks.
- **Tools and Frameworks**:
  - Solana Programs: Anchor's built-in testing framework with `@solana/web3.js` and `@project-serum/anchor`.
  - Backend: Jest with Supertest for API endpoints.
  - Frontend: Vitest (integrated with Next.js) for React components and utilities.
  - Database: Prisma's test utilities with Jest for schema validation and query isolation.
  - General: Mocking libraries (e.g., `sinon` for stubs, `@solana/web3.js` mocks for blockchain interactions) to simulate Solana, IPFS, and oracle dependencies without external calls.
- **Execution**: Tests run in CI/CD pipelines (e.g., GitHub Actions) via `npm run test:unit`. Use `.env.test` for isolated environments, avoiding mainnet interactions.
- **Best Practices**: Tests are deterministic, use fixtures for setup (e.g., sample agent DIDs), and assert on project-specific behaviors like reputation score calculations tied to x402 settlements. No duplication of integration/e2e tests; focus on units only.

Tests are organized by project layers, aligning with the technical requirements (Solana DIDs, ZKPs via zk-SNARKs, IPFS pinning, Switchboard oracles, and TEE privacy). All test files reside in `__tests__` subdirectories within their respective modules (e.g., `programs/registry/__tests__/agentRegistration.test.ts`).

## Solana Smart Contracts Unit Tests (Anchor/Rust)

These tests validate the core on-chain logic for agent registry, DID-linked profiles, reputation scoring, and x402 escrow releases. Written in TypeScript using Anchor's provider-based testing, they simulate Solana runtime with local validator mocks.

### Key Test Suites
1. **Agent Registration and Capability Profiling**:
   - Test initialization of agent accounts with skills (e.g., NLP, auditing), metrics (success rate, speed), and endpoints (API URLs, program IDs).
   - Example: `agentRegistration.test.ts`
     ```typescript
     import * as anchor from "@coral-xyz/anchor";
     import { Program } from "@coral-xyz/anchor";
     import { Registry } from "../target/types/registry"; // Generated IDL

     describe("Agent Registration", () => {
       const provider = anchor.AnchorProvider.env();
       anchor.setProvider(provider);
       const program = anchor.workspace.Registry as Program<Registry>;
       const [agentPda] = anchor.web3.PublicKey.findProgramAddressSync(
         [Buffer.from("agent"), wallet.publicKey.toBuffer()],
         program.programId
       );

       it("should register agent with DID-linked capabilities", async () => {
         const capabilities = {
           skills: ["NLP", "auditing"],
           successRate: 0.95,
           speed: 500, // ms
           endpoint: "https://api.agent.example.com",
           programId: new anchor.web3.PublicKey("...") // Solana program ID
         };

         await program.methods
           .registerAgent(capabilities)
           .accounts({ agent: agentPda, authority: provider.wallet.publicKey })
           .rpc();

         const agentAccount = await program.account.agent.fetch(agentPda);
         expect(agentAccount.capabilities.skills).toEqual(["NLP", "auditing"]);
         expect(agentAccount.did).toBeDefined(); // Solana DID verification
       });
     });
     ```
   - Edge Cases: Invalid DID (revocable key mismatch), duplicate registrations, IPFS CID pinning via compressed NFT mocks.

2. **Dynamic Reputation Scoring**:
   - Verify score updates post-task completion, factoring success rates and x402 settlements (e.g., SOL/USDC releases).
   - Example: `reputationScoring.test.ts`
     ```typescript
     it("should update reputation score on successful x402 settlement", async () => {
       // Mock prior task completion
       await program.methods.completeTask(taskId, true).rpc(); // success = true
       // Simulate x402 hook: escrow release
       const escrowPda = // ... derive PDA
       await program.methods.releaseEscrow(taskId, { amount: 100 }).accounts({ escrow: escrowPda }).rpc();

       const agentAccount = await program.account.agent.fetch(agentPda);
       // Formula: score = (successes / total) * 100 + settlement_bonus (e.g., +10 for timely payment)
       expect(agentAccount.reputationScore).toBeGreaterThan(85); // Initial 80 + bonus
     });
     ```
   - Edge Cases: Failed tasks (score penalty), oracle attestation mocks (Switchboard for off-chain validation).

3. **Work History Verification with ZKPs**:
   - Test zk-SNARK proof submission for selective disclosure (e.g., reveal success rate without full history).
   - Example: Use `@lightprotocol/zk` mocks to verify proof validity without generating real SNARKs.
     ```typescript
     it("should verify ZKP for work history without full disclosure", async () => {
       const proof = { /* Mock zk-SNARK: public inputs = success rate 0.95 */ };
       await program.methods.verifyWorkHistory(proof, { reveal: ["successRate"] }).rpc();
       // Assert: Proof accepted, history PDA updated immutably
     });
     ```
   - Edge Cases: Invalid proofs, TEE-simulated private data (mock enclave seals).

4. **x402 Integration Hooks**:
   - Unit test escrow creation/release on HTTP 402 triggers, using mocked transaction signatures.
   - Coverage: Micropayment settlements (SOL/USDC), auto-reputation triggers.

Run with `anchor test` in the `programs/` directory. Fixtures include sample wallets and PDAs derived from DIDs.

## Backend Unit Tests (Node.js/Express)

Backend tests isolate API handlers, services, and utilities for off-chain logic like IPFS pinning, oracle queries, and x402 webhook processing. Use Jest for async testing with `beforeEach` setups.

### Key Test Suites
1. **API Endpoints for Agent Query/Selection**:
   - Test `/api/agents/register` and `/api/agents/query` for developers/marketplaces/end-users.
   - Example: `agentService.test.ts`
     ```typescript
     import { agentService } from "../services/agentService";
     import { PrismaClient } from "@prisma/client";

     const prisma = new PrismaClient({ datasources: { db: { url: "file:./test.db" } } });

     describe("Agent Service", () => {
       beforeEach(async () => {
         await prisma.agent.deleteMany();
       });

       it("should register agent and pin capabilities to IPFS", async () => {
         const agentData = {
           did: "did:solana:...", // Solana DID
           capabilities: { skills: ["NLP"], successRate: 0.95 },
           reputationScore: 80
         };

         const result = await agentService.register(agentData);
         expect(result.ipfsCid).toMatch(/^Qm/); // Valid IPFS CID
         expect(result.compressedNftMint).toBeDefined(); // Mock Solana mint
       });
     });
     ```
   - Edge Cases: DID ownership checks (revocable keys), privacy filters (ZK selective disclosure mocks).

2. **x402 Payment Settlement Service**:
   - Validate webhook handlers for task completion → escrow release → reputation update.
   - Example: Integrate `@solana/web3.js` mocks for transaction simulation.
     ```typescript
     it("should trigger reputation update on x402 settlement", async () => {
       const webhookPayload = { txnSig: "mockSig", amount: 50, currency: "USDC" };
       await x402Service.handleSettlement(webhookPayload);
       const updatedAgent = await prisma.agent.findUnique({ where: { did: "..." } });
       expect(updatedAgent.reputationScore).toBe(90); // +10 bonus
     });
     ```

3. **Oracle and Attestation Utilities**:
   - Mock Switchboard oracles for off-chain task validation (e.g., speed metrics).
   - Example: `oracleService.test.ts` – Assert attestation data feeds into reputation without real oracle calls.

4. **Privacy and TEE Helpers**:
   - Test ZK disclosure logic and TEE mocks for private history storage (prevent doxxing).

Tests in `backend/__tests__/`, run with `npm test:backend`. Use Prisma's `generate` for schema mocks, coordinating with `db/schema.md`.

## Frontend Unit Tests (Next.js/TypeScript)

Frontend tests cover React components, hooks, and utilities for UI interactions like agent search, profile views, and swarm selection. Use Vitest with `@testing-library/react` and MSW for API mocking.

### Key Test Suites
1. **Agent Registry Components**:
   - Test `<AgentProfile />` for rendering capabilities, badges (public reputation), and selective history disclosure.
   - Example: `AgentProfile.test.tsx`
     ```tsx
     import { render, screen } from "@testing-library/react";
     import { AgentProfile } from "../components/AgentProfile";
     import { mockAgentData } from "./__mocks__/agentData";

     vi.mock("next/router", () => ({ useRouter: () => ({ query: { did: "did:solana:..." } }) }));

     describe("AgentProfile", () => {
       it("should render capabilities and reputation badge", () => {
         render(<AgentProfile agent={mockAgentData} />);
         expect(screen.getByText("Skills: NLP, Auditing")).toBeInTheDocument();
         expect(screen.getByText("Reputation: 85/100")).toBeInTheDocument(); // Public badge
         // ZK disclosure: Only reveals selected metrics
         expect(screen.queryByText("Private History")).not.toBeInTheDocument();
       });
     });
     ```
   - Edge Cases: Loading states for IPFS fetches, error handling for low-rep agents.

2. **Query and Selection Hooks**:
   - Test `useAgentQuery` hook for marketplace embeddings and end-user swarms.
   - Example: Mock Zustand store for state management, assert filtered high-rep agents.

3. **x402 Payment UI Utilities**:
   - Unit test payment modals and settlement confirmations, mocking backend APIs.

Tests in `frontend/__tests__/`, run with `npm test:frontend`. Aligns with TailwindCSS components; mocks Prisma queries via API stubs.

## Database Unit Tests (PostgreSQL/Prisma)

Isolate schema validations and query logic, using in-memory SQLite for speed (via Prisma's URL override).

### Key Test Suites
1. **Agent and History Models**:
   - Test CRUD for agents, linking to Solana DIDs and IPFS CIDs.
   - Example: `agentModel.test.ts`
     ```typescript
     it("should create agent record with reputation field", async () => {
       const agent = await prisma.agent.create({
         data: { did: "did:solana:...", reputationScore: 80, ipfsCid: "Qm..." }
       });
       expect(agent.reputationScore).toBe(80);
       // Foreign key to workHistory
       await prisma.workHistory.create({ data: { agentId: agent.id, verified: true } });
     });
     ```
   - Edge Cases: Unique constraints on DIDs, soft deletes for revocable ownership.

2. **Reputation and Settlement Queries**:
   - Validate aggregations (e.g., average success rate) without on-chain calls.

Tests in `db/__tests__/`, run with `npm test:db`. References `db/schema.md` and `db/migrations.md` for model definitions; ensures no migration logic here (unit only).

## Maintenance and Coverage Reporting

- **Reporting**: Use `jest --coverage` and `vitest --coverage` to generate reports in `coverage/`; threshold failures block PRs.
- **Fixtures and Mocks**: Centralized in `__mocks__/` (e.g., sample x402 payloads, zk-proof stubs, Solana keypairs).
- **Unique Project Focus**: All tests incorporate domain specifics like ZK privacy (no full history leaks) and x402 hooks (settlement idempotency).
- **Version Control**: Tag tests with unique ID `1762759129213` for traceability.

This structure ensures modular, verifiable components, supporting the platform's decentralized trust model without overlapping integration tests. Update as features evolve, e.g., new oracle integrations.