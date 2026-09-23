import { z } from "zod";

const ConfigSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_ORIGIN: z.string().url().default("http://localhost:3000"),
  AI_SERVICE_SECRET: z.string().min(16),
  DASHBOARD_WS_SECRET: z.string().min(16),
});

const parsedConfig = ConfigSchema.safeParse(process.env);

if (!parsedConfig.success) {
  throw new Error(
    `Invalid backend configuration: ${JSON.stringify(parsedConfig.error.flatten().fieldErrors)}`,
  );
}

export const config = {
  port: parsedConfig.data.PORT,
  frontendOrigin: parsedConfig.data.FRONTEND_ORIGIN,
  aiServiceSecret: parsedConfig.data.AI_SERVICE_SECRET,
  dashboardWebSocketSecret: parsedConfig.data.DASHBOARD_WS_SECRET,
};
