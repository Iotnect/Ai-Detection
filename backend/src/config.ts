import { z } from "zod";

const ConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_ORIGINS: z.string().default("http://localhost:3000"),
  AI_SERVICE_SECRET: z.string().min(16),
  DASHBOARD_WS_SECRET: z.string().min(16),
  DETECTION_PERSIST_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60_000),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SECRET_KEY: z.string().min(20).optional(),
  DSS_BASE_URL: z.string().url().optional(),
  DSS_USERNAME: z.string().min(1).optional(),
  DSS_PASSWORD: z.string().min(1).optional(),
  DSS_CHANNEL_ID: z.string().min(1).optional(),
  DSS_CLIENT_MAC: z.string().min(1).optional(),
  DSS_LOGIN_TYPE: z.enum(["1", "2"]).default("2"),
  DSS_TLS_REJECT_UNAUTHORIZED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  DSS_KEEPALIVE_INTERVAL_MS: z.coerce.number().int().positive().default(20_000),
  DSS_TOKEN_REFRESH_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(1_200_000),
  MEDIAMTX_PUBLISH_URL: z.string().url().optional(),
  MEDIAMTX_HLS_INTERNAL_URL: z
    .string()
    .url()
    .default("http://mediamtx.railway.internal:8888"),
  MEDIAMTX_PUBLISH_USER: z.string().min(1).optional(),
  MEDIAMTX_PUBLISH_PASSWORD: z.string().min(16).optional(),
  MEDIAMTX_AI_USER: z.string().min(1).optional(),
  MEDIAMTX_AI_PASSWORD: z.string().min(16).optional(),
  FFMPEG_PATH: z.string().min(1).default("ffmpeg"),
  STREAM_TRANSCODE_H264: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

const parsedConfig = ConfigSchema.safeParse(process.env);

if (!parsedConfig.success) {
  throw new Error(
    `Invalid backend configuration: ${JSON.stringify(parsedConfig.error.flatten().fieldErrors)}`,
  );
}

const values = parsedConfig.data;

function optionalGroup<T extends Record<string, string | undefined>>(
  name: string,
  group: T,
): { [K in keyof T]: string } | undefined {
  const entries = Object.entries(group);
  const present = entries.filter(([, value]) => value !== undefined);

  if (present.length === 0) {
    return undefined;
  }

  if (present.length !== entries.length) {
    const missing = entries
      .filter(([, value]) => value === undefined)
      .map(([key]) => key);
    throw new Error(`${name} configuration is incomplete: ${missing.join(", ")}`);
  }

  return group as { [K in keyof T]: string };
}

const supabase = optionalGroup("Supabase", {
  url: values.SUPABASE_URL,
  secretKey: values.SUPABASE_SECRET_KEY,
});

const dss = optionalGroup("DSS", {
  baseUrl: values.DSS_BASE_URL,
  username: values.DSS_USERNAME,
  password: values.DSS_PASSWORD,
  channelId: values.DSS_CHANNEL_ID,
  clientMac: values.DSS_CLIENT_MAC,
});

const mediaMtxAuth = optionalGroup("MediaMTX authentication", {
  publishUser: values.MEDIAMTX_PUBLISH_USER,
  publishPassword: values.MEDIAMTX_PUBLISH_PASSWORD,
  aiUser: values.MEDIAMTX_AI_USER,
  aiPassword: values.MEDIAMTX_AI_PASSWORD,
});

if (values.NODE_ENV === "production" && !supabase) {
  throw new Error("Supabase configuration is required in production");
}

if (
  values.NODE_ENV === "production" &&
  values.MEDIAMTX_PUBLISH_URL &&
  !mediaMtxAuth
) {
  throw new Error("MediaMTX authentication is required when streaming in production");
}

export const config = {
  nodeEnv: values.NODE_ENV,
  port: parsedConfig.data.PORT,
  frontendOrigins: values.FRONTEND_ORIGINS.split(",").map((value) => value.trim()),
  aiServiceSecret: values.AI_SERVICE_SECRET,
  dashboardWebSocketSecret: values.DASHBOARD_WS_SECRET,
  detectionPersistIntervalMs: values.DETECTION_PERSIST_INTERVAL_MS,
  supabase,
  dss: dss
    ? {
        ...dss,
        loginType: values.DSS_LOGIN_TYPE,
        tlsRejectUnauthorized: values.DSS_TLS_REJECT_UNAUTHORIZED,
        keepAliveIntervalMs: values.DSS_KEEPALIVE_INTERVAL_MS,
        tokenRefreshIntervalMs: values.DSS_TOKEN_REFRESH_INTERVAL_MS,
      }
    : undefined,
  mediaMtxPublishUrl: values.MEDIAMTX_PUBLISH_URL,
  mediaMtxHlsInternalUrl: values.MEDIAMTX_HLS_INTERNAL_URL,
  mediaMtxAuth,
  ffmpegPath: values.FFMPEG_PATH,
  streamTranscodeH264: values.STREAM_TRANSCODE_H264,
};
