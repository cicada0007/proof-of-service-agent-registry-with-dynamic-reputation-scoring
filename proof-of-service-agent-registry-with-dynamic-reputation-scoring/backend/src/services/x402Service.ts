import { createHmac } from "crypto";

import { HttpError } from "@/middleware/errorHandler";
import { loadConfig } from "@/utils/config";

const { x402Secret } = loadConfig();

export function verifyWebhookSignature(payload: unknown, signature?: string | string[]) {
  if (!signature || typeof signature !== "string") {
    throw new HttpError(401, "Missing x402 signature header");
  }
  const message = typeof payload === "string" ? payload : JSON.stringify(payload);
  const digest = createHmac("sha256", x402Secret).update(message).digest("hex");
  if (digest !== signature) {
    throw new HttpError(401, "Invalid x402 signature");
  }
}

