import "dotenv/config";

import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import websocket from "@fastify/websocket";
import Fastify from "fastify";

import { config } from "./config.js";
import { detectionRoutes } from "./routes/detections.js";
import { mediaMtxAuthRoutes } from "./routes/mediamtx-auth.js";
import { streamRoutes } from "./routes/streams.js";
import { createStreamRuntime } from "./stream/runtime.js";
import { startDailyReports } from "./reports/service.js";
import { umEventRoutes } from "./routes/um-events.js";
import { SupabaseUmEventStore } from "./db/um-event-store.js";
import { getSupabaseAdmin } from "./db/supabase.js";

const app = Fastify({
  logger: true,
});
const streamRuntime = createStreamRuntime(app.log);
let stopDailyReports: () => Promise<void> = async () => {};

await app.register(websocket);
await app.register(helmet);

await app.register(cors, {
  origin: config.frontendOrigins,
});

await app.register(detectionRoutes, { prefix: "/api/v1" });
const umDatabase = getSupabaseAdmin();
await app.register(umEventRoutes, { prefix: "/api/v1", secret: config.umServiceSecret,
  deviceId: config.umDeviceId, store: umDatabase ? new SupabaseUmEventStore(umDatabase) : undefined });
await app.register(streamRoutes, { runtime: streamRuntime, prefix: "/api/v1" });
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
  stopDailyReports = startDailyReports(app.log);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "shutting down");
  await stopDailyReports();
  await streamRuntime.stop();
  await app.close();
  process.exit(0);
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
