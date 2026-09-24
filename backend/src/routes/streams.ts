import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  getRequestClientId,
  requireDashboardAuthentication,
} from "../auth/dashboard-auth.js";
import { createStreamTicket } from "../auth/stream-ticket.js";
import { getSupabaseAdmin } from "../db/supabase.js";

const StreamTicketRequestSchema = z.object({
  path: z.string().min(1),
});

export async function streamRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/stream-ticket",
    { preHandler: requireDashboardAuthentication },
    async (request, reply) => {
      const parsed = StreamTicketRequestSchema.safeParse(request.body);
      const clientId = getRequestClientId(request);
      const supabase = getSupabaseAdmin();

      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid_stream_path" });
      }

      if (!clientId || !supabase) {
        return reply.code(503).send({ error: "stream_auth_unavailable" });
      }

      const { data: camera } = await supabase
        .from("cameras")
        .select("id")
        .eq("client_id", clientId)
        .eq("stream_path", parsed.data.path)
        .maybeSingle();

      if (!camera) {
        return reply.code(403).send({ error: "stream_forbidden" });
      }

      return createStreamTicket(clientId, parsed.data.path);
    },
  );
}
