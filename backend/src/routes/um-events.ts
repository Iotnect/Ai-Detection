import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { UmEventSchema } from "../domain/um-event.js";
import type { UmEventStore } from "../db/um-event-store.js";

interface UmRouteOptions {
  secret?: string;
  deviceId: string;
  store?: UmEventStore;
}

const umOrigins = new Set(["https://neovision.iotnect.com", "https://um.iotnect.com"]);

export async function umEventRoutes(app: FastifyInstance, options: UmRouteOptions) {
  app.post("/um/events", { bodyLimit: 16_384 }, async (request, reply) => {
    if (!options.secret || !options.store) return reply.code(503).send({ error: "um_not_configured" });
    const supplied = request.headers.authorization?.replace(/^Bearer /, "") ?? "";
    const validToken = request.headers.authorization?.startsWith("Bearer ") &&
      Buffer.byteLength(supplied) === Buffer.byteLength(options.secret) &&
      timingSafeEqual(Buffer.from(supplied), Buffer.from(options.secret));
    if (!validToken) return reply.code(401).send({ error: "unauthorized" });
    const parsed = UmEventSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_payload", fields: parsed.error.flatten().fieldErrors });
    if (parsed.data.device_id !== options.deviceId) return reply.code(403).send({ error: "device_not_allowed" });
    if (Date.parse(parsed.data.timestamp) > Date.now() + 300_000) return reply.code(400).send({ error: "timestamp_in_future" });
    try {
      const result = await options.store.save(parsed.data);
      return reply.code(result.duplicate ? 200 : 201).send({ accepted: true, persisted: true,
        duplicate: result.duplicate, id: result.reading.id, received_at: result.reading.received_at });
    } catch {
      request.log.error({}, "UM event persistence failed");
      return reply.code(503).send({ error: "storage_unavailable", message: "Retry this event with the same timestamp and trigger." });
    }
  });

  // UM remains a public presentation workspace. Expose only dashboard-safe fields.
  app.get("/um/events", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    const origin = request.headers.origin;
    if (!origin || !umOrigins.has(origin)) return reply.code(403).send({ error: "origin_not_allowed" });
    reply.header("Access-Control-Allow-Origin", origin);
    reply.header("Vary", "Origin");
    if (!options.secret || !options.store) return reply.code(503).send({ error: "um_not_configured" });
    const query = z.object({ limit: z.coerce.number().int().min(1).max(1000).default(1000) }).strict().safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "invalid_query" });
    try {
      const since = new Date(Date.now() - 86_400_000).toISOString();
      const [readings, trend] = await Promise.all([
        options.store.history(options.deviceId, query.data.limit),
        options.store.history(options.deviceId, Number.MAX_SAFE_INTEGER, since),
      ]);
      return { data: readings, latest: readings[0] ?? null, trend };
    } catch {
      request.log.error({}, "UM history read failed");
      return reply.code(503).send({ error: "storage_unavailable" });
    }
  });
}
