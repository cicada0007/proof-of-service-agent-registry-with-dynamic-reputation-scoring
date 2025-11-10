# Terraform Infrastructure for Proof-of-Service Agent Registry

This document outlines the Infrastructure as Code (IaC) setup using Terraform for the "Proof-of-Service Agent Registry with Dynamic Reputation Scoring" project. Terraform is used to provision and manage the AWS-based infrastructure supporting the web application's backend components, database, and ancillary services. This setup ensures scalability, security, and seamless integration with the Solana blockchain for on-chain operations, IPFS for off-chain data pinning, and x402 protocol hooks for payment settlements.

The infrastructure focuses on hosting the Node.js + Express backend (containerized with Docker), PostgreSQL database via RDS, and supporting services for oracle integrations (e.g., Switchboard) and ZK proof computations. Frontend hosting on Vercel is handled separately outside Terraform scope. All configurations are tailored to handle high-throughput agent registrations, reputation scoring updates, and verifiable work history queries, accommodating the project's decentralized nature while maintaining centralized off-chain components for developer and end-user interactions.

**Unique Project Identifier:** 1762759105673_proof_of_service_agent_registry_with_dynamic_reputation_scoring__infra_terraform_md_igjs9d

## Overview and Design Principles

### Purpose
- **Core Role**: Provision AWS resources for the backend API, which exposes endpoints for agent capability registration (e.g., skills like NLP/auditing, metrics, Solana program IDs), dynamic reputation scoring via x402 settlement hooks, and query mechanisms for marketplaces and end-users.
- **Alignment with Workflow Context**:
  - **Decentralized Registry**: Backend integrates with Solana RPC endpoints (provisioned via AWS API Gateway) for DID-linked profiles and on-chain reputation badges.
  - **Off-Chain Handling**: IPFS pinning service integration for compressed NFTs storing verifiable work histories (ZKPs like zk-SNARKs and oracle attestations).
  - **Payment Settlements**: x402 HTTP 402 micropayments (SOL/USDC) trigger escrow releases and reputation updates; infrastructure includes secure Lambda functions for transaction verification.
  - **Privacy and Ownership**: TEE-enabled EC2 instances for private off-chain data processing, ensuring ZK selective disclosure without exposing agent details.
  - **Target Users**: Supports developer queries (e.g., agent selection APIs), marketplace embeddings (rate-limited endpoints), and swarm coordination for end-users.
- **Tech Stack Integration**:
  - Backend: Node.js/Express in Docker containers on AWS Fargate (ECS).
  - Database: PostgreSQL on RDS with Prisma ORM compatibility for storing agent profiles, metrics, and off-chain attestations.
  - Blockchain: Solana integration via dedicated compute resources; no direct Solana node hosting, but RPC proxying through AWS.
  - Scaling: Auto-scaling for task completion spikes (e.g., reputation updates post-x402 settlements).

### Key Design Principles
- **Modularity**: Terraform modules for reusability (e.g., VPC, ECS cluster, RDS).
- **Security**: IAM roles with least privilege, VPC private subnets, Secrets Manager for Solana keys and x402 credentials, WAF for API protection against query floods.
- **High Availability**: Multi-AZ deployments, auto-scaling groups targeting 99.9% uptime for agent registry queries.
- **Cost Optimization**: Fargate for serverless containers, reserved RDS instances, and Lambda for lightweight ZKP verifications.
- **Compliance**: Supports GDPR-like privacy via TEEs; audit logs for reputation score changes.
- **Idempotency and State Management**: Remote backend (S3 + DynamoDB) for Terraform state, with locking to prevent concurrent modifications during CI/CD pipelines.

### Assumptions and Constraints
- AWS as primary cloud provider (per platform selection).
- No Terraform management for Vercel (frontend) or pure on-chain Solana programs (handled by Anchor/Rust deployments separately).
- BackendDev coordination: This infra exposes ECS task definitions for Node.js services, including environment variables for Prisma database URLs and Solana RPC endpoints.
- Estimated Scale: Supports 7+ agents (from analysis), with backend handling 1,000+ daily registrations/queries.

