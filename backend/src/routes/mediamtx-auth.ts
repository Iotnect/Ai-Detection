import { timingSafeEqual } from "node:crypto";

import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { config } from "../config.js";
import { verifyStreamTicket } from "../auth/stream-ticket.js";
import { getSupabaseAdmin } from "../db/supabase.js";

const AuthRequestSchema = z.object({
  user: z.string().default(""),
  password: z.string().default(""),
  token: z.string().default(""),
  action: z.enum(["publish", "read", "playback", "api", "metrics", "pprof"]),
  path: z.string().default(""),
  protocol: z.string().default(""),
});

const ORIGINAL_STREAM_PATH = "mbs-kdn-c1";
const AI_STREAM_PATH = "mbs-kdn-c1-ai";
const readablePaths = new Set([ORIGINAL_STREAM_PATH, AI_STREAM_PATH]);

function valueMatches(candidate: string, expected: string): boolean {
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);

  return (
    candidateBuffer.length === expectedBuffer.length &&
    timingSafeEqual(candidateBuffer, expectedBuffer)
  );
}

export async function mediaMtxAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth", async (request, reply) => {
    const parsed = AuthRequestSchema.safeParse(request.body);

    if (!parsed.success || !readablePaths.has(parsed.data.path)) {
      return reply.code(401).send();
    }

    const auth = config.mediaMtxAuth;
    const supabase = getSupabaseAdmin();

    if (!auth) {
      return reply.code(503).send();
    }

    const input = parsed.data;

    if (
      input.action === "publish" &&
      input.path === ORIGINAL_STREAM_PATH &&
      valueMatches(input.user, auth.publishUser) &&
      valueMatches(input.password, auth.publishPassword)
    ) {
      return reply.code(204).send();
    }

    const aiPublisher = config.mediaMtxAiPublishAuth;

    if (
      input.action === "publish" &&
      input.path === AI_STREAM_PATH &&
      aiPublisher &&
      valueMatches(input.user, aiPublisher.user) &&
      valueMatches(input.password, aiPublisher.password)
    ) {
      return reply.code(204).send();
    }

    if (
      ["read", "playback"].includes(input.action) &&
      ["rtsp", "hls"].includes(input.protocol) &&
      valueMatches(input.user, auth.aiUser) &&
      valueMatches(input.password, auth.aiPassword)
    ) {
      return reply.code(204).send();
    }

    if (
      ["read", "playback"].includes(input.action) &&
      verifyStreamTicket(input.token, input.path)
    ) {
      return reply.code(204).send();
    }

    if (!supabase || !input.token || !["read", "playback"].includes(input.action)) {
      return reply.code(401).send();
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(
      input.token,
    );

    if (userError || !userData.user) {
      return reply.code(401).send();
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("client_id")
      .eq("id", userData.user.id)
      .single();

    if (!profile) {
      return reply.code(401).send();
    }

    const { data: camera } = await supabase
      .from("cameras")
      .select("id")
      .eq("client_id", profile.client_id)
      .eq("stream_path", input.path)
      .maybeSingle();

    return camera ? reply.code(204).send() : reply.code(401).send();
  });
}
