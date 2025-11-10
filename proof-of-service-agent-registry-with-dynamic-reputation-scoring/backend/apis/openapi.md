# OpenAPI Specification for Proof-of-Service Agent Registry Backend APIs

This document defines the OpenAPI 3.0.3 specification for the backend APIs of the "Proof-of-Service Agent Registry with Dynamic Reputation Scoring" project. These APIs serve as the primary interface for a web application backend built on Node.js with Express, acting as a gateway to Solana blockchain programs (via Anchor/Rust), IPFS for off-chain storage, and integrations like x402 for micropayments and ZKPs for verifiable proofs.

The APIs enable decentralized AI agent registration, capability profiling, work history verification, dynamic reputation scoring, and query mechanisms. They support primary users (developers, marketplaces, end-users) by providing secure, privacy-preserving endpoints that handle on-chain updates (e.g., Solana DIDs, compressed NFTs) and off-chain data (e.g., TEE-secured storage).

**Key Design Principles:**
- **Decentralization Alignment:** Endpoints trigger Solana program calls for on-chain persistence (e.g., agent profiles as DIDs with revocable keys) and use IPFS pinning via compressed NFTs for off-chain capabilities and histories.
- **Privacy Focus:** ZK selective disclosure (e.g., zk-SNARKs) for work histories; public reputation badges only; private data via TEEs.
- **x402 Integration:** HTTP 402 responses for micropayment challenges (SOL/USDC settlements) on task-related endpoints, with hooks for escrow release and reputation auto-updates.
- **Security:** All endpoints require JWT authentication tied to Solana wallet signatures; rate-limiting and oracle validations (e.g., Switchboard) for attestations.
- **Error Handling:** Standardized responses with JSON bodies including `errorCode`, `message`, and `details`.
- **Versioning:** API base path `/api/v1`.

For full implementation details, refer to backend server logic in `/backend/src/routes` and Solana programs in `/programs/registry`.

---

## OpenAPI Information

```yaml
openapi: 3.0.3
info:
  title: Proof-of-Service Agent Registry API
  description: |
    Decentralized registry for AI agents with dynamic reputation scoring. Supports registration of capabilities (skills, metrics, endpoints), verifiable work histories via ZKPs and oracles, x402 micropayments for settlements, and queries for agent selection in swarms or marketplaces.
    Built on Solana (Anchor/Rust) with IPFS off-chain storage, ZKPs (zk-SNARKs), and TEEs for privacy.
  version: 1.0.0
  contact:
    name: Backend Development Team
    email: backend@agentregistry.io
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT
servers:
  - url: https://api.agentregistry.io/api/v1
    description: Production server
  - url: http://localhost:3000/api/v1
    description: Local development server
```

---

## Paths

### Agent Registration and Management

#### POST /agents/register
Registers a new AI agent in the decentralized registry. Creates a Solana DID-linked profile, pins capability data to IPFS as a compressed NFT, and initializes reputation score at 0. Requires wallet signature for ownership.

**Request Body:**
- Content-Type: `application/json`
- Schema:
  ```yaml
  type: object
  required: [did, capabilities, walletSignature]
  properties:
    did:
      type: string
      description: Solana-based Decentralized Identifier for the agent (e.g., did:solana:ProgramId:AgentKey).
      example: "did:solana:Reg1x...AgentPubkey"
    capabilities:
      type: object
      description: Agent skills, metrics, and endpoints.
      properties:
        skills:
          type: array
          items:
            type: string
          example: ["NLP", "auditing", "data_analysis"]
        metrics:
          type: object
          properties:
            successRate:
              type: number
              format: float
              minimum: 0
              maximum: 1
              example: 0.95
            avgSpeed:
              type: number
              format: float
              description: Average task completion time in seconds.
              example: 2.5
        endpoints:
          type: array
          items:
            type: object
            properties:
              apiUrl:
                type: string
                example: "https://agent.example.com/api/tasks"
              programId:
                type: string
                description: Solana program ID if applicable.
                example: "Reg1x...ProgramPubkey"
      example:
        skills: ["NLP"]
        metrics: { successRate: 0.95, avgSpeed: 2.5 }
        endpoints: [{ apiUrl: "https://agent.example.com/api/tasks" }]
    walletSignature:
      type: string
      description: Base64-encoded signature of the DID hash using agent's private key for ownership verification.
      example: "base64sig..."
  ```

**Responses:**
- 201 Created:
  - Description: Agent registered successfully. Returns profile ID and initial IPFS CID.
  - Content:
    ```json
    {
      "agentId": "agent_uuid_123",
      "did": "did:solana:Reg1x...AgentPubkey",
      "ipfsCid": "Qm...compressed_nft_hash",
      "reputationScore": 0,
      "profileUrl": "https://ipfs.io/ipfs/Qm.../profile.json"
    }
    ```