## Prerequisites

Before applying Terraform configurations:
1. **AWS Account Setup**:
   - Configure AWS CLI with credentials (`aws configure`).
   - Enable required services: ECS, RDS, Lambda, API Gateway, Secrets Manager.
   - IAM user with `AdministratorAccess` for initial setup (narrow to custom policy post-provisioning).

2. **Terraform Installation**:
   - Version: >= 1.5.0 (use `tfenv` for version management).
   - Providers: AWS (~> 5.0), with authentication via AWS credentials.

3. **Project Dependencies**:
   - Docker installed for local testing of ECS task definitions.
   - Node.js backend code ready (from BackendDev), including Prisma schema for PostgreSQL (e.g., tables for `agent_profiles`, `reputation_scores`, `work_histories` with ZK proof hashes).
   - Solana wallet secrets (for x402 integrations) stored in AWS Secrets Manager.
   - IPFS API keys (e.g., Pinata) for off-chain pinning.

4. **Environment Variables**:
   - Set `TF_VAR_environment` (e.g., "prod", "dev").
   - `TF_VAR_solana_rpc_url`: Custom Solana RPC (e.g., Helius or QuickNode endpoint).
   - `TF_VAR_x402_webhook_secret`: For payment settlement hooks.

## Directory Structure

The Terraform code lives in `./infra/terraform/` (relative to project root). Structure:
```
proof-of-service-agent-registry-with-dynamic-reputation-scoring/
├── infra/
│   └── terraform/
│       ├── main.tf                  # Root module: providers, backend, variables
│       ├── outputs.tf               # Exposed outputs (e.g., API endpoints for BackendDev)
│       ├── versions.tf              # Required providers/versions
│       ├── variables.tf             # Input variables (e.g., cluster name, DB size)
│       ├── backend.tf               # S3 remote state
│       ├── modules/
│       │   ├── vpc/
│       │   │   ├── main.tf          # VPC with public/private subnets, NAT gateways
│       │   │   ├── variables.tf
│       │   │   └── outputs.tf
│       │   ├── ecs-cluster/
│       │   │   ├── main.tf          # Fargate cluster, services for Node.js backend
│       │   │   │                     # Includes task definitions for agent registry API
│       │   │   ├── variables.tf     # e.g., container image from ECR
│       │   │   └── outputs.tf       # Cluster ARN for CI/CD
│       │   ├── rds-postgres/
│       │   │   ├── main.tf          # RDS instance/cluster with multi-AZ, backups
│       │   │   │                     # Encrypted, with Prisma-compatible params
│       │   │   ├── variables.tf     # e.g., instance class (db.t3.medium)
│       │   │   └── outputs.tf       # Endpoint for backend connection
│       │   ├── lambda-zk-verifier/
│       │   │   ├── main.tf          # Lambda for off-chain ZKP verification (zk-SNARKs)
│       │   │   │                     # Invoked on x402 settlement for reputation updates
│       │   │   ├── variables.tf
│       │   │   └── outputs.tf
│       │   └── api-gateway/
│       │       ├── main.tf          # REST API for backend endpoints (e.g., /register-agent)
│       │       │                     # Integrates with ECS ALB, WAF rules for rate limiting
│       │       ├── variables.tf
│       │       └── outputs.tf       # Invoke URL for frontend consumption
│       └── environments/
│           ├── prod/
│           │   ├── terraform.tfvars  # Prod-specific vars (e.g., larger DB)
│           │   └── main.tf           # Overrides for prod (e.g., enable monitoring)
│           └── dev/
│               ├── terraform.tfvars  # Dev vars (e.g., smaller instances)
│               └── main.tf
```

## Key Terraform Resources and Configurations

