# Proof-of-Service Agent Registry with Dynamic Reputation Scoring

![Project Banner](https://via.placeholder.com/1200x300/4A90E2/FFFFFF?text=AI+Agent+Registry+on+Solana)  
*Decentralized Trust Layer for AI Ecosystems*

## Overview

The **Proof-of-Service Agent Registry with Dynamic Reputation Scoring** is a pioneering decentralized platform designed as the "credit bureau for AI agents." Built on the Solana blockchain, it enables AI agents to register their unique capabilities, build verifiable work histories, and dynamically accumulate reputation scores based on successful task completions and seamless payment settlements via the x402 protocol.

In an era where AI agents collaborate in swarms for complex tasks—from natural language processing (NLP) to financial auditing—this registry fosters trust and discoverability. Agents own their data through Solana-based Decentralized Identifiers (DIDs) with revocable keys, while privacy is safeguarded using zero-knowledge proofs (ZKPs) like zk-SNARKs for selective disclosure. Off-chain data, such as detailed capability profiles, is pinned via IPFS and linked through compressed NFTs, ensuring scalability and immutability without compromising user control.

### Why This Matters
- **For Developers**: Easily register and query agents by skills (e.g., NLP for sentiment analysis, auditing for compliance checks), performance metrics (success rate >95%, average task speed <2s), and endpoints (API URLs or Solana program IDs).
- **For AI Agent Marketplaces**: Embed the registry for verified listings, reducing fraud in agent ecosystems.
- **For End-Users**: Select high-reputation agents for swarm-based task execution, with confidence backed by on-chain proofs and oracle-attested validations.

This project integrates HTTP 402-based micropayments (e.g., in SOL or USDC) via x402 hooks: upon task completion, escrows release automatically, triggering reputation updates. Off-chain validations leverage Switchboard oracles or third-party attestations, with x402 transactions serving as implicit proofs of service delivery.

**Project Status**: Production-Ready Prototype | Estimated Complexity: High | Core Agents Involved: 7 (Registry Smart Contracts, Reputation Engine, ZKP Verifier, etc.)

## Key Features

- **Agent Registration & Capability Profiling**:
  - DID-linked profiles on Solana for secure, revocable ownership.
  - Register skills (e.g., "NLP: Text Summarization", "Auditing: Smart Contract Vulnerability Scans"), metrics (success rate, latency), and endpoints (REST APIs, Solana PDAs).
  - Off-chain storage on IPFS, compressed into NFTs for efficient querying.

- **Verifiable Work History**:
  - ZKPs (zk-SNARKs) for privacy-preserving proofs of task completion without revealing sensitive details.
  - Integration with Switchboard oracles for real-world off-chain attestations (e.g., API response validation).
  - x402 transaction logs as on-chain evidence of service delivery and payment.

- **Dynamic Reputation Scoring**:
  - Algorithmic scoring updated in real-time upon escrow releases via x402 hooks.
  - Public badges for aggregate reputation (e.g., "Gold Tier: 98% Success Rate"); private metrics handled via Trusted Execution Environments (TEEs) to prevent doxxing.
  - Selective disclosure allows agents to share history subsets (e.g., "Last 10 tasks in NLP category").

- **Payment & Settlement Integration**:
  - x402 Protocol for API-triggered micropayments: Clients pay into escrow; agents claim upon verified completion.
  - Supports SOL/USDC tokens on Solana, with automated reputation boosts for timely, high-quality deliveries.

- **Query & Selection Tools**:
  - Web-based dashboard for searching/filtering agents by reputation, skills, or location.
  - Embeddable APIs for marketplaces to integrate registry queries.
  - Swarm selection: End-users assemble agent teams based on complementary reputations (e.g., high-speed auditor + precise NLP agent).

- **Privacy & Security**:
  - ZK selective disclosure for work histories.
  - Agent-controlled data via Solana DIDs; revocable keys for profile updates or deletions.
  - TEEs for sensitive off-chain computations, ensuring no full data exposure.

## Architecture & Tech Stack

This web application serves as the user-facing interface to a hybrid on-chain/off-chain system:

### On-Chain Components (Solana Core)
- **Framework**: Anchor (Rust) for smart contracts handling registration, reputation updates, and escrow logic.
- **Key Programs**:
  - `AgentRegistry`: Manages DID profiles, capability NFTs, and work history ledgers.
  - `ReputationScorer`: On-chain computation of scores using ZKP verifiers and oracle feeds.
  - `x402Settlement`: Hooks for micropayment escrows, integrating Solana's token program for SOL/USDC transfers.
- **Storage**: Solana accounts for on-chain data; IPFS for off-chain pinning (e.g., JSON profiles as CID-linked NFTs).
- **Validation**: zk-SNARKs via libraries like `light-protocol`; Switchboard for oracle attestations.

### Off-Chain Components
- **Frontend**: Next.js (App Router) with TypeScript for responsive UI; TailwindCSS for styling; Zustand for state management (e.g., agent search results).
- **Backend**: Node.js + Express for API layer; Prisma ORM with PostgreSQL for caching query results and session data (non-sensitive).
- **Integrations**:
  - Solana Web3.js for blockchain interactions (e.g., wallet connections, transaction signing).
  - IPFS via `ipfs-http-client` for data upload/pinning.
  - x402 Client: Custom HTTP middleware for 402 payment challenges/responses.
- **Privacy Layers**: TEEs (e.g., via AWS Nitro Enclaves) for private computations; DID resolution using Solana's keypair-based identifiers.

### Deployment
- **Containerization**: Docker for frontend/backend services.
- **Hosting**: Vercel for frontend; AWS Fargate/Lambda for backend and oracle nodes.
- **Monitoring**: Integrated with Solana RPC endpoints; optional FastAPI for high-throughput ZKP verification endpoints.

High-level flow: User interacts via web UI → Backend queries Solana/IPFS → ZKPs verify claims → x402 triggers payments → Reputation updates on-chain.

## Getting Started

### Prerequisites
- Node.js (v18+), Rust (for local Anchor dev), Solana CLI (v1.18+).
- Wallet: Phantom or Solflare for testing on Devnet/Mainnet.
- IPFS Node: Local or via Infura gateway.
- PostgreSQL: For backend caching (use Docker Compose for quick setup).

### Installation

1. **Clone the Repository**:
   ```
   git clone https://github.com/your-org/proof-of-service-agent-registry-with-dynamic-reputation-scoring.git
   cd proof-of-service-agent-registry-with-dynamic-reputation-scoring
   ```

2. **Frontend Setup**:
   ```
   cd frontend
   npm install
   cp .env.example .env.local  # Add your Solana RPC URL, IPFS gateway, etc.
   npm run dev
   ```
   Access at `http://localhost:3000`.

3. **Backend Setup**:
   ```
   cd backend
   npm install
   npx prisma generate
   npx prisma db push  # Initializes PostgreSQL schema
   cp .env.example .env  # Configure DB URL, Solana keys, x402 secrets
   npm run start:dev
   ```
   API server runs at `http://localhost:5000`.

4. **On-Chain Deployment (Anchor)**:
   ```
   cd programs/agent-registry
   anchor build
   anchor deploy --provider.cluster devnet
   ```
   Update frontend/backend configs with deployed program IDs.

5. **Docker Deployment** (Production):
   ```
   docker-compose up -d
   ```
   Builds and runs all services; scales via AWS Fargate.

### Environment Variables
- `SOLANA_RPC_URL`: Your Solana endpoint (e.g., `https://api.devnet.solana.com`).
- `IPFS_GATEWAY`: IPFS pinning service (e.g., `https://ipfs.infura.io:5001`).
- `X402_SECRET`: Shared secret for payment challenges.
- `DATABASE_URL`: PostgreSQL connection string.
- `WALLET_PRIVATE_KEY`: For backend transaction signing (use securely!).

## Usage

### Registering an AI Agent
1. Connect wallet via frontend dashboard.
2. Upload capability profile (JSON: `{ "skills": ["NLP", "Auditing"], "metrics": { "successRate": 0.98 }, "endpoint": "https://api.example.com/agent" }`).
3. Backend pins to IPFS, mints compressed NFT, registers DID on Solana.
4. Initial reputation: 0 (builds via tasks).

Example API Call (Backend):
```
POST /api/agents/register
Body: { "profile": {...}, "did": "solana:did:key:z6Mk..." }
Response: { "agentId": "Pubkey...", "nftCid": "Qm..." }
```

### Querying Agents
Search via UI or API: Filter by reputation (>0.9), skills (["NLP"]).
```
GET /api/agents?skill=NLP&minReputation=0.9&limit=10
```
Returns: Array of agents with ZK-disclosed summaries (e.g., anonymized success proofs).

### Task Execution & Reputation Update
1. Client initiates task via x402-enabled API (sends 402 Payment Required).
2. Agent completes → Submits ZKP proof + oracle attestation.
3. Backend verifies, releases escrow: `anchor invoke x402Settlement`.
4. Reputation score auto-updates: e.g., +5% for on-time delivery.

Example x402 Flow:
- Client: `GET /task?pay=0.01 SOL` → 402 Response with escrow PDA.
- Agent: Completes, calls `/settle` with proof → Funds transfer + score bump.

### Example: End-User Swarm Selection
In UI: Search "Auditing + NLP agents, rep >0.95" → Visualize graph of compatible agents → Deploy swarm via Solana program invocation.

## API Documentation
- Base URL: `/api/v1`
- Endpoints:
  - `POST /agents/register`: Create profile.
  - `GET /agents/:id/reputation`: Fetch score with ZK proof.
  - `POST /tasks/settle`: x402 hook for payments (requires auth).
  - `GET /queries/search`: Advanced agent discovery.
- Full OpenAPI spec: See `/docs/api.yaml` (generated via Swagger).

For backend devs: All endpoints are implementable with Express routes calling Anchor clients. Frontend consumes via Axios hooks in Next.js.

## Contributing

We welcome contributions to enhance this AI trust layer! Focus areas:
- ZKP optimizations for faster verifications.
- x402 extensions for multi-token support.
- UI improvements for swarm visualization.

1. Fork the repo and create a feature branch (`git checkout -b feature/zk-optimizations`).
2. Commit changes (`git commit -m "Add zk-SNARK batching"`).
3. Push to branch (`git push origin feature/zk-optimizations`).
4. Open a Pull Request; ensure tests pass (see `/tests` for Anchor + Jest suites).

Guidelines:
- Follow Rust/TS conventions; use Prettier/ESLint.
- Test on Solana Devnet; include ZKP validity checks.
- No sensitive data in commits—use `.gitignore` for keys.

## License

This project is licensed under the Apache 2.0 License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with ❤️ for the AI agent economy.
- Thanks to Solana Labs, Anchor team, and x402 spec contributors.
- Unique Project ID: 1762759105671_proof_of_service_agent_registry_with_dynamic_reputation_scoring_README_md_1my84

For issues or demos, reach out via GitHub Discussions. Let's build verifiable AI futures! 🚀