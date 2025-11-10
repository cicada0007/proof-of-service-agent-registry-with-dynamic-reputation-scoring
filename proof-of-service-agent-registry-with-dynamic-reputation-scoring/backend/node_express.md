# Express.js API Structure for Proof-of-Service Agent Registry

## Overview

This document outlines the Express.js-based backend API structure for the "Proof-of-Service Agent Registry with Dynamic Reputation Scoring" platform. The backend serves as the central server logic, handling HTTP requests from the Next.js frontend, integrating with Solana blockchain via Anchor/Rust programs, managing off-chain data via IPFS and compressed NFTs, and orchestrating x402 protocol micropayments (SOL/USDC). It uses PostgreSQL with Prisma ORM for relational data storage (e.g., caching on-chain reputation scores and agent metadata), while ensuring privacy through ZK-selective disclosure and TEEs for sensitive work histories.

The API is designed for high throughput in a decentralized AI agent ecosystem, supporting developers registering/querying agents, marketplaces embedding listings, and end-users selecting high-reputation agents for swarms. All endpoints are secured with Solana DID-based authentication (using revocable keys), JWT tokens for sessions, and rate limiting to prevent abuse. CORS is configured for the Next.js frontend hosted on Vercel.

Key principles:
- **RESTful Design**: Endpoints follow CRUD patterns with JSON responses.
- **Asynchronous Operations**: Heavy blockchain interactions (e.g., reputation updates) are offloaded to background jobs using Bull Queue.
- **Error Handling**: Standardized responses with HTTP status codes, error types (e.g., `VALIDATION_ERROR`, `BLOCKCHAIN_ERROR`), and Solana-specific details.
- **Validation**: Joi or Zod for request body/schema validation.
- **Logging**: Winston for structured logs, integrated with AWS CloudWatch for Fargate/Lambda deployments.
- **Testing**: Jest for unit/integration tests, Supertest for API mocking.

The server runs on Node.js v20+, with Express v4.18+ as the core framework. Deployment uses Docker containers on AWS Fargate for scalability.

## Project Structure

The backend codebase is organized under `/backend` (root: `proof-of-service-agent-registry-with-dynamic-reputation-scoring/backend`). Key directories:

```
backend/
├── src/
│   ├── config/          # Environment configs (e.g., Solana RPC endpoints, IPFS gateway, x402 webhook URLs)
│   │   ├── database.ts  # Prisma client setup
│   │   ├── solana.ts    # Anchor program initialization, wallet connections
│   │   └── x402.ts      # Micropayment hooks and escrow logic
│   ├── controllers/     # Request handlers (e.g., agentRegistrationController.ts)
│   ├── middleware/      # Auth, validation, rate limiting (e.g., solanaAuth.ts, zkpVerifier.ts)
│   ├── models/          # Prisma schema extensions (e.g., AgentProfile, ReputationScore)
│   ├── routes/          # Express routers (e.g., agents.ts, reputation.ts)
│   ├── services/        # Business logic (e.g., ipfsPinner.ts, zkProofValidator.ts, switchboardOracle.ts)
│   ├── utils/           # Helpers (e.g., didResolver.ts, errorHandler.ts)
│   └── app.ts           # Main Express app setup
├── prisma/
│   └── schema.prisma    # Database schema for off-chain caching
├── tests/               # Unit/integration tests
├── docker/
│   └── Dockerfile      # Node.js + Prisma migration setup
└── package.json         # Dependencies and scripts
```

## Dependencies

Install via `npm install` or `yarn`. Core packages:

- **Express**: `express@^4.18.2` - Routing and middleware.
- **Prisma**: `@prisma/client@^5.0.0`, `prisma@^5.0.0` - ORM for PostgreSQL.
- **Solana Integration**: `@solana/web3.js@^1.87.0`, `@coral-xyz/anchor@^0.29.0` - Blockchain interactions.
- **IPFS**: `ipfs-http-client@^60.0.1` - Off-chain pinning via Pinata or public gateways.
- **x402 Protocol**: Custom module (see `/src/config/x402.ts`) using `axios` for HTTP 402 responses and SOL/USDC transfers via Jupiter Aggregator.
- **ZKPs**: `@zk-kit/protocols@^2.0.0` for zk-SNARK verification; integrate with Solana's Light Protocol for on-chain proofs.
- **Auth/Security**: `jsonwebtoken@^9.0.0`, `@solana/wallet-adapter-base@^0.9.23` for DID-based auth; `helmet@^7.1.0` for security headers.
- **Queue/Background Jobs**: `bull@^4.12.0` with Redis for async tasks (e.g., reputation scoring post-task completion).
- **Validation/Testing**: `joi@^17.10.0`, `jest@^29.7.0`, `supertest@^6.3.4`.
- **Other**: `winston@^3.11.0` (logging), `cors@^2.8.5`, `dotenv@^16.3.1`, `compression@^1.7.4`.

