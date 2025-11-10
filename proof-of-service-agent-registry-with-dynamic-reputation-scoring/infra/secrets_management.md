# Secrets Management in Proof-of-Service Agent Registry

## Overview

In the Proof-of-Service Agent Registry with Dynamic Reputation Scoring project, secrets management is critical for securing sensitive data across the decentralized infrastructure. This includes blockchain-related keys (e.g., Solana wallet private keys for DID management and program deployments), API credentials for off-chain services (e.g., IPFS pinning, Switchboard oracles), database connection strings for PostgreSQL, and x402 protocol secrets for micropayment settlements (e.g., SOL/USDC escrow hooks). Given the project's reliance on Solana (Anchor/Rust programs), IPFS for compressed NFT-linked data, ZKPs for verifiable histories, and TEEs for privacy-preserving computations, improper handling of secrets could expose agent profiles, reputation scores, or payment flows to risks like key leakage or unauthorized attestations.

This document outlines production-ready strategies for managing secrets in development, staging, and production environments. We prioritize zero-trust principles, rotation policies, and integration with infrastructure-as-code (IaC) tools like Terraform or AWS CDK, while coordinating with BackendDev for runtime injection in Node.js/Express services and Next.js deployments on Vercel/AWS Fargate.

Secrets are never committed to version control (e.g., Git). Instead, they are injected via environment variables, secret managers, or Kubernetes secrets (if scaling to EKS). All configurations align with the project's tech stack: Docker for containerization, AWS for hosting, and Prisma for ORM-secured database access.

## Key Secrets in the Project

The following categorizes secrets specific to our decentralized registry:

### 1. Blockchain and DID-Related Secrets
   - **Solana Wallet Private Key**: Used for signing transactions in Anchor programs (e.g., registering agent capabilities, updating reputation scores on task completion). Format: Base58-encoded string. Required for CLI tools like `solana-keygen` and runtime interactions via `@solana/web3.js`.
   - **DID Revocation Keys**: Solana-based Decentralized Identifiers (DIDs) for agent-owned profiles. Private keys enable revocable access to work histories and ZK-selective disclosures. Stored as JSON Web Key (JWK) pairs.
   - **Program Deployment Keys**: Anchor-specific seeds or PDAs (Program-Derived Addresses) for on-chain registry state (e.g., reputation scoring logic tied to x402 settlements).
   - **ZK Proof Generation Keys**: Parameters for zk-SNARK circuits (e.g., via Circom or Halo2) verifying task successes without revealing full histories. Proving/Verifying keys must be rotated post-deployment.

   **Usage Example**: In Rust Anchor programs, inject via `env!("SOLANA_PRIVATE_KEY")` macro or Cargo features. For Node.js backend, use `process.env.SOLANA_PRIVATE_KEY` with `bs58` decoding.

### 2. Off-Chain Service Secrets
   - **IPFS Pinning API Key**: For pinning agent capability profiles and compressed NFTs (e.g., via Pinata or Web3.Storage). Prevents data loss for off-chain verifiable histories.
   - **Switchboard Oracle API Key**: Authenticates feeds for off-chain attestations (e.g., validating task metrics like success rate/speed before reputation updates).
   - **TEE Enclave Keys**: Attestation keys for Trusted Execution Environments (e.g., AWS Nitro Enclaves) handling private off-chain data to avoid doxxing agent endpoints (API URLs, Solana program IDs).

   **Usage Example**: Backend services query IPFS via `process.env.IPFS_API_KEY` in Express routes for profile storage.

### 3. Payment and x402 Protocol Secrets
   - **x402 Webhook Secret**: HMAC key for verifying HTTP 402 Payment Required responses in micropayment flows (e.g., triggering SOL/USDC escrow release on task completion).
   - **Wallet Integration Keys**: Private keys for payment wallets (e.g., Phantom or Solana Pay integration) linked to agent registrations.
   - **Escrow Program Keys**: Anchor-derived seeds for on-chain escrow contracts that auto-update reputation scores upon settlement.

   **Usage Example**: In Node.js, validate x402 signatures with `crypto.createHmac('sha256', process.env.X402_WEBHOOK_SECRET)` before calling Solana RPC for reputation increments.

### 4. Infrastructure and Database Secrets
   - **PostgreSQL Connection String**: Includes username, password, host (e.g., AWS RDS), and SSL certs. Used by Prisma for querying agent listings, marketplace embeddings, and end-user selections.
   - **AWS Credentials**: Access Key ID and Secret Access Key for Fargate/Lambda deployments, S3 for TEE logs, or Secrets Manager integration.
   - **Vercel Environment Tokens**: For frontend deployments, securing API routes that proxy to backend for reputation queries.

   **Usage Example**: Prisma schema loads via `DATABASE_URL=postgresql://user:${DB_PASSWORD}@host:5432/db?sslmode=require`.

## Best Practices and Policies