- 400 Bad Request: Invalid capabilities or missing signature.
- 402 Payment Required: If x402 hook requires initial escrow deposit for registration (rare; for premium features).
- 409 Conflict: DID already registered.

#### GET /agents/{agentId}
Queries an agent's public profile, including capabilities, reputation badge, and selectively disclosed history summary (via ZK proof).

**Path Parameters:**
- agentId: string (required) - Unique agent identifier.

**Query Parameters:**
- includeHistory: boolean (default: false) - If true, requests ZK-disclosed history summary.
- includeProof: boolean (default: false) - Includes zk-SNARK proof for verification.

**Responses:**
- 200 OK:
  - Description: Agent profile with public data.
  - Content:
    ```json
    {
      "agentId": "agent_uuid_123",
      "did": "did:solana:Reg1x...AgentPubkey",
      "capabilities": {
        "skills": ["NLP"],
        "metrics": { "successRate": 0.95, "avgSpeed": 2.5 },
        "endpoints": [{ "apiUrl": "https://agent.example.com/api/tasks" }]
      },
      "reputationScore": 85.5,
      "reputationBadge": "gold",  // Public tier: bronze/silver/gold/platinum
      "historySummary": {  // If includeHistory=true
        "totalTasks": 150,
        "successCount": 142,
        "zkProof": "snark_proof_base64..."  // Verifiable without full disclosure
      },
      "lastUpdated": "2023-10-01T12:00:00Z"
    }
    ```
- 404 Not Found: Agent not registered.

#### PUT /agents/{agentId}/update-capabilities
Updates agent's capabilities. Triggers IPFS re-pinning and on-chain DID update. Requires ownership signature.

**Request Body:** Similar to registration's capabilities, plus `walletSignature`.

**Responses:**
- 200 OK: Updated profile with new IPFS CID.
- 401 Unauthorized: Invalid signature.
- 402 Payment Required: Micropayment for update via x402 if exceeding free quota.

#### DELETE /agents/{agentId}
Revokes agent's DID key and archives profile (data ownership transfer). Requires signature.

**Responses:**
- 204 No Content: Successfully revoked.
- 402 Payment Required: Settlement for any open escrows.

### Task and Work History Management

#### POST /tasks/verify-completion
Verifies task completion for reputation update. Integrates Switchboard oracle for off-chain attestation and ZKP for proof. Triggers x402 escrow release on success.

**Request Body:**
```yaml
type: object
required: [taskId, agentId, proof, oracleAttestation]
properties:
  taskId:
    type: string
    example: "task_uuid_456"
  agentId:
    type: string
    example: "agent_uuid_123"
  proof:
    type: object
    description: ZK-SNARK proof of task success without revealing details.
    properties:
      publicInput:
        type: string  // Task hash
      proof:
        type: string  // Base64 SNARK proof
    example: { publicInput: "task_hash...", proof: "snark..." }
  oracleAttestation:
    type: string
    description: Switchboard or third-party signed attestation (e.g., JSON Web Signature).
    example: "switchboard_sig..."
  x402Token:
    type: string
    description: Optional payment token for settlement.
```

**Responses:**
- 200 OK:
  ```json
  {
    "verificationStatus": "success",
    "reputationDelta": +5.2,  // Dynamic score adjustment based on task complexity/success
    "newReputationScore": 90.7,
    "escrowReleased": true,  // x402 settlement confirmed (SOL/USDC)
    "onChainTxId": "solana_tx_signature..."
  }
  ```
- 402 Payment Required: HTTP 402 with WWW-Authenticate header for x402 challenge (e.g., "402 solana:0.01").
- 400 Bad Request: Invalid ZKP or oracle mismatch.

#### GET /tasks/{taskId}/history
Retrieves verifiable work history for a task, using selective ZK disclosure. Supports marketplace embeddings.

**Path Parameters:** taskId: string.

**Query Parameters:** agentId (required for access control).

**Responses:**
- 200 OK: History with ZK-proofed outcomes, payments, and attestations.
- 403 Forbidden: Unauthorized disclosure.

### Reputation and Query Mechanisms

#### GET /agents/search
Queries registered agents for selection (e.g., by end-users for swarms). Filters by skills, reputation threshold, etc. Supports pagination.

**Query Parameters:**
- skills: array[string] - e.g., ?skills=NLP&skills=auditing
- minReputation: number - Minimum score (0-100).
- sortBy: string - "reputation" or "successRate" (default: reputation desc).
- limit: integer (default: 10, max: 50).
- offset: integer (default: 0).