Dev dependencies: `typescript@^5.3.0`, `@types/express@^4.17.21`, `nodemon@^3.0.2`.

## Server Setup (app.ts)

The main entry point initializes Express, Prisma, Solana connections, and global middleware.

```typescript
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { PrismaClient } from '@prisma/client';
import AnchorProvider from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import dotenv from 'dotenv';
import winston from 'winston';
import errorHandler from './utils/errorHandler';
import solanaAuth from './middleware/solanaAuth';
import rateLimit from './middleware/rateLimit';
import agentRoutes from './routes/agents';
import reputationRoutes from './routes/reputation';
import x402Routes from './routes/x402';
import didResolver from './utils/didResolver';

// Load env vars
dotenv.config();

// Logger setup
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console(), new winston.transports.File({ filename: 'error.log', level: 'error' })],
});

// Prisma client
const prisma = new PrismaClient();

// Solana setup: Connect to devnet/mainnet, initialize Anchor
const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com');
const wallet = AnchorProvider.env().wallet; // Use local wallet or derive from DID
const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });

// Global error handler type
interface ApiError extends Error {
  statusCode?: number;
  type?: string;
}

// App initialization
const app: Application = express();
const PORT = process.env.PORT || 3001;

// Middleware stack
app.use(helmet()); // Security headers
app.use(compression()); // Gzip responses
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true })); // Next.js origin
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded
app.use(rateLimit); // 100 requests/min per IP, higher for authenticated DIDs
app.use('/api', solanaAuth); // Apply DID auth to all API routes

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString(), solanaConnection: connection.rpcEndpoint });
});

// Routes
app.use('/api/agents', agentRoutes(provider, prisma));
app.use('/api/reputation', reputationRoutes(provider, prisma));
app.use('/api/x402', x402Routes(provider, prisma)); // Micropayment endpoints
app.use('/api/query', queryRoutes(provider, prisma)); // Agent discovery and selection

// Global error handler
app.use((err: ApiError, req: Request, res: Response, next: NextFunction) => {
  logger.error(err.stack);
  const status = err.statusCode || 500;
  res.status(status).json({
    error: { type: err.type || 'INTERNAL_ERROR', message: err.message },
    requestId: req.headers['x-request-id'] || 'unknown'
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing connections');
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(PORT, () => {
  logger.info(`Proof-of-Service Agent Registry API running on port ${PORT}`);
  logger.info(`Solana network: ${process.env.SOLANA_CLUSTER || 'devnet'}`);
});

export default app;
```

## Middleware Details

### Authentication (solanaAuth.ts)
Verifies Solana DID signatures for agent ownership. Uses `did-resolver` to fetch profiles from Solana programs.

- **Flow**: Extract signature from headers, resolve DID, validate against request payload.
- **Example**: For agent registration, require a signed message: `{ nonce: Date.now(), action: 'register', capabilities: [...] }`.
- **Privacy**: Supports ZK-selective disclosure; if ZKP provided, verify without revealing full history.

```typescript
// Snippet: solanaAuth.ts
import { verifySignature } from '@solana/web3.js'; // Custom util for message verification
import { resolveDid } from './utils/didResolver';

export default async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { signature, did, message } = req.headers;
    if (!signature || !did || !message) return res.status(401).json({ error: { type: 'AUTH_MISSING', message: 'DID and signature required' } });
    
    const publicKey = await resolveDid(did as string); // Fetch from Solana DID registry
    const isValid = await verifySignature(publicKey, message as string, signature as string);
    if (!isValid) return res.status(401).json({ error: { type: 'AUTH_INVALID', message: 'Invalid signature' } });
    
    req.user = { did: did as string, publicKey }; // Attach to request
    next();
  } catch (err) {
    res.status(500).json({ error: { type: 'AUTH_ERROR', message: err.message } });
  }
};
```

### ZKP Verifier (zkpVerifier.ts)
Middleware for validating zk-SNARK proofs on work history submissions. Integrates with `@zk-kit` for circuit verification.

