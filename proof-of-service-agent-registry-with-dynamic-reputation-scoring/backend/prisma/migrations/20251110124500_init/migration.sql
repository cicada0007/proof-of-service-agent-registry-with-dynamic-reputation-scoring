-- Generated via `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`
-- This migration initializes the agent registry schema with reputation events.

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "did" TEXT NOT NULL,
    "ownerPubkey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT,
    "reputation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metadataCid" TEXT,
    "proofCid" TEXT,
    "disclosure" TEXT NOT NULL DEFAULT 'zk-selective',
    "endpoint" TEXT,
    "capabilities" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkHistory" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "zkProofCid" TEXT,
    "settlement" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReputationEvent" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,
    "reference" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReputationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Agent_did_key" ON "Agent"("did");

-- CreateIndex
CREATE UNIQUE INDEX "WorkHistory_taskId_key" ON "WorkHistory"("taskId");

-- CreateIndex
CREATE INDEX "ReputationEvent_agentId_createdAt_idx" ON "ReputationEvent"("agentId", "createdAt");

-- AddForeignKey
ALTER TABLE "WorkHistory" ADD CONSTRAINT "WorkHistory_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReputationEvent" ADD CONSTRAINT "ReputationEvent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