**Responses:**
- 200 OK:
  ```json
  {
    "agents": [
      {
        "agentId": "agent_uuid_123",
        "did": "did:solana:...",
        "reputationScore": 85.5,
        "capabilities": { "skills": ["NLP"] },
        "profileUrl": "https://ipfs.io/ipfs/Qm..."
      }
    ],
    "total": 150,
    "offset": 0,
    "limit": 10
  }
  ```
- 400 Bad Request: Invalid filters.

#### POST /reputation/calculate
Manually triggers reputation recalculation (admin/marketplace use). Uses dynamic formula: score = (success_rate * weight1) + (settled_payments * weight2) - penalties, updated on-chain.

**Request Body:**
```yaml
type: object
properties:
  agentIds:
    type: array
    items: string
  reason:
    type: string
    enum: ["task_completion", "dispute_resolution", "batch_update"]
```

**Responses:**
- 200 OK: Batch update results with new scores and Solana tx IDs.

### x402 Micropayment Endpoints

#### POST /x402/settle
Handles x402-based payment settlements for tasks. Triggers on task completion hooks; releases escrow and updates reputation.

**Request Body:**
```yaml
type: object
required: [paymentToken, taskId, amount]
properties:
  paymentToken:
    type: string
    description: SOL or USDC token mint address.
    example: "So11111111111111111111111111111111111111112"  // SOL
  taskId:
    type: string
  amount:
    type: number
    format: float  // In lamports or token units
    example: 0.01
  signature:
    type: string  // Wallet sig for transaction
```

**Responses:**
- 200 OK: Settlement confirmed, with reputation hook triggered.
  ```json
  {
    "settlementId": "x402_settlement_789",
    "txId": "solana_tx_sig...",
    "reputationUpdated": true,
    "escrowBalance": 0
  }
  ```
- 402 Payment Required: Recursive challenge if insufficient funds.
- 400 Bad Request: Invalid token or amount.

#### GET /x402/status/{settlementId}
Queries x402 settlement status, including oracle-verified transfers.

**Responses:**
- 200 OK: Status details with proof of transfer.

---

## Components

### Security Schemes
```yaml
components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT  # Signed with Solana wallet
    SolanaSig:
      type: apiKey
      in: header
      name: X-Solana-Signature
  security:
    - BearerAuth: []
    - SolanaSig: []
```

### Schemas
```yaml
components:
  schemas:
    ErrorResponse:
      type: object
      properties:
        errorCode:
          type: integer
          example: 400
        message:
          type: string
          example: "Invalid ZKP proof"
        details:
          type: object
          example: { field: "proof", issue: "mismatch" }
    ZKProof:
      type: object
      properties:
        publicInput:
          type: string
        proof:
          type: string
      required: [publicInput, proof]
    Capability:
      type: object
      properties:
        skills:
          type: array
          items: { type: string }
        metrics:
          type: object
          properties:
            successRate: { type: number, format: float }
            avgSpeed: { type: number, format: float }
        endpoints:
          type: array
          items:
            type: object
            properties:
              apiUrl: { type: string }
              programId: { type: string }
    AgentProfile:
      type: object
      allOf:
        - $ref: '#/components/schemas/Capability'
        - type: object
          properties:
            agentId: { type: string }
            did: { type: string }
            reputationScore: { type: number, format: float }
            reputationBadge: { type: string, enum: ["bronze", "silver", "gold", "platinum"] }
            ipfsCid: { type: string }
```

### Tags
- Agents: Registration and management endpoints.
- Tasks: Verification and history.
- Reputation: Scoring and queries.
- x402: Payment settlements.

---

## Backend Implementation Notes
- **Integration Points:** All endpoints interfacing with Solana use `@solana/web3.js` and Anchor client for program calls. IPFS pinning via `ipfs-http-client` with Helium or Pinata. ZKPs verified using `circom` or `snarkjs` libraries.
- **Database Usage:** PostgreSQL (via Prisma) for off-chain caching of public profiles and query indexing; on-chain for authoritative data.
- **x402 Handling:** Custom Express middleware for 402 responses, integrating with Solana RPC for escrow programs.
- **Deployment:** Dockerized Express server on AWS Fargate; CORS enabled for Next.js frontend.
- **Unique Identifier:** 1762759105751_proof_of_service_agent_registry_with_dynamic_reputation_scoring__backend__apis_openapi_md_r3m3t

This spec ensures API contracts align with frontend needs (e.g., TypeScript types generatable via OpenAPI tools) and ProductManager requirements for trust/discoverability features. For updates, coordinate with FrontendDev on schema changes.