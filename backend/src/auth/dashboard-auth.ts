import { timingSafeEqual } from "node:crypto";

import type { FastifyReply, FastifyRequest } from "fastify";

import { config } from "../config.js";
import { getSupabaseAdmin } from "../db/supabase.js";

const requestClientIds = new WeakMap<FastifyRequest, string>();

function secretsMatch(candidate: string, expected: string): boolean {
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);

  return (
    candidateBuffer.length === expectedBuffer.length &&
    timingSafeEqual(candidateBuffer, expectedBuffer)
  );
}

function bearerToken(request: FastifyRequest): string | undefined {
  const authorization = request.headers.authorization;

  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length);
  }

  const protocol = request.headers["sec-websocket-protocol"];
  return Array.isArray(protocol) ? protocol[0] : protocol?.split(",")[0]?.trim();
}

export function getRequestClientId(request: FastifyRequest): string | undefined {
  return requestClientIds.get(request);
}

export async function requireDashboardAuthentication(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply | void> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    const token = bearerToken(request);

    if (
      !token ||
      !secretsMatch(token, config.dashboardWebSocketSecret)
    ) {
      return reply.code(401).send({
        error: "unauthorized",
        message: "A valid local dashboard token is required.",
      });
    }

    return;
  }

  const token = bearerToken(request);

  if (!token) {
    return reply.code(401).send({
      error: "unauthorized",
      message: "A Supabase access token is required.",
    });
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    return reply.code(401).send({
      error: "unauthorized",
      message: "The Supabase session is invalid or expired.",
    });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("client_id")
    .eq("id", userData.user.id)
    .single();

  if (profileError || !profile) {
    return reply.code(403).send({
      error: "profile_not_configured",
      message: "This user is not assigned to a client.",
    });
  }

  requestClientIds.set(request, profile.client_id);
}
