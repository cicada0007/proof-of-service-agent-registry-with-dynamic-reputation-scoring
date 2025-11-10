import { prisma } from "@/db/prisma";
import { HttpError } from "@/middleware/errorHandler";
import { logger } from "@/utils/logger";

interface ReputationUpdateInput {
  agentDid: string;
  delta: number;
  reference: string;
  description?: string;
}

export async function applyReputationUpdate(input: ReputationUpdateInput) {
  const agent = await prisma.agent.findUnique({ where: { did: input.agentDid } });
  if (!agent) {
    throw new HttpError(404, "Agent not found");
  }

  const reputation = Math.max(0, Math.min(1, agent.reputation + input.delta));

  const [updatedAgent] = await prisma.$transaction([
    prisma.agent.update({
      where: { id: agent.id },
      data: { reputation }
    }),
    prisma.reputationEvent.create({
      data: {
        agentId: agent.id,
        delta: input.delta,
        reference: input.reference,
        description: input.description
      }
    })
  ]);

  logger.info(
    { did: agent.did, delta: input.delta, reference: input.reference, reputation: updatedAgent.reputation },
    "Reputation updated"
  );

  return updatedAgent;
}