### Environment Separation
- **Development**: Use local `.env` files (gitignored) with tools like `dotenv` for Node.js/Next.js. Generate test keys via `solana-keygen new` for Solana DIDs.
- **Staging**: Mirror production but with throttled quotas (e.g., testnet Solana, mock x402). Secrets sourced from AWS Secrets Manager ARNs.
- **Production**: All secrets from managed services. Enforce least-privilege IAM roles (e.g., no full Solana RPC access for backend pods).

### Secret Storage and Retrieval
- **Primary Tool: AWS Secrets Manager**: Store JSON payloads (e.g., `{ "solana_private_key": "base58key", "x402_secret": "hmacvalue" }`) with automatic rotation every 90 days. Integrate with Lambda for x402 hooks.
  - Retrieval Example (Node.js):
    ```javascript
    const AWS = require('aws-sdk');
    const secretsManager = new AWS.SecretsManager();
    async function getSecret(secretName) {
      const data = await secretsManager.getSecretValue({ SecretId: secretName }).promise();
      return JSON.parse(data.SecretString);
    }
    // Usage: const keys = await getSecret('prod/agent-registry-secrets');
    process.env.SOLANA_PRIVATE_KEY = keys.solana_private_key;
    ```
- **Alternative: HashiCorp Vault**: For multi-cloud setups, use Vault's KV engine with Solana-specific policies (e.g., dynamic credentials for oracle feeds).
- **Docker Integration**: Mount secrets as volumes or use AWS SSM Parameter Store for container env vars. Example Dockerfile:
  ```dockerfile
  # .dockerignore secrets
  ENV SOLANA_PRIVATE_KEY_PATH=/run/secrets/solana_key
  RUN --mount=type=secret,id=solana_key cat $SOLANA_PRIVATE_KEY_PATH | bs58 --decode > wallet.json
  ```
- **Vercel-Specific**: Use Vercel Environment Variables dashboard for frontend secrets (e.g., API keys for querying backend). For sensitive ops, proxy through serverless functions.

### Rotation and Auditing
- **Rotation Schedule**: Quarterly for API keys (IPFS, Switchboard); event-driven for compromised keys (e.g., post-ZKP circuit updates).
- **Auditing**: Enable AWS CloudTrail for Secrets Manager access logs. Integrate with CI/CD (e.g., GitHub Actions) to scan for leaked secrets using Trivy or GitGuardian.
- **Backup Strategy**: No direct backups; use Vault's TTL or AWS versioning. For Solana keys, derive from mnemonic seeds stored in HSMs (Hardware Security Modules) like AWS CloudHSM.

### Security Controls
- **Encryption in Transit/Rest**: Mandate TLS 1.3 for all API calls (e.g., x402 settlements). Secrets encrypted with AWS KMS (customer-managed keys).
- **Access Controls**: RBAC via IAM: DevOps team for infra secrets; BackendDev for runtime injection only. Use Solana's multisig for production DID keys.
- **Leak Prevention**: 
  - Git hooks to block commits with `PRIVATE_KEY` patterns.
  - Runtime checks in Node.js: `if (process.env.NODE_ENV === 'production' && !process.env.SOLANA_PRIVATE_KEY) { throw new Error('Missing secret'); }`
- **Privacy Alignment**: Secrets for TEEs ensure selective disclosure (e.g., reveal reputation badges publicly but keep work history proofs private via ZK).

## Integration with CI/CD and Deployment

Coordinate with BackendDev for secret injection in pipelines:
- **GitHub Actions Example** (for Docker builds on AWS Fargate):
  ```yaml
  - name: Retrieve Secrets
    uses: aws-actions/secretsmanager-get-secrets@v1
    with:
      secret-ids: prod/agent-registry-secrets,prod/db-creds
    env:
      SOLANA_PRIVATE_KEY: ${{ on-secrets.SOLANA_PRIVATE_KEY }}
  - name: Build and Push
    run: docker build --build-arg SOLANA_PRIVATE_KEY=$SOLANA_PRIVATE_KEY -t registry:latest .
  ```
- **Vercel Deployment**: Link to AWS Secrets Manager via Vercel integrations; avoid direct env vars for high-sensitivity items like x402 secrets.
- **Monitoring**: Use Datadog or AWS X-Ray to alert on secret access anomalies (e.g., unusual fetches during reputation scoring updates).

## Troubleshooting Common Issues

- **Key Mismatch in Solana Transactions**: Verify Base58 decoding; test with `solana balance` CLI using env-injected keys.
- **x402 Webhook Failures**: Check HMAC validation logs; rotate secrets if replay attacks suspected.
- **Prisma Connection Errors**: Ensure `DB_PASSWORD` is URL-encoded and SSL enforced in RDS.
- **IPFS Pinning Timeouts**: Fallback to multiple providers; monitor API key quotas.

For updates, reference the unique identifier: `1762759105752_proof_of_service_agent_registry_with_dynamic_reputation_scoring__infra_secrets_management_md_of7fcjp`. Coordinate changes with BackendDev for any runtime impacts on agent registration or scoring logic.