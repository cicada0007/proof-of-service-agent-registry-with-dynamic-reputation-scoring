# API Tests for Proof-of-Service Agent Registry

## Overview

This document outlines comprehensive API tests for the backend services of the Proof-of-Service Agent Registry with Dynamic Reputation Scoring. The APIs are built using Node.js with Express, integrated with PostgreSQL via Prisma ORM for centralized data management, and Solana blockchain via Anchor for decentralized components. Tests simulate interactions with off-chain elements like IPFS for data pinning, x402 protocol for micropayments (mocked with SOL/USDC equivalents), and ZKPs (zk-SNARKs) for verifiable proofs.

Tests are implemented using Jest and Supertest for unit/integration testing, with mocks for external dependencies (e.g., Solana RPC, IPFS nodes, Switchboard oracles, and TEEs). Coverage targets 90%+ for critical paths, focusing on agent registration, work history verification, reputation updates, and query mechanisms.

Key assumptions:
- Environment: Local development with Dockerized PostgreSQL and Solana devnet.
- Authentication: JWT-based for developer/end-user sessions; Solana signatures for agent DIDs.
- Privacy: Tests validate ZK selective disclosure without exposing full histories.
- Uniqueness: These tests incorporate project-specific logic, such as auto-updating reputation on x402 settlement hooks and DID-linked capability profiles.

Run tests with: `npm test -- --coverage`

## Prerequisites

1. **Setup Database**: Run Prisma migrations with `npx prisma migrate dev` and seed test data:
   ```prisma
   // prisma/seed.ts (excerpt for agent registry)
   import { PrismaClient } from '@prisma/client';
   const prisma = new PrismaClient();

   async function seed() {
     await prisma.agent.create({
       data: {
         did: 'did:solana:TestAgent123', // Solana DID
         capabilities: {
           create: [
             { skill: 'NLP', successRate: 0.95, endpoint: 'https://api.test-agent.com/nlp' }
           ]
         },
         reputationScore: 0.0 // Initial score
       }
     });
   }
   seed();
   ```

2. **Mock External Services**:
   - Solana: Use `@solana/web3.js` mocks for wallet signing and program interactions.
   - IPFS: Mock pinning with `ipfs-http-client` stubs returning CID hashes.
   - x402: Simulate HTTP 402 responses with escrow release using a mock payment gateway (e.g., in-memory SOL/USDC ledger).
   - ZKPs: Mock zk-SNARK verification with `circom` library stubs, ensuring proofs validate without full disclosure.
   - Oracles: Mock Switchboard attestations for off-chain task validation.

3. **Test Configuration** (`jest.config.js` excerpt):
   ```javascript
   module.exports = {
     testEnvironment: 'node',
     setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
     coverageThreshold: { global: { branches: 90, functions: 90, lines: 90 } }
   };
   ```

## Test Suites

### 1. Agent Registration and Profile Management

Tests for registering AI agents with DID-linked profiles, including capabilities (skills, metrics, endpoints) stored on-chain (Solana compressed NFTs) and off-chain (IPFS).

#### Test Case: Register New Agent (Happy Path)
- **Endpoint**: `POST /api/v1/agents/register`
- **Description**: Creates a new agent profile, pins capability data to IPFS, mints a compressed NFT on Solana, and initializes reputation at 0.0.
- **Request**:
  ```json
  {
    "did": "did:solana:NewAgent456",
    "capabilities": [
      {
        "skill": "Auditing",
        "successRate": 0.98,
        "speedMs": 150,
        "endpoint": "https://solana-program:audit/v1"
      }
    ],
    "walletSignature": "sig_from_solana_wallet_for_did"
  }
  ```
- **Expected Response**: 201 Created
  ```json
  {
    "agentId": "uuid-generated",
    "did": "did:solana:NewAgent456",
    "ipfsCid": "QmExampleHashForCapabilities",
    "nftMint": "SolanaCompressedNftAddress",
    "reputationScore": 0.0
  }
  ```
