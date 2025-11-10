import cors from "cors";
import express, { json, urlencoded } from "express";
import helmet from "helmet";
import morgan from "morgan";

import { errorHandler } from "@/middleware/errorHandler";
import { agentRouter } from "@/routes/agents";
import { healthRouter } from "@/routes/health";
import { reputationRouter } from "@/routes/reputation";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(json({ limit: "1mb" }));
  app.use(urlencoded({ extended: true }));
  app.use(morgan("combined"));

  app.use("/health", healthRouter);
  app.use("/api/agents", agentRouter);
  app.use("/api/reputation", reputationRouter);

  app.use(errorHandler);

  return app;
}


