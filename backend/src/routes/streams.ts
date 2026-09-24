import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  getRequestClientId,
  requireDashboardAuthentication,
} from "../auth/dashboard-auth.js";
import {
  createStreamTicket,
  verifyStreamTicket,
} from "../auth/stream-ticket.js";
import { config } from "../config.js";
import { getSupabaseAdmin } from "../db/supabase.js";

const StreamTicketRequestSchema = z.object({
  path: z.string().min(1),
});

function appendTicket(uri: string, ticket: string): string {
  if (uri.startsWith("data:")) return uri;

  return `${uri}${uri.includes("?") ? "&" : "?"}ticket=${encodeURIComponent(ticket)}`;
}

export function rewriteHlsManifest(manifest: string, ticket: string): string {
  return manifest
    .split(/(\r?\n)/)
    .map((line) => {
      if (line === "\n" || line === "\r\n" || !line.trim()) return line;

      if (line.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_match, uri: string) =>
          `URI="${appendTicket(uri, ticket)}"`,
        );
      }

      return appendTicket(line, ticket);
    })
    .join("");
}

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

  app.get<{
    Params: { path: string; "*": string };
  }>("/hls/:path/*", async (request, reply) => {
    // The dashboard is hosted by Vercel while this media proxy is hosted by
    // Railway. Helmet defaults CORP to same-origin, which blocks native Safari
    // from loading HLS resources even when CORS allows the dashboard origin.
    reply.header("Cross-Origin-Resource-Policy", "cross-origin");

    const requestUrl = new URL(request.raw.url ?? "/", "http://backend.internal");
    const ticket = requestUrl.searchParams.get("ticket");
    const streamPath = request.params.path;
    const resource = request.params["*"];

    if (!ticket || !resource || !verifyStreamTicket(ticket, streamPath)) {
      return reply.code(401).send({ error: "invalid_stream_ticket" });
    }

    requestUrl.searchParams.delete("ticket");

    const upstreamUrl = new URL(
      `/${encodeURIComponent(streamPath)}/${resource}`,
      config.mediaMtxHlsInternalUrl,
    );
    upstreamUrl.search = requestUrl.search;

    try {
      const upstreamHeaders: Record<string, string> = {
          Accept: request.headers.accept ?? "*/*",
          Authorization: `Bearer ${ticket}`,
      };

      if (request.headers.range) {
        upstreamHeaders.Range = request.headers.range;
      }

      const upstream = await fetch(upstreamUrl, {
        headers: upstreamHeaders,
        redirect: "follow",
      });
      const contentType = upstream.headers.get("content-type") ??
        (resource.endsWith(".m3u8")
          ? "application/vnd.apple.mpegurl"
          : "application/octet-stream");

      reply.code(upstream.status);
      reply.header("Content-Type", contentType);
      reply.header("Cache-Control", "no-store");

      for (const header of ["accept-ranges", "content-range"] as const) {
        const value = upstream.headers.get(header);
        if (value) reply.header(header, value);
      }

      if (contentType.includes("mpegurl") || resource.endsWith(".m3u8")) {
        return reply.send(rewriteHlsManifest(await upstream.text(), ticket));
      }

      return reply.send(Buffer.from(await upstream.arrayBuffer()));
    } catch (error) {
      request.log.error({ error, upstreamUrl: upstreamUrl.toString() }, "HLS proxy failed");
      return reply.code(502).send({ error: "stream_upstream_unavailable" });
    }
  });
}
