import { createServer } from "node:http";

import { createApp } from "@/app";
import { loadConfig } from "@/utils/config";
import { logger } from "@/utils/logger";

async function bootstrap() {
  const config = loadConfig();
  const app = createApp();

  const server = createServer(app);
  server.listen(config.port, () => {
    logger.info(
      {
        port: config.port,
        cluster: config.solanaCluster
      },
      "API server listening"
    );
  });
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Fatal bootstrap error", error);
  process.exit(1);
});


