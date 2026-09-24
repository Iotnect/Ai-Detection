import { createHmac, timingSafeEqual } from "node:crypto";

import { config } from "../config.js";

const TICKET_TTL_SECONDS = 300;

interface StreamTicketPayload {
  clientId: string;
  path: string;
  expiresAt: number;
}

function signature(payload: string): string {
  return createHmac("sha256", config.dashboardWebSocketSecret)
    .update(payload)
    .digest("base64url");
}

export function createStreamTicket(
  clientId: string,
  path: string,
): { token: string; expiresIn: number } {
  const payload: StreamTicketPayload = {
    clientId,
    path,
    expiresAt: Math.floor(Date.now() / 1000) + TICKET_TTL_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");

  return {
    token: `${encodedPayload}.${signature(encodedPayload)}`,
    expiresIn: TICKET_TTL_SECONDS,
  };
}

export function verifyStreamTicket(
  token: string,
  expectedPath: string,
): StreamTicketPayload | undefined {
  const [encodedPayload, candidateSignature] = token.split(".");

  if (!encodedPayload || !candidateSignature) return undefined;

  const expectedSignature = signature(encodedPayload);
  const candidateBuffer = Buffer.from(candidateSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    candidateBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(candidateBuffer, expectedBuffer)
  ) {
    return undefined;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<StreamTicketPayload>;

    if (
      typeof payload.clientId !== "string" ||
      payload.path !== expectedPath ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return undefined;
    }

    return payload as StreamTicketPayload;
  } catch {
    return undefined;
  }
}
