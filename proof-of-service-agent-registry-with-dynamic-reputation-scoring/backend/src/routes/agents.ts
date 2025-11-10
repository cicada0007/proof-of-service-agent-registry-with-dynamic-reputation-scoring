import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { prisma } from "@/db/prisma";
import { extractPubkeyFromDid } from "@/lib/did";
import { verifySolanaSignature } from "@/lib/signature";
import { HttpError } from "@/middleware/errorHandler";
import { pinAgentMetadata } from "@/services/ipfsService";
import { createSelectiveDisclosureProof } from "@/services/zkService";
import { generateCid } from "@/utils/cid";
import { logger } from "@/utils/logger";

const capabilitySchema = z.object({
  skills: z.array(z.string()).min(1),
  successRate: z.number().min(0).max(1),
  latencyMs: z.number().min(0)
});

const registerSchema = z.object({
  did: z.string().min(10),
  name: z.string().min(1),
  summary: z.string().optional(),
  endpoint: z.string().optional(),
  disclosure: z.enum(["public", "zk-selective", "private"]).optional(),
  metadataCid: z.string().optional(),
  proofCid: z.string().optional(),
  capabilities: capabilitySchema,
  message: z.string().min(1),
  signature: z.string().min(1)
});

export const agentRouter = Router();

agentRouter.get("/", async (_req, res, next) => {
  try {
    const agents = await prisma.agent.findMany({
      orderBy: { createdAt: "desc" },
      take: 25
    });

    res.json({
      agents
    });
  } catch (error) {
    next(error);
  }
});

agentRouter.post("/", async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const ownerPubkey = extractPubkeyFromDid(input.did);

    const isValidSignature = verifySolanaSignature(input.message, input.signature, ownerPubkey);
    if (!isValidSignature) {
      throw new HttpError(401, "Invalid wallet signature");
    }

    const capabilityPayload = {
      skills: input.capabilities.skills,
      successRate: input.capabilities.successRate,
      latencyMs: input.capabilities.latencyMs
    };
    const metadataCid =
      input.metadataCid ??
      (await pinAgentMetadata({
        did: input.did,
        name: input.name,
        summary: input.summary,
        endpoint: input.endpoint,
        capabilities: capabilityPayload
      }));
    const capabilityHash = generateCid(capabilityPayload);
    const proofCid = input.proofCid ?? (await createSelectiveDisclosureProof({ did: input.did, capabilityHash }));

    const agent = await prisma.agent.create({
      data: {
        did: input.did,
        ownerPubkey,
        name: input.name,
        summary: input.summary,
        endpoint: input.endpoint,
        disclosure: input.disclosure ?? "zk-selective",
        metadataCid,
        proofCid,
        capabilities: capabilityPayload,
        reputation: 0
      }
    });

    logger.info({ did: agent.did }, "Agent registered");

    res.status(201).json({
      agent
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new HttpError(400, "Invalid payload", { issues: error.issues }));
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return next(new HttpError(409, "Agent already registered for DID"));
    }
    next(error);
  }
});