- **Usage**: Applied to reputation update endpoints.
- **Flow**: Parse proof from body, verify against public inputs (e.g., task ID, success flag), attest via Switchboard oracle if off-chain.

### Rate Limiting (rateLimit.ts)
Uses `express-rate-limit` with Redis store. Exemptions for high-rep agents (checked via DID).

## Route Definitions

Routes are modular, injected with `provider` (Anchor) and `prisma` for DB access. All responses include `x-request-id` header for tracing.

### 1. Agent Registration and Management (/api/agents)
Handles DID-linked profile creation, capability registration (skills, metrics, endpoints).

- **POST /api/agents/register**
  - **Description**: Register a new AI agent with capabilities. Triggers Solana program call to mint compressed NFT for IPFS-pinned metadata. Stores cache in PostgreSQL.
  - **Auth**: Required (Solana DID signature).
  - **Body**: `{ did: string, capabilities: { skills: string[], metrics: { successRate: number, avgSpeed: number }, endpoints: string[] }, zkp?: { proof: object, publicInputs: object } }`
  - **Response (201)**: `{ agentId: string, did: string, profileCid: string (IPFS), onChainTx: string }`
  - **Controller Logic**: 
    - Validate with Joi.
    - Pin capabilities to IPFS, get CID.
    - Call Anchor IDL: `agentRegistryProgram.methods.registerAgent(...).rpc()`.
    - Cache in Prisma: `prisma.agentProfile.create({ data: { ... } })`.
    - Background job: Queue reputation init (score: 0).

- **GET /api/agents/:did**
  - **Description**: Fetch agent profile with selective disclosure (ZK for private history).
  - **Query Params**: `?includeHistory=true&zkSelective=successRateOnly`
  - **Response (200)**: `{ did, capabilities, endpoints, reputationBadge: { score: number, tasksCompleted: number } }`
  - **Logic**: Resolve DID, fetch from Solana/IPFS, apply ZK filter if requested.

- **PUT /api/agents/:did/update-capabilities**
  - **Description**: Update skills/metrics/endpoints. Revokes old NFT if needed.
  - **Body**: Similar to register.
  - **Response (200)**: `{ updated: true, newCid: string }`

- **DELETE /api/agents/:did** (with revocation key)
  - **Description**: Revoke agent profile (Solana DID revocation).

### 2. Reputation Scoring (/api/reputation)
Dynamic updates tied to task completion and x402 settlements.

- **POST /api/reputation/update/:agentDid**
  - **Description**: Trigger score update post-task. Verifies ZKP or oracle attestation, calls Solana program for on-chain score.
  - **Auth**: Required.
  - **Body**: `{ taskId: string, success: boolean, zkpProof?: object, oracleAttestation?: string, x402TxId: string }`
  - **Response (200)**: `{ newScore: number, delta: number, onChainTx: string }`
  - **Logic**:
    - Verify ZKP (zk-SNARK circuit for "prove success without revealing details").
    - If off-chain: Query Switchboard oracle for validation.
    - x402 Hook: Confirm payment settlement via tx lookup.
    - Anchor Call: `reputationProgram.methods.updateScore(scoreDelta).accounts({ agent: publicKey }).rpc()`.
    - Prisma Update: Cache score for quick queries.
    - Emit event for marketplaces (WebSocket optional via Socket.io).

- **GET /api/reputation/:agentDid**
  - **Description**: Query current score and history summary (public badges only).
  - **Response (200)**: `{ score: 850, history: { totalTasks: 100, successRate: 0.95 }, badges: ['verified-auditor', 'high-speed-nlp'] }`

- **GET /api/reputation/leaderboard**
  - **Description**: Paginated list for end-user selection (top agents by score, filtered by skills).
  - **Query**: `?skills=nlp&limit=50&offset=0`
  - **Response (200)**: Array of agent summaries.

### 3. x402 Micropayments (/api/x402)
HTTP 402-based settlements for task-triggered payments.

- **POST /api/x402/charge**
  - **Description**: Initiate escrow for task (e.g., agent swarm execution). Returns 402 with payment URL.
  - **Body**: `{ agentDid: string, amount: number (in USDC), taskDescription: string }`
  - **Response (402)**: `{ paymentRequired: { uri: 'solana:pay?tx=...', amount: number } }` (Integrates Jupiter for SOL/USDC swap).
  - **Logic**: Create escrow via Anchor (Solana program), hook to task completion for release.

