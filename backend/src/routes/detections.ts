import { timingSafeEqual } from "node:crypto";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { WebSocket } from "ws";
import { z } from "zod";

import { config } from "../config.js";

const DetectionSchema = z
  .object({
    camera_id: z.string().min(1).max(100),
    raw_y: z.number().finite().nonnegative(),
    smoothed_y: z.number().finite().nonnegative(),
    status: z.string().min(1).max(32),
    timestamp: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
      message: "timestamp must be a valid ISO-8601 date-time",
    }),
    message: z.string().min(1).max(500),
  })
  .strict();

type Detection = z.infer<typeof DetectionSchema>;

type StoredDetection = Detection & {
  received_at: string;
};

const latestDetections = new Map<string, StoredDetection>();
const dashboardClients = new Set<WebSocket>();

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

async function requireDashboardWebSocketAuthentication(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply | void> {
  const query = request.query as { token?: string };

  if (
    typeof query.token !== "string" ||
    !secretsMatch(query.token, config.dashboardWebSocketSecret)
  ) {
    return reply.code(401).send({
      error: "unauthorized",
      message: "A valid dashboard WebSocket token is required.",
    });
  }
}

function broadcastDetection(detection: StoredDetection): void {
  const message = JSON.stringify({
    type: "detection",
    data: detection,
  });

  for (const client of dashboardClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
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

      const detection: StoredDetection = {
        ...parsedDetection.data,
        received_at: new Date().toISOString(),
      };

      latestDetections.set(detection.camera_id, detection);
      broadcastDetection(detection);

      return reply.code(202).send({
        accepted: true,
        camera_id: detection.camera_id,
        received_at: detection.received_at,
      });
    },
  );

  app.get(
    "/detections/latest",
    { preHandler: requireAiServiceAuthentication },
    async () => ({
      data: Array.from(latestDetections.values()),
    }),
  );

  app.get(
    "/ws/detections",
    {
      websocket: true,
      preValidation: requireDashboardWebSocketAuthentication,
    },
    (socket) => {
      dashboardClients.add(socket);

      socket.send(
        JSON.stringify({
          type: "snapshot",
          data: Array.from(latestDetections.values()),
        }),
      );

      socket.on("close", () => {
        dashboardClients.delete(socket);
      });

      socket.on("error", () => {
        dashboardClients.delete(socket);
      });
    },
  );
}
