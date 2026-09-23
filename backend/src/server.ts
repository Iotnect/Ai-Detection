import "dotenv/config";

import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import websocket from "@fastify/websocket";
import Fastify from "fastify";

import { config } from "./config.js";
import { detectionRoutes } from "./routes/detections.js";
import { mediaMtxAuthRoutes } from "./routes/mediamtx-auth.js";
import { createStreamRuntime } from "./stream/runtime.js";

const app = Fastify({
  logger: true,
});
const streamRuntime = createStreamRuntime(app.log);

await app.register(websocket);
await app.register(helmet);

await app.register(cors, {
  origin: config.frontendOrigins,
});

await app.register(detectionRoutes, { prefix: "/api/v1" });
await app.register(mediaMtxAuthRoutes, { prefix: "/internal/mediamtx" });

app.get("/health", async () => ({
  status: "ok",
  service: "ai-detection-backend",
  stream: streamRuntime.status(),
  timestamp: new Date().toISOString(),
}));

try {
  await app.listen({
    port: config.port,
    host: "0.0.0.0",
  });
  await streamRuntime.start();
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "shutting down");
  await streamRuntime.stop();
  await app.close();
  process.exit(0);
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