- **Assertions**:
  - Database: Verify entry in `Agent` and `Capability` tables with DID ownership.
  - Blockchain: Mock Solana program call succeeds; NFT linked to DID.
  - IPFS: CID pinned and retrievable.
  - Edge: Revocable keys tested by simulating key rotation (updates DID metadata).
- **Implementation Snippet** (`tests/agents/register.test.js`):
  ```javascript
  const request = require('supertest');
  const app = require('../../src/app');
  const { mockSolanaSign, mockIpfsPin } = require('../mocks');

  describe('POST /api/v1/agents/register', () => {
    beforeEach(() => {
      mockSolanaSign.mockResolvedValue('valid_sig');
      mockIpfsPin.mockResolvedValue('QmPinnedCid');
    });

    it('registers agent successfully', async () => {
      const res = await request(app)
        .post('/api/v1/agents/register')
        .send({ /* request body */ })
        .expect(201);

      expect(res.body.ipfsCid).toBe('QmPinnedCid');
      expect(mockSolanaSign).toHaveBeenCalledWith(expect.objectContaining({ did: 'did:solana:NewAgent456' }));
    });

    it('fails on invalid DID signature', async () => {
      mockSolanaSign.mockRejectedValue(new Error('Invalid sig'));
      await request(app)
        .post('/api/v1/agents/register')
        .send({ /* body */ })
        .expect(401, { error: 'DID verification failed' });
    });
  });
  ```

#### Test Case: Update Agent Capabilities
- **Endpoint**: `PUT /api/v1/agents/:id/capabilities`
- **Description**: Updates metrics (e.g., success rate) with ZK proof of ownership; re-pins to IPFS.
- **Assertions**: Ensures no full history disclosure; only delta changes persist.
- **Edge Cases**: Invalid agent ID (404), Unauthorized update (403), IPFS pinning failure (500).

#### Test Case: Query Agent Profile
- **Endpoint**: `GET /api/v1/agents/:did`
- **Description**: Retrieves profile with selective ZK disclosure (e.g., public badges, private metrics via TEE mock).
- **Expected**: Includes capabilities, reputation, but masks sensitive endpoints without proof.
- **Assertions**: Filters for privacy; supports marketplace embeddings (e.g., JSON-LD for listings).

### 2. Work History Verification and Task Completion

Tests for submitting verifiable work histories using ZKPs, oracles, and x402 transactions as proofs.

#### Test Case: Submit Task Completion Proof (Happy Path)
- **Endpoint**: `POST /api/v1/tasks/complete`
- **Description**: Submits ZK-SNARK proof for task success, triggers Switchboard oracle attestation, and hooks x402 for payment settlement.
- **Request**:
  ```json
  {
    "agentDid": "did:solana:TestAgent123",
    "taskId": "uuid-task-789",
    "zkProof": "base64_snark_proof_for_success",
    "x402PaymentId": "402-token-for-sol-0.01"
  }
  ```
- **Expected Response**: 200 OK
  ```json
  {
    "verificationStatus": "attested",
    "oracleAttestation": "switchboard_hash",
    "escrowReleased": true
  }
  ```
- **Assertions**:
  - ZKP: Mock verification passes (e.g., using Groth16).
  - Oracle: Mock Switchboard feed confirms off-chain validation.
  - x402: Simulates escrow release; updates PostgreSQL ledger.
  - Database: Appends to `WorkHistory` table with ZK-hashed proof.
- **Implementation Snippet**:
  ```javascript
  describe('POST /api/v1/tasks/complete', () => {
    it('verifies and settles task', async () => {
      const mockZkVerify = jest.fn().mockReturnValue(true);
      // Inject mock into service

      const res = await request(app).post('/api/v1/tasks/complete').send({ /* body */ }).expect(200);
      expect(mockZkVerify).toHaveBeenCalledWith('base64_snark_proof_for_success');
      expect(res.body.escrowReleased).toBe(true);
    });

    it('rejects invalid ZK proof', async () => {
      // Mock fail
      await request(app).post('/api/v1/tasks/complete').send({ /* invalid proof */ }).expect(400, { error: 'ZK verification failed' });
    });
  });
  ```

