# Monitoring and Logging Setup for Proof-of-Service Agent Registry

## Overview

This document outlines the comprehensive monitoring and logging strategy for the Proof-of-Service Agent Registry infrastructure. As a decentralized platform built on Solana with off-chain components like IPFS and x402 payment integrations, effective monitoring ensures high availability, performance tracking for reputation scoring, verifiable work history updates, and secure handling of ZKP attestations and DID profiles. The setup focuses on observability across the web application stack (Next.js frontend, Node.js/Express backend, PostgreSQL database) and blockchain interactions (Anchor/Rust programs, Switchboard oracles).

Key objectives:
- **Real-time Metrics**: Track agent registration throughput, reputation score updates triggered by x402 settlements, and IPFS pinning latency.
- **Logging**: Capture detailed events for task completions, ZK-SNARK proof verifications, and escrow releases without exposing sensitive DID-linked data.
- **Alerting**: Proactive notifications for anomalies, such as oracle failures affecting off-chain attestations or TEE breaches in private data handling.
- **Integration with Deployment**: Supports BackendDev's CI/CD pipelines by integrating monitoring hooks into Docker-based deployments on AWS Fargate, ensuring seamless scaling for agent swarms and marketplace queries.

This setup uses open-source tools for cost-efficiency, with AWS-native services for hosting. All configurations are production-ready, emphasizing privacy (e.g., anonymized logs for ZK selective disclosure) and scalability for high-volume agent interactions.

## Monitoring Tools and Stack

We adopt a Prometheus + Grafana ecosystem for metrics visualization, complemented by the ELK Stack (Elasticsearch, Logstash, Kibana) for centralized logging. These are containerized via Docker and orchestrated with Docker Compose for local development, scaling to AWS ECS/Fargate in production.

### Core Components
- **Prometheus**: Time-series database for collecting metrics from backend services, Solana RPC nodes, and IPFS gateways.
- **Grafana**: Dashboards for visualizing agent-specific metrics (e.g., success rates, reputation deltas post-x402 txns).
- **Node Exporter**: System-level metrics (CPU, memory, disk) for backend servers.
- **Solana Metrics Exporter**: Custom exporter for on-chain events like program invocations for reputation updates.
- **ELK Stack**: For structured logging of API calls, blockchain hooks, and error traces.
- **Alertmanager**: Integrated with Prometheus for Slack/PagerDuty alerts on thresholds (e.g., >5% drop in agent query response time).

### Integration with Project-Specific Features
- **x402 Payment Monitoring**: Track HTTP 402 response times and settlement hooks. Use custom metrics for escrow release success rates (target: 99.9% uptime).
- **Reputation Scoring**: Monitor dynamic score computations, alerting on discrepancies between on-chain (Solana) and off-chain (IPFS/TEE) values.
- **ZKPs and Oracles**: Log Switchboard attestation latencies; metric for ZK-SNARK proof generation time (<500ms per verification).
- **Privacy Controls**: Logs redact sensitive fields (e.g., full DID keys) using Logstash filters; TEE metrics via AWS Nitro Enclaves attestation logs.

## Setup Instructions

