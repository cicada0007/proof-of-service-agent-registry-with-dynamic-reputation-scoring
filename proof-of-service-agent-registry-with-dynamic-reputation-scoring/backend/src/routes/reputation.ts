import { Router } from "express";
import { z } from "zod";

import { prisma } from "@/db/prisma";
import { HttpError } from "@/middleware/errorHandler";
import { applyReputationUpdate } from "@/services/reputationService";
import { confirmSettlement } from "@/services/solanaService";
import { verifyWebhookSignature } from "@/services/x402Service";

const settleSchema = z.object({
  x402TxnId: z.string(),
  agentDid: z.string(),
  taskOutcome: z.enum(["success", "failed", "partial"]),
  paymentAmount: z.string(),
  description: z.string().optional()
});

export const reputationRouter = Router();

reputationRouter.post("/update", async (req, res, next) => {
  try {
    const payload = settleSchema.parse(req.body);

    verifyWebhookSignature(req.body, req.headers["x-402-signature"]);

    const confirmed = await confirmSettlement(payload.x402TxnId);
    if (!confirmed) {
      throw new HttpError(409, "Settlement not confirmed on-chain");
    }

    const delta = deriveDelta(payload.taskOutcome, Number(payload.paymentAmount));

    const agent = await applyReputationUpdate({
      agentDid: payload.agentDid,
      delta,
      reference: payload.x402TxnId,
      description: payload.description
    });

    res.json({
      message: "Reputation updated",
      agent
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new HttpError(400, "Invalid payload", { issues: error.issues }));
    }
    next(error);
  }
});

reputationRouter.get("/:did", async (req, res, next) => {
  try {
    const agent = await prisma.agent.findUnique({ where: { did: req.params.did } });
    if (!agent) {
      throw new HttpError(404, "Agent not found");
    }
    const events = await prisma.reputationEvent.findMany({
      where: { agentId: agent.id },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    res.json({
      did: agent.did,
      score: agent.reputation,
      events
    });
  } catch (error) {
    next(error);
  }
});

function deriveDelta(outcome: "success" | "failed" | "partial", amount: number): number {
  if (Number.isNaN(amount) || amount <= 0) {
    amount = 0.05;
  }
  switch (outcome) {
    case "success":
      return Math.min(0.1, amount / 10);
    case "partial":
      return amount / 20;
    case "failed":
    default:
      return -0.05;
  }
}


