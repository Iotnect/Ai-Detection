import { timingSafeEqual } from "node:crypto";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { WebSocket } from "ws";

import {
  getRequestClientId,
  requireDashboardAuthentication,
} from "../auth/dashboard-auth.js";
import { config } from "../config.js";
import { createDetectionStore } from "../db/detection-store.js";
import { DetectionSchema, type StoredDetection } from "../domain/detection.js";

const detectionStore = createDetectionStore();
const dashboardClients = new Map<WebSocket, string | undefined>();
const liveDetections = new Map<string, StoredDetection>();
const lastPersistedAt = new Map<string, number>();

function secretsMatch(candidate: string, expected: string): boolean {
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);

  return (
    candidateBuffer.length === expectedBuffer.length &&
    timingSafeEqual(candidateBuffer, expectedBuffer)
  );
}

async function requireAiServiceAuthentication(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply | void> {
  const authorization = request.headers.authorization;
  const prefix = "Bearer ";

  if (
    !authorization?.startsWith(prefix) ||
    !secretsMatch(authorization.slice(prefix.length), config.aiServiceSecret)
  ) {
    return reply.code(401).send({
      error: "unauthorized",
      message: "A valid AI service token is required.",
    });
  }
}

function broadcastDetection(detection: StoredDetection): void {
  const message = JSON.stringify({
    type: "detection",
    data: detection,
  });

  for (const [client, clientId] of dashboardClients) {
    if (
      client.readyState === WebSocket.OPEN &&
      (!clientId || clientId === detection.client_id)
    ) {
      client.send(message);
    }
  }
}

async function latestDetections(clientId?: string): Promise<StoredDetection[]> {
  const persisted = await detectionStore.latest(clientId);
  const combined = new Map(
    persisted.map((detection) => [detection.camera_id, detection]),
  );

  for (const detection of liveDetections.values()) {
    if (!clientId || detection.client_id === clientId) {
      combined.set(detection.camera_id, detection);
    }
  }

  return Array.from(combined.values());
}

export async function detectionRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/detections",
    { preHandler: requireAiServiceAuthentication },
    async (request, reply) => {
      const parsedDetection = DetectionSchema.safeParse(request.body);

      if (!parsedDetection.success) {
        return reply.code(400).send({
          error: "invalid_payload",
          fields: parsedDetection.error.flatten().fieldErrors,
        });
      }

      let detection: StoredDetection;
      let persisted = false;

      try {
        const previous = liveDetections.get(parsedDetection.data.camera_id);
        const lastSaved =
          lastPersistedAt.get(parsedDetection.data.camera_id) ?? 0;
        const shouldPersist =
          !previous ||
          previous.status !== parsedDetection.data.status ||
          Date.now() - lastSaved >= config.detectionPersistIntervalMs;

        if (shouldPersist) {
          detection = await detectionStore.save(parsedDetection.data);
          lastPersistedAt.set(parsedDetection.data.camera_id, Date.now());
          persisted = true;
        } else {
          detection = {
            ...parsedDetection.data,
            client_id: previous.client_id,
            received_at: new Date().toISOString(),
          };
        }
      } catch (error) {
        request.log.error({ err: error }, "failed to persist detection");
        return reply.code(503).send({
          error: "storage_unavailable",
          message: "The detection could not be persisted.",
        });
      }

      liveDetections.set(detection.camera_id, detection);
      broadcastDetection(detection);

      return reply.code(202).send({
        accepted: true,
        persisted,
        camera_id: detection.camera_id,
        received_at: detection.received_at,
      });
    },
  );

  app.get(
    "/detections/latest",
    { preHandler: requireDashboardAuthentication },
    async (request, reply) => {
      try {
        return { data: await latestDetections(getRequestClientId(request)) };
      } catch (error) {
        request.log.error({ err: error }, "failed to read detections");
        return reply.code(503).send({
          error: "storage_unavailable",
          message: "Detections are temporarily unavailable.",
        });
      }
    },
  );

  app.get(
    "/ws/detections",
    {
      websocket: true,
      preValidation: requireDashboardAuthentication,
    },
    async (socket, request) => {
      const clientId = getRequestClientId(request);
      dashboardClients.set(socket, clientId);

      try {
        socket.send(
          JSON.stringify({
            type: "snapshot",
            data: await latestDetections(clientId),
          }),
        );
      } catch {
        socket.send(
          JSON.stringify({
            type: "error",
            message: "Unable to load the initial detection snapshot.",
          }),
        );
      }

      socket.on("close", () => {
        dashboardClients.delete(socket);
      });

      socket.on("error", () => {
        dashboardClients.delete(socket);
      });
    },
  );
}