### 1. Infrastructure Provisioning on AWS
Deploy monitoring services via Terraform (see `infra/terraform/monitoring.tf` for coordination with BackendDev's base infra). Key resources:
- **EKS Cluster** (for Fargate): Hosts Prometheus and ELK pods.
- **CloudWatch Integration**: Bridge for AWS-specific metrics (e.g., Fargate task health, Lambda cold starts for x402 hooks).
- **Vercel Edge Monitoring**: For frontend (Next.js) – auto-integrated via Vercel Analytics for agent query latencies.

Example Terraform snippet for Prometheus deployment:
```hcl
resource "aws_eks_cluster" "monitoring" {
  name     = "agent-registry-monitoring"
  role_arn = aws_iam_role.eks_cluster_role.arn
  vpc_config {
    subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]
  }
}

resource "helm_release" "prometheus" {
  name       = "prometheus"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "prometheus"
  namespace  = "monitoring"
  values = [
    yamlencode({
      server = {
        persistentVolume = {
          enabled = true
          size    = "10Gi"
        }
      }
    })
  ]
}
```

### 2. Backend Instrumentation (Node.js/Express)
Instrument the backend with Prometheus client libraries to expose metrics at `/metrics` endpoint.

Install dependencies:
```bash
npm install prom-client express-prom-bundle
```

Example middleware setup in `src/app.ts` (tailored for agent registry APIs):
```typescript
import promBundle from 'express-prom-bundle';
import client from 'prom-client';

const bundle = promBundle({
  includeMethod: true,
  includePath: true,
  normalizePath: true,
  metricsPath: '/metrics',
  collectDefaultMetrics: true,
});

// Custom metric for reputation updates
const reputationUpdates = new client.Counter({
  name: 'agent_reputation_updates_total',
  help: 'Total reputation score updates via x402 settlements',
  labelNames: ['agent_did', 'success'],
});

app.use(bundle);

// In x402 hook endpoint
app.post('/x402/settle', async (req, res) => {
  const { taskId, agentDid } = req.body;
  try {
    // Simulate escrow release and score update
    await updateReputation(taskId, agentDid);
    reputationUpdates.inc({ agent_did: agentDid, success: 'true' });
    res.status(200).json({ settled: true });
  } catch (error) {
    reputationUpdates.inc({ agent_did: agentDid, success: 'false' });
    logger.error(`Settlement failed for ${taskId}: ${error.message}`); // Structured log
    res.status(402).json({ error: 'Payment required' });
  }
});
```

For Prisma/PostgreSQL: Use `pg_prometheus` extension to monitor query latencies, indexing agent profile queries.

### 3. Blockchain and Off-Chain Monitoring
- **Solana Programs**: Use Solana's JSON RPC metrics exporter. Custom Anchor program logs (via `solana-logs`) feed into ELK for events like `RegisterCapability` or `UpdateReputation`.
  - Scrape config in Prometheus (`prometheus.yml`):
    ```yaml
    scrape_configs:
      - job_name: 'solana_rpc'
        static_configs:
          - targets: ['solana-mainnet.rpc:8899']
        metrics_path: '/metrics'
    ```
- **IPFS Pinning**: Monitor via IPFS Cluster API. Metric: `ipfs_pin_add_duration_seconds` for NFT-linked agent profiles.
- **Switchboard Oracles**: Integrate oracle feed metrics; alert on feed staleness (>10s) affecting work history attestations.
- **ZKPs**: Custom timing metrics for zk-SNARK circuits (e.g., using snarkjs); log proof validity without revealing inputs.

### 4. Frontend Monitoring (Next.js)
Leverage Vercel Speed Insights for core web vitals. Add custom events for agent selection flows:
```typescript
// In a Zustand store for agent queries
import { get } from '@vercel/speed-insights';

export const useAgentStore = create((set) => ({
  queryAgents: async (filters: { reputationMin: number }) => {
    const start = performance.now();
    const agents = await fetch('/api/agents', { body: JSON.stringify(filters) });
    const duration = performance.now() - start;
    // Log to backend for aggregation
    fetch('/api/metrics', { method: 'POST', body: JSON.stringify({ event: 'agent_query', duration }) });
    set({ agents: await agents.json() });
  },
}));
```

### 5. Logging Configuration
Use Winston for Node.js logging, shipping to ELK via Filebeat.

Example Winston setup (`src/logger.ts`):
```typescript
import winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';

const esTransport = new ElasticsearchTransport({
  level: 'info',
  clientOpts: { node: process.env.ELASTICSEARCH_URL },
  indexPrefix: 'agent-registry-logs',
  transformer: (logData) => ({
    ...logData,
    '@timestamp': new Date().toISOString(),
    app: 'proof-of-service-registry',
    // Redact sensitive data
    did: logData.did ? '[REDACTED]' : undefined,
  }),
});

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [esTransport, new winston.transports.Console()],
});

export default logger;
```

Log levels:
- **DEBUG**: ZKP proof details (local only).
- **INFO**: Agent registrations, x402 settlements.
- **ERROR**: Oracle failures, TEE attestation errors.
- **WARN**: Reputation score drifts (>1% variance).

Kibana Dashboards: Pre-built for query volumes, error rates in agent swarm selections.

## Alerting and Incident Response

Configure Prometheus Alertmanager rules (`alerts.yml`):
```yaml
groups:
- name: agent_registry_alerts
  rules:
  - alert: High Reputation Update Latency
    expr: rate(reputation_updates_duration_seconds[5m]) > 2
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Reputation scoring latency high for agent {{ $labels.agent_did }}"
      description: "Task completions not updating scores within SLA; check x402 hooks."
  - alert: IPFS Pin Failure
    expr: ipfs_pin_errors_total > 5
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Multiple IPFS pinning failures detected"
      description: "Off-chain agent profiles at risk; verify NFT compression."
```

Integrate with PagerDuty for on-call rotations. Thresholds tuned for target audience: Developers (query SLAs <200ms), Marketplaces (uptime 99.99%), End-users (swarm selection reliability).

## Best Practices and Maintenance
- **Security**: Rotate Prometheus scrape tokens; use RBAC for Grafana access (roles: DevOps read/write, BackendDev read-only).
- **Scaling**: Auto-scale ELK on AWS; retain logs for 90 days (GDPR-compliant for DID ownership).
- **Testing**: CI/CD pipeline (GitHub Actions) includes monitoring smoke tests, e.g., simulate x402 txn and verify metric emission.
- **Coordination**: BackendDev – expose `/health` endpoints for liveness probes. Update this doc post-deploy for any custom metrics from Rust programs.
- **Cost Optimization**: Use AWS Cost Explorer tags like `project:agent-registry` for monitoring resources (~$50/month at scale).

For updates, reference unique identifier: `1762759105743_proof_of_service_agent_registry_with_dynamic_reputation_scoring__infra_monitoring_md_5m8p2r`. Contact DevOps for Terraform applies or Grafana imports.