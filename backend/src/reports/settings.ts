import { z } from "zod";

const schema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().min(20),
  REPORT_CLIENT_ID: z.string().uuid().optional(),
  REPORT_CAMERA_CODE: z.string().min(1).default("MBS-KDN-C1"),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(465),
  SMTP_SECURE: z.enum(["true", "false"]).default("true"),
  SMTP_USER: z.string().email(),
  SMTP_PASS: z.string().min(1),
  REPORT_FROM: z.string().min(1).refine(value => !/[\r\n]/.test(value)),
  REPORT_RECIPIENTS: z.string().transform(value => [...new Set(value.split(",").map(email => email.trim().toLowerCase()).filter(Boolean))])
    .pipe(z.array(z.string().email()).min(1).max(20)),
});

export function reportSettings(env: NodeJS.ProcessEnv = process.env) {
  const parsed = schema.safeParse(env);
  if (!parsed.success) throw new Error(`Daily report configuration invalid: ${parsed.error.issues.map(issue => issue.path.join(".")).join(", ")}`);
  return parsed.data;
}
export type ReportSettings = ReturnType<typeof reportSettings>;
