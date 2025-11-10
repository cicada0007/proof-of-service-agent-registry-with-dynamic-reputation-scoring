import { Request, Response, NextFunction } from "express";

import { logger } from "@/utils/logger";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(error: Error, _req: Request, res: Response, _next: NextFunction) {
  const status = error instanceof HttpError ? error.status : 500;
  const payload = {
    error: {
      message: error.message,
      details: error instanceof HttpError ? error.details : undefined
    }
  };

  if (status >= 500) {
    logger.error({ err: error }, "Unhandled error");
  } else {
    logger.warn({ err: error }, "Client error");
  }

  res.status(status).json(payload);
}