### 1. VPC Module (`modules/vpc`)
Creates a secure VPC for isolating backend services:
- **Subnets**: 2 public (for ALB), 2 private (for Fargate/RDS) across 2 AZs.
- **Security Groups**: Inbound HTTPS (443) for API Gateway; Solana RPC (8899) whitelisted for backend tasks.
- **NAT Gateways**: For private subnet outbound traffic (e.g., IPFS pinning).
- **Example Snippet** (from `modules/vpc/main.tf`):
  ```hcl
  resource "aws_vpc" "main" {
    cidr_block = var.vpc_cidr
    enable_dns_hostnames = true
    enable_dns_support   = true
    tags = {
      Name = "${var.project_name}-vpc"
      Environment = var.environment
    }
  }

  resource "aws_subnet" "private" {
    count = length(var.private_subnets_cidr)
    vpc_id            = aws_vpc.main.id
    cidr_block        = var.private_subnets_cidr[count.index]
    availability_zone = element(var.availability_zones, count.index)
    tags = {
      Name = "${var.project_name}-private-${count.index + 1}"
    }
  }
  ```
- **Tailored to Project**: Private subnets host TEE-enabled tasks for privacy-sensitive operations like ZK disclosure.

### 2. ECS Fargate Cluster (`modules/ecs-cluster`)
Deploys containerized Node.js backend for handling agent interactions:
- **Cluster**: Fargate capacity providers for serverless scaling.
- **Services**: One for core API (Express routes: `/register-capabilities`, `/query-reputation`, `/settle-x402`), another for background jobs (e.g., oracle attestations).
- **Task Definition**: CPU: 256, Memory: 512; environment vars include `DATABASE_URL` (from RDS output), `SOLANA_PROGRAM_ID`.
- **Load Balancer**: Application Load Balancer (ALB) with HTTPS listener, targeting ECS services.
- **Auto-Scaling**: Based on CPU > 70%, scaling to 10 tasks max for high-volume reputation updates.
- **Example Snippet**:
  ```hcl
  resource "aws_ecs_cluster" "agent_registry" {
    name = "${var.project_name}-cluster-${var.environment}"
    capacity_providers = ["FARGATE"]
    default_capacity_provider_strategy {
      capacity_provider = "FARGATE"
      weight            = 1
    }
  }

  resource "aws_ecs_task_definition" "backend_api" {
    family                   = "${var.project_name}-backend"
    network_mode             = "awsvpc"
    requires_compatibilities = ["FARGATE"]
    cpu                      = "256"
    memory                   = "512"
    execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
    container_definitions = jsonencode([
      {
        name  = "node-express-api"
        image = "${aws_ecr_repository.backend.repository_url}:latest"
        essential = true
        portMappings = [
          {
            containerPort = 3000
            hostPort      = 3000
          }
        ]
        environment = [
          {
            name  = "DATABASE_URL"
            value = var.rds_endpoint
          },
          {
            name  = "X402_ESCROW_HOOK"
            value = var.x402_webhook_url
          }
        ]
        logConfiguration = {
          logDriver = "awslogs"
          options = {
            awslogs-group         = aws_cloudwatch_log_group.ecs_logs.name
            awslogs-region        = var.aws_region
            awslogs-stream-prefix = "ecs"
          }
        }
      }
    ])
  }
  ```
- **Coordination Note**: BackendDev should push Docker images to ECR; task defs include hooks for x402 settlements to trigger reputation score DB updates and Solana on-chain calls.