- **POST /api/x402/settle**
  - **Description**: Webhook endpoint for settlement confirmation. Triggers reputation update.
  - **Auth**: x402 signature (HMAC).
  - **Body**: `{ txId: string, agentDid: string, success: boolean }`
  - **Response (200)**: `{ settled: true }`
  - **Logic**: Verify tx on Solana explorer, queue reputation update, release escrow.

- **GET /api/x402/history/:agentDid**
  - **Description**: Fetch payment history (anonymized via ZK).

### 4. Query and Discovery (/api/query)
For developers/marketplaces/end-users.

- **GET /api/query/agents**
  - **Description**: Search agents by capabilities, reputation threshold.
  - **Query**: `?skills=auditing&minScore=700&sort=score&limit=20`
  - **Response (200)**: Paginated array `{ agents: [{ did, score, capabilities, ... }] }`
  - **Logic**: Prisma query for cache, fallback to Solana index if needed. Supports embeddings for marketplace integration.

- **POST /api/query/validate-swarm**
  - **Description**: Validate agent swarm selection (e.g., collective reputation).
  - **Body**: `{ agentDids: string[] }`
  - **Response (200)**: `{ valid: true, aggregateScore: 820, risks: [] }`

## Integration Points

- **Solana/Anchor**: All on-chain ops (registration, scoring, escrow) via IDL-generated methods. Use compressed NFTs for IPFS links to reduce costs.
- **IPFS**: Service layer pins JSON profiles (capabilities, histories) via `ipfs.add()`. Gateways: Pinata for production.
- **Database Schema (Prisma Excerpt)**:
  ```prisma
  model AgentProfile {
    id           String   @id @default(cuid())
    did          String   @unique
    capabilities Json?    // { skills: [], metrics: {} }
    ipfsCid      String?
    reputationId String?  @unique
    createdAt    DateTime @default(now())
    reputation   ReputationScore? @relation(fields: [reputationId], references: [id])
  }

  model ReputationScore {
    id              String   @id @default(cuid())
    agentDid        String   @unique
    score           Float    @default(0)
    tasksCompleted  Int      @default(0)
    successRate     Float?   
    lastUpdated     DateTime @updatedAt
    onChainAccount  String?  // PDA address
  }

  model X402Transaction {
    id        String   @id @default(cuid())
    txId      String   @unique
    agentDid  String
    amount    Float
    success   Boolean
    settledAt DateTime @default(now())
  }
  ```
  Run `npx prisma migrate dev` for schema updates.

- **Oracles/TEEs**: Switchboard for off-chain task validation (e.g., API endpoint pings). TEEs (via AWS Nitro) for private history computation before ZKP generation.
- **Background Jobs**: Bull queues for async tasks, e.g., `queue.add('updateReputation', { agentDid, taskId })` after x402 settlement.

## Deployment and Scaling

- **Dockerfile**: Multi-stage build with Prisma generate/migrate.
  ```dockerfile
  FROM node:20-alpine AS builder
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci --only=production
  COPY . .
  RUN npx prisma generate

  FROM node:20-alpine AS runtime
  WORKDIR /app
  COPY --from=builder /app/dist ./dist  # Assuming TS build
  COPY --from=builder /app/node_modules ./node_modules
  COPY --from=builder /app/prisma ./prisma
  RUN npx prisma migrate deploy
  CMD ["node", "dist/app.js"]
  ```
- **AWS Fargate**: ECS service with ALB for load balancing. Auto-scale on CPU >70%. Secrets: SSM for Solana keys, x402 webhooks.
- **Monitoring**: Integrate Prometheus for metrics (e.g., endpoint latency, tx success rate).

## Testing Examples

- **Unit Test (Jest)**: `describe('Agent Registration', () => { test('registers with valid DID', async () => { ... }); });`
- **Integration**: Mock Solana with `@solana/web3.js` test validator; use Supertest: `request(app).post('/api/agents/register').expect(201);`
- **E2E**: Simulate x402 flow with test USDC minting on devnet.

This structure ensures a robust, secure API tailored to the decentralized agent registry, with clear contracts for FrontendDev (e.g., via Swagger docs at `/api-docs`). For updates, coordinate with ProductManager on feature prioritization.

*Generated for unique identifier: 1762759105672_proof_of_service_agent_registry_with_dynamic_reputation_scoring__backend_node_express_md_lbnhaz*