#### Test Case: Retrieve Verifiable Work History
- **Endpoint**: `GET /api/v1/agents/:did/history?selective=true`
- **Description**: Returns aggregated history with ZK selective disclosure (e.g., success counts without details).
- **Assertions**: Ensures privacy (no doxxing); supports end-user selection for swarms.

#### Edge Cases
- Oracle failure: Retries with exponential backoff.
- x402 timeout: Rolls back escrow; deducts reputation penalty.

### 3. Dynamic Reputation Scoring

Tests for updating scores based on task outcomes and payments, using on-chain hooks.

#### Test Case: Update Reputation on Settlement
- **Endpoint**: `POST /api/v1/reputation/update` (Triggered via x402 webhook)
- **Description**: Calculates score delta (e.g., +0.1 for success, weighted by speed/skill); updates Solana program and DB.
- **Request** (Webhook payload):
  ```json
  {
    "x402TxnId": "sol_txn_hash",
    "agentDid": "did:solana:TestAgent123",
    "taskOutcome": "success",
    "paymentAmount": "0.01 SOL"
  }
  ```
- **Expected Response**: 200 OK, with new score.
- **Assertions**:
  - Formula: score = prev + (success * weight) - penalties; clamped 0-1.
  - Blockchain: Mock Anchor instruction for on-chain badge update.
  - Public Badge: Emits event for marketplace queries.
- **Implementation Snippet**:
  ```javascript
  describe('POST /api/v1/reputation/update', () => {
    beforeEach(() => {
      // Seed agent with score 0.5
    });

    it('increments score on success', async () => {
      const res = await request(app).post('/api/v1/reputation/update').send({ /* payload */ }).expect(200);
      expect(res.body.newScore).toBeGreaterThan(0.5);
    });

    it('handles payment disputes', async () => {
      // Simulate partial settlement
      await request(app).post('/api/v1/reputation/update').send({ taskOutcome: 'partial' }).expect(200);
      // Verify minimal delta applied
    });
  });
  ```

#### Test Case: Query Reputation
- **Endpoint**: `GET /api/v1/reputation/:did`
- **Description**: Returns current score and history summary; supports filtering for high-rep agents.
- **Assertions**: ZK disclosure for private scores; public for badges.

### 4. Integration and Security Tests

#### Cross-Endpoint Integration
- **Scenario**: Full flow - Register agent → Complete task with x402 → Update reputation → Query profile.
- **Assertions**: End-to-end consistency; e.g., reputation reflects in profile query.

#### Security Tests
- **Rate Limiting**: Test `/agents/register` with 100 req/s → 429.
- **Input Validation**: SQL injection attempts on queries (Prisma sanitizes).
- **Auth Bypass**: Unsigned requests → 401; Solana sig replay → 403.
- **Privacy Leaks**: Ensure TEE mocks prevent off-chain data exposure.
- **DDoS Simulation**: Using `artillery` for load tests on query endpoints.

#### Error Handling
- 4xx: Invalid DID (400), Unauthorized (401), Not Found (404).
- 5xx: Solana RPC outage (mock retry), IPFS unavailable (fallback to on-chain).

## Coverage Report and CI Integration

- **Tools**: Jest for execution, SonarQube for analysis.
- **CI/CD**: Integrate with GitHub Actions; run on PRs targeting `main`.
  ```yaml
  # .github/workflows/test.yml (excerpt)
  - name: Run API Tests
    run: npm test
    env:
      DATABASE_URL: ${{ secrets.TEST_DB_URL }}
      SOLANA_RPC: devnet
  ```
- **Metrics**: Track test duration (<5s per suite), flakiness (retry failed ZK mocks).

This test suite ensures robust, production-ready APIs tailored to the decentralized agent registry, emphasizing trust via verifiable proofs and privacy via ZK/TEE mechanisms. For updates, coordinate with FrontendDev on contract changes (e.g., response schemas). 

*Generated for file: proof-of-service-agent-registry-with-dynamic-reputation-scoring//testing/api_tests.md (ID: 1762759105753_proof_of_service_agent_registry_with_dynamic_reputation_scoring__testing_api_tests_md_jkuv2f)*