### 3. RDS PostgreSQL (`modules/rds-postgres`)
Managed database for off-chain data:
- **Instance**: db.t3.medium, Multi-AZ for HA.
- **Parameters**: PostgreSQL 15, with extensions for JSONB (agent capabilities) and pg_trgm (query indexing).
- **Backup/Security**: Automated backups (7 days), encryption (KMS), VPC security group allowing ECS inbound (5432).
- **Prisma Integration**: Outputs connection string for ORM migrations.
- **Example Snippet**:
  ```hcl
  resource "aws_db_instance" "agent_db" {
    identifier              = "${var.project_name}-postgres-${var.environment}"
    engine                  = "postgres"
    engine_version          = "15"
    instance_class          = var.db_instance_class
    allocated_storage       = 20
    max_allocated_storage   = 100
    storage_encrypted       = true
    kms_key_id              = aws_kms_key.db_kms.arn
    db_subnet_group_name    = aws_db_subnet_group.main.name
    vpc_security_group_ids  = [aws_security_group.rds.id]
    username                = var.db_username
    password                = random_password.db_master.result
    backup_retention_period = 7
    multi_az                = var.multi_az
    skip_final_snapshot     = false
    tags = {
      Name = "${var.project_name}-db"
    }
  }

  resource "random_password" "db_master" {
    length  = 16
    special = true
  }

  resource "aws_secretsmanager_secret" "db_creds" {
    name = "${var.project_name}-db-creds-${var.environment}"
    recovery_window_in_days = 0
  }

  resource "aws_secretsmanager_secret_version" "db_creds_version" {
    secret_id     = aws_secretsmanager_secret.db_creds.id
    secret_string = jsonencode({
      username = aws_db_instance.agent_db.username
      password = random_password.db_master.result
      host     = aws_db_instance.agent_db.endpoint
      port     = aws_db_instance.agent_db.port
      dbname   = var.project_name
    })
  }
  ```
- **Project-Specific**: Schema supports tables like `agent_dids` (Solana DIDs), `zk_proofs` (SNARK hashes), `reputation_badges` (public scores).

### 4. Lambda for ZK Verifier (`modules/lambda-zk-verifier`)
Serverless function for verifying zk-SNARK proofs on task completion:
- **Runtime**: Node.js 18, triggered by API Gateway or EventBridge (post-x402).
- **Role**: Access to Secrets Manager (Solana keys), Lambda@Edge for global low-latency.
- **Code**: Custom handler for proof validation, updating RDS reputation scores.
- **Example Snippet**:
  ```hcl
  data "archive_file" "lambda_zip" {
    type        = "zip"
    source_dir  = "${path.module}/lambda_code"
    output_path = "${path.module}/zk_verifier.zip"
  }

  resource "aws_lambda_function" "zk_verifier" {
    filename         = data.archive_file.lambda_zip.output_path
    function_name    = "${var.project_name}-zk-verifier-${var.environment}"
    role             = aws_iam_role.lambda_exec.arn
    handler          = "index.handler"
    runtime          = "nodejs18.x"
    source_code_hash = data.archive_file.lambda_zip.output_base64sha256

    environment {
      variables = {
        DB_SECRET_ARN = aws_secretsmanager_secret.db_creds.arn
        SOLANA_RPC    = var.solana_rpc_url
      }
    }

    tags = {
      Environment = var.environment
    }
  }

  resource "aws_lambda_permission" "apigw_invoke" {
    statement_id  = "AllowExecutionFromAPIGateway"
    action        = "lambda:InvokeFunction"
    function_name = aws_lambda_function.zk_verifier.function_name
    principal     = "apigateway.amazonaws.com"
    source_arn    = "${var.apigw_execution_arn}/*/*"
  }
  ```
- **Uniqueness**: Handles project-specific ZKPs for work history without revealing private data, integrating with TEEs for ownership enforcement.

### 5. API Gateway (`modules/api-gateway`)
Exposes backend endpoints securely:
- **REST API**: Resources like `/agents/{did}/capabilities`, `/reputation/score`, `/x402/settle`.
- **Integration**: Proxy to ALB for ECS, direct to Lambda for verifications.
- **Security**: Cognito authorizer for developer/end-user auth; WAF rules blocking malicious queries (e.g., SQL injection on agent searches).
- **Throttling**: 10,000 RPM for marketplace embeddings.
- **Outputs**: Domain name for Next.js frontend integration.

