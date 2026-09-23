import { timingSafeEqual } from "node:crypto";

import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { config } from "../config.js";
import { getSupabaseAdmin } from "../db/supabase.js";

const AuthRequestSchema = z.object({
  user: z.string().default(""),
  password: z.string().default(""),
  token: z.string().default(""),
  action: z.enum(["publish", "read", "playback", "api", "metrics", "pprof"]),
  path: z.string().default(""),
  protocol: z.string().default(""),
});

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

    if (!parsed.success || parsed.data.path !== "mbs-kdn-c1") {
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
      valueMatches(input.user, auth.publishUser) &&
      valueMatches(input.password, auth.publishPassword)
    ) {
      return reply.code(204).send();
    }

    if (
      input.action === "read" &&
      input.protocol === "rtsp" &&
      valueMatches(input.user, auth.aiUser) &&
      valueMatches(input.password, auth.aiPassword)
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
