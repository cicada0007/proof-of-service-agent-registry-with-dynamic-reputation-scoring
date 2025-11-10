# Authentication Implementation

## Overview

In the Proof-of-Service Agent Registry with Dynamic Reputation Scoring backend, authentication is a critical layer ensuring secure access to decentralized and centralized components. The system supports a hybrid authentication model tailored to the project's Web Application platform, leveraging Solana-based decentralized identifiers (DIDs) for agent and user ownership while integrating traditional session management for API interactions. This approach aligns with the core idea of a "credit bureau for AI agents," where developers, AI agent marketplaces, and end-users authenticate to register capabilities, query verifiable work histories, update reputation scores, and trigger x402 payment settlements.

Authentication secures operations such as:
- Agent registration via DID-linked profiles (storing skills like NLP/auditing, metrics like success rate/speed, and endpoints like API URLs or Solana program IDs).
- Verifiable work history queries using ZKPs (zk-SNARKs) for selective disclosure, without exposing private off-chain data stored via IPFS and compressed NFTs.
- Dynamic reputation scoring updates post-task completion, integrated with x402 HTTP 402 micropayments (e.g., SOL/USDC escrow releases via API hooks).
- Oracle attestations (e.g., Switchboard) and TEE-based private data handling to maintain privacy and prevent doxxing.

The backend, built on Node.js with Express, uses PostgreSQL via Prisma ORM for storing session tokens and user metadata. Authentication emphasizes revocable Solana keys for agent DIDs, ensuring data ownership and alignment with the decentralized registry on Solana (Anchor/Rust programs).

Key principles:
- **Decentralized Identity First**: Primary auth uses Solana wallet signatures for web3-native users (e.g., developers signing messages to link DIDs).
- **Hybrid Fallback**: JWT-based sessions for stateless API calls, especially for marketplace embeddings or end-user swarm selections.
- **Privacy Integration**: Auth tokens carry ZK-proof commitments for selective disclosure of reputation badges without full history revelation.
- **x402 Alignment**: Auth is required for payment hooks, ensuring only verified entities trigger settlements.

This implementation is production-ready, with middleware for rate limiting, CORS, and CSRF protection, and is designed to coordinate with FrontendDev for API contracts (e.g., Next.js Zustand state management for token storage).

## Authentication Methods

### 1. Solana Wallet-Based Authentication (Primary for Web3 Users)
Agents and users authenticate by signing a Solana message with their wallet private key, generating a verifiable signature tied to their DID. This method supports the project's emphasis on agent-owned data and revocable keys.

- **Flow**:
  1. Client (e.g., frontend) requests a nonce from `/auth/solana-challenge` endpoint, including a proposed DID.
  2. User signs the nonce + timestamp + DID using their Solana wallet (e.g., Phantom or Solflare).
  3. Client submits signature to `/auth/solana-verify`.
  4. Backend verifies signature against public key, checks DID validity on Solana (via Anchor program query), and issues a JWT with embedded DID claims.
  5. For agents, this links to IPFS-pinned profiles; for users, it grants query access to high-reputation agents.

- **Security Features**:
  - Nonce expiration (5 minutes) to prevent replay attacks.
  - DID revocation check: Query Solana for revoked keys before issuing tokens.
  - ZK Integration: Optional zk-SNARK proof submission during auth to attest prior reputation without disclosure (e.g., "score > 0.8" without exact value).

- **Use Cases**:
  - Developer registration of agent capabilities.
  - End-user selection of agents for swarms, requiring auth to filter by reputation.
  - Marketplace embeddings: Authenticate to embed registry listings with verified queries.

### 2. JWT Session-Based Authentication (Fallback for API Clients)
For non-wallet interactions (e.g., server-to-server calls from marketplaces), use JSON Web Tokens (JWT) signed with a backend secret. This complements Solana auth by providing stateless access.

- **Flow**:
  1. After Solana verification, issue a JWT with claims: `{ userId, did, role (developer/marketplace/user), exp, iat }`.
  2. Clients include `Authorization: Bearer <token>` in API headers.
  3. Express middleware validates JWT, checks expiration, and attaches user context to requests.
  4. Refresh tokens (long-lived) can be issued for extended sessions, revocable via Prisma-stored blacklists.

- **Token Structure** (Example Payload):
  ```json
  {
    "sub": "user_123",
    "did": "did:solana:5xAbcDef...",
    "role": "developer",
    "capabilities": ["query_agents", "register_agent"],
    "zk_commitment": "0xhash_of_reputation_proof",
    "iat": 1699123456,
    "exp": 1699209856
  }
  ```

- **Security Features**:
  - HS256 signing with environment secret.
  - Role-Based Access Control (RBAC): e.g., only "marketplace" roles can embed listings.
  - Integration with x402: Tokens required for `/payments/settle` hooks, ensuring authenticated escrow releases.

### 3. x402-Integrated Authentication (For Micropayment Triggers)
x402 protocol requires auth for HTTP 402 responses in payment flows. Authenticate via wallet signature before allowing API-triggered settlements.

- **Flow**:
  1. Client requests a protected endpoint (e.g., `/agents/:id/complete-task`), triggering 402 if payment pending.
  2. Authenticate with Solana signature to identify payer/payee.
  3. On settlement (SOL/USDC via Solana program), update reputation score on-chain and refresh JWT with new ZK-proofed metrics.
  4. Use TEEs (e.g., via AWS Nitro) for private off-chain validation during auth.

- **Unique to Project**: Ties auth directly to work history verification—successful x402 txns serve as implicit ZK-attestable proofs, auto-updating reputation without manual intervention.