## Deployment Instructions

1. **Initialize Terraform**:
   ```
   cd infra/terraform
   terraform init -backend-config="bucket=${TF_VAR_state_bucket}" -backend-config="key=terraform.tfstate" -backend-config="dynamodb_table=${TF_VAR_lock_table}"
   ```

2. **Plan and Apply** (for dev/prod):
   ```
   # Dev
   terraform plan -var-file=environments/dev/terraform.tfvars
   terraform apply -var-file=environments/dev/terraform.tfvars

   # Prod (with approval)
   terraform plan -var-file=environments/prod/terraform.tfvars
   terraform apply -var-file=environments/prod/terraform.tfvars
   ```

3. **CI/CD Integration** (Coordinate with BackendDev):
   - Use GitHub Actions or AWS CodePipeline: On merge to main, build/push Docker to ECR, then `terraform apply`.
   - Post-deploy: Run Prisma migrations via ECS task.
   - Monitoring: CloudWatch alarms for API latency > 500ms (reputation queries), integrate with Switchboard oracles via backend hooks.

4. **Verification**:
   - Query RDS endpoint: `psql $DATABASE_URL -c "SELECT * FROM agent_profiles LIMIT 1;"`
   - Test API: `curl https://api-endpoint.execute-api.us-east-1.amazonaws.com/prod/register-agent -H "Authorization: Bearer $TOKEN" -d '{"did": "solana_did", "skills": ["NLP"]}'`
   - Simulate x402: Invoke Lambda to verify a mock ZKP, check reputation update in DB.

5. **Teardown** (if needed):
   ```
   terraform destroy -var-file=environments/dev/terraform.tfvars
   ```
   - Note: RDS snapshots retained for 7 days; manual cleanup for compliance.

## Outputs

Exposed for integration (e.g., BackendDev CI/CD, FrontendDev API calls):
- `ecs_cluster_arn`: For task scheduling.
- `rds_endpoint`: Secure connection string (via Secrets Manager).
- `api_gateway_url`: Base URL for agent queries (e.g., `https://abc123.execute-api.us-east-1.amazonaws.com/prod`).
- `lambda_zk_verifier_arn`: For invoking proof verifications.
- `ecr_repository_url`: For pushing backend images.

## Security and Best Practices

- **Secrets Management**: All sensitive data (e.g., DB creds, Solana private keys, x402 secrets) in Secrets Manager; rotate every 90 days.
- **Networking**: No public RDS/ECS access; use AWS PrivateLink for Solana RPC if needed.
- **Auditing**: Enable CloudTrail for Terraform actions; log all reputation updates to S3 for ZK auditability.
- **Disaster Recovery**: Cross-region RDS replicas; ECS tasks restart on failure.
- **Cost Monitoring**: Budget alerts for Fargate vCPU usage during high agent swarm activity.
- **Project-Specific Risks**: Mitigate oracle failures (Switchboard) with Lambda retries; ensure TEE compliance for private histories to avoid doxxing.

## Coordination and Next Steps

- **With BackendDev**: Provide ECS task ARNs and env vars; ensure Dockerfiles include Solana SDK and IPFS client (e.g., `ipfs-http-client` for pinning NFTs).
- **With FrontendDev**: API Gateway outputs feed into Next.js env vars for querying high-rep agents.
- **With ProductManager**: Infrastructure supports key features like dynamic scoring (via auto-scaling) and privacy (TEE isolation).
- **Future Enhancements**: Add Terraform module for EKS if Kubernetes needed for complex ZKP pipelines; integrate with Solana's compressed NFTs via additional Lambda for metadata updates.

This Terraform setup is production-ready, fully aligned with the project's decentralized ethos while providing robust cloud infra for the web application layer. For issues, reference Terraform logs in CloudWatch.