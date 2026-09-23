import "dotenv/config";

import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import websocket from "@fastify/websocket";
import Fastify from "fastify";

import { config } from "./config.js";
import { detectionRoutes } from "./routes/detections.js";

const app = Fastify({
  logger: true,
});

await app.register(websocket);
await app.register(helmet);

await app.register(cors, {
  origin: config.frontendOrigin,
});

await app.register(detectionRoutes, { prefix: "/api/v1" });

app.get("/health", async () => ({
  status: "ok",
  service: "ai-detection-backend",
  timestamp: new Date().toISOString(),
}));

try {
  await app.listen({
    port: config.port,
    host: "0.0.0.0",
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