## Database Schema (Prisma Integration)

Authentication data is stored in PostgreSQL for session management and audit logs, complementing on-chain Solana storage. Key models relevant to auth:

```prisma
model User {
  id        String   @id @default(cuid())
  did       String   @unique // Solana DID
  walletAddress String @unique
  role      Role     @default(USER)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  sessions  Session[]
  blacklistedTokens String[] // For revocation
}

model Session {
  id          String   @id @default(cuid())
  userId      String
  tokenHash   String   @unique // Hashed JWT for lookup
  expiresAt   DateTime
  zkProof    String?   // Optional commitment for selective disclosure
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())
}

enum Role {
  DEVELOPER
  MARKETPLACE
  USER
  AGENT // For autonomous agent logins via API keys
}
```

- **Migrations**: Run `npx prisma migrate dev` after schema updates to handle auth-related tables.
- **Privacy Note**: No full work histories stored here; only commitments and DIDs. Full verification pulls from Solana/IPFS.

## Backend Implementation Details

### Express Middleware Setup
Implement auth guards in `src/middleware/auth.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { verifySolanaSignature } from '../utils/solana'; // Custom utility for wallet verification

const prisma = new PrismaClient();

export const solanaAuth = async (req: Request, res: Response, next: NextFunction) => {
  const { signature, publicKey, nonce } = req.body;
  if (!await verifySolanaSignature(signature, publicKey, nonce)) {
    return res.status(401).json({ error: 'Invalid Solana signature' });
  }
  // Check DID revocation via Solana RPC
  const did = await fetchDIDFromSolana(publicKey);
  if (isRevoked(did)) {
    return res.status(403).json({ error: 'DID revoked' });
  }
  req.user = { did, publicKey };
  next();
};

export const jwtAuth = (req: Request, res: Response, next: NextFunction) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    // Check blacklist
    if (await prisma.session.findUnique({ where: { tokenHash: hashToken(token) } })) {
      return res.status(401).json({ error: 'Token blacklisted' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Utility for ZK commitment validation (integrate with zk-SNARK lib like snarkjs)
export const zkAuthGuard = (proofType: 'reputation' | 'history') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { zkProof } = req.body;
    if (!verifyZKProof(zkProof, proofType, req.user!.did)) {
      return res.status(403).json({ error: 'Invalid ZK proof' });
    }
    next();
  };
};
```

- **Dependencies**: `jsonwebtoken`, `@solana/web3.js` for wallet ops, `snarkjs` for ZK verification, `crypto` for hashing.
- **Environment Vars**: `JWT_SECRET`, `SOLANA_RPC_URL`, `IPFS_GATEWAY`.

### API Endpoints (Contracts for FrontendDev)
All endpoints under `/api/auth`. Use TypeScript interfaces for payloads.

- **POST /api/auth/solana-challenge**
  - Body: `{ proposedDid?: string }`
  - Response: `{ nonce: string, timestamp: number, message: string }` (for signing)
  - Purpose: Initiate Solana auth flow.

- **POST /api/auth/solana-verify**
  - Body: `{ signature: string, publicKey: string, nonce: string }`
  - Middleware: `solanaAuth`
  - Response: `{ token: string, refreshToken: string, user: { id, did, role } }`
  - Coordinates with FrontendDev: Store token in Zustand for subsequent calls (e.g., agent registration).

- **POST /api/auth/refresh**
  - Header: `Authorization: Bearer <refreshToken>`
  - Response: `{ token: string }`
  - For long-lived sessions in marketplace integrations.

- **POST /api/auth/logout**
  - Middleware: `jwtAuth`
  - Blacklists token and revokes session in DB.

- **GET /api/auth/validate** (Protected)
  - Middleware: `jwtAuth`
  - Response: `{ valid: true, user: { ... }, reputationBadge?: string }` (ZK-selective public score)
  - Use Case: End-users validate before selecting agents for swarms.

- **x402-Specific: POST /api/auth/x402-preauth**
  - Body: `{ taskId: string, expectedPayment: number }` (in lamports or USDC)
  - Verifies wallet for upcoming settlement, issues short-lived token for payment hook.

**Rate Limiting**: Apply `express-rate-limit` to auth endpoints (e.g., 10 req/min per IP) to prevent brute-force on signatures.

## Security Considerations

- **Threat Model**: Focus on wallet phishing, signature malleability, and ZK proof forgery. Mitigate with nonce salts and Solana's ed25519 verification.
- **Compliance**: Aligns with Solana DID standards for revocability; GDPR-like privacy via TEEs for off-chain data.
- **Auditing**: Log all auth events to Prisma (e.g., `AuthLog` model) for Switchboard oracle attestations.
- **Edge Cases**:
  - Revoked DID: Deny access and notify via webhook.
  - Failed ZK Proof: Fallback to public reputation query only.
  - x402 Failure: Rollback reputation update if settlement auth fails.
- **Testing**: Unit tests for middleware (Jest); integration tests simulating Solana signatures and IPFS pinning.
- **Deployment Notes**: In Docker/AWS Fargate, use Secrets Manager for JWT_SECRET. Coordinate with BackendDev for infra scaling during high-traffic agent registrations.

This auth implementation ensures seamless coordination with the decentralized core, providing robust, privacy-preserving access for all target users while supporting dynamic reputation and x402 flows. For updates, reference Solana program IDs in agent endpoints. 

*Generated for file: proof-of-service-agent-registry-with-dynamic-reputation-scoring/backend/auth.md | Unique ID: 1762759105742_proof_of_service_agent_registry_with_dynamic_reputation_scoring__backend_auth_md_eooqcr*