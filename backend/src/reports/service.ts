import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import type { AppLogger } from "../logging.js";
import { reportClient, reportReadings } from "./data.js";
import { createDailyReport } from "./pdf.js";
import { reportConnectivity } from "./connectivity.js";
import { reportSettings } from "./settings.js";
import { dailyReportDue, previousReportDate, reportPeriod } from "./period.js";

export function safeToRetry(error: unknown): boolean {
  const failure = error as { command?: string; responseCode?: number };
  return Boolean(failure?.responseCode && failure.responseCode >= 400) ||
    /^(CONN|AUTH|MAIL FROM|RCPT TO)/.test(failure?.command ?? "");
}

export async function runDailyReport(date: string, logger: AppLogger, send = false) {
  reportPeriod(date);
  const settings = reportSettings();
  const db = createClient(settings.SUPABASE_URL, settings.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(30_000) }) },
  });
  const clientId = await reportClient(db, settings.REPORT_CAMERA_CODE, settings.REPORT_CLIENT_ID);
  const readings = await reportReadings(db, clientId, date);
  const connectivity = await reportConnectivity(db, clientId, date);
  const pdf = await createDailyReport(date, readings, connectivity);
  const fileName = `mbs-daily-report-${date}.pdf`;
  if (!send) return { pdf, fileName, retryNeeded: false, failedCount: 0 };
  let retryNeeded = false;
  let failedCount = 0;

  const transport = nodemailer.createTransport({
    host: settings.SMTP_HOST, port: settings.SMTP_PORT, secure: settings.SMTP_SECURE === "true",
    requireTLS: settings.SMTP_SECURE !== "true",
    auth: { user: settings.SMTP_USER, pass: settings.SMTP_PASS },
    connectionTimeout: 30_000, greetingTimeout: 15_000, socketTimeout: 60_000,
    disableFileAccess: true, disableUrlAccess: true,
  });
  try {
    // Verify before claiming so bad credentials or network failures cannot consume a delivery.
    await transport.verify();
    for (const recipient of settings.REPORT_RECIPIENTS) {
      const owner = randomUUID();
      const { data: claimed, error } = await db.rpc("claim_daily_report", {
        p_client_id: clientId, p_report_date: date, p_recipient: recipient, p_owner: owner,
      });
      if (error) throw new Error("Daily report ledger unavailable; apply the report migration before sending");
      if (!claimed) {
        const { data: delivery, error: deliveryError } = await db.from("daily_report_deliveries")
          .select("status,attempts").eq("client_id", clientId).eq("report_date", date).eq("recipient", recipient).single();
        if (deliveryError) throw new Error("Unable to inspect daily report delivery");
        if (delivery.status === "failed" && delivery.attempts < 3) retryNeeded = true;
        logger.info({ date, recipient }, "Daily report already sent, pending review or retry limit reached");
        continue;
      }
      let accepted = false;
      try {
        const info = await transport.sendMail({
          from: settings.REPORT_FROM, to: recipient,
          subject: `MBS Daily CCTV Alert Report - ${date}`,
          text: `Attached is the MBS report for ${date}, 00:00-23:59 Malaysia time.\n\nStored inference readings: ${readings.length}.\nThe PDF includes camera connectivity, observed offline/recovery times and downtime.\n${readings.length ? "RISING and DANGER events and data coverage information are included." : "No inference data was received. Water conditions cannot be confirmed."}`,
          attachments: [{ filename: fileName, content: pdf, contentType: "application/pdf" }],
        });
        accepted = info.accepted.length > 0;
        if (!accepted) throw Object.assign(new Error("SMTP rejected recipient"), { responseCode: 550 });
        const { error: saved, data: updated } = await db.from("daily_report_deliveries").update({
          status: "sent", message_id: info.messageId, sent_at: new Date().toISOString(),
        }).eq("owner", owner).eq("status", "sending").select("owner");
        if (saved || updated?.length !== 1) throw new Error("SMTP accepted report but delivery receipt could not be saved");
        logger.info({ date, recipient, messageId: info.messageId }, "Daily report accepted by SMTP server");
      } catch (error) {
        failedCount++;
        const status = !accepted && safeToRetry(error) ? "failed" : "unknown";
        if (status === "failed") retryNeeded = true;
        const { error: ledgerError } = await db.from("daily_report_deliveries").update({ status })
          .eq("owner", owner).eq("status", "sending");
        logger.error({ date, recipient, status, ledgerSaved: !ledgerError,
          code: (error as { code?: string }).code, command: (error as { command?: string }).command }, "Daily report delivery failed; unknown delivery requires manual review");
      }
    }
  } finally { transport.close(); }
  return { pdf, fileName, retryNeeded, failedCount };
}

export function startDailyReports(logger: AppLogger): () => Promise<void> {
  if (process.env.REPORT_ENABLED !== "true") {
    logger.info({}, "Daily reports disabled; set REPORT_ENABLED=true after testing");
    return async () => {};
  }
  reportSettings();
  let stopped = false;
  let running: Promise<unknown> | undefined;
  let completedDate: string | undefined;
  let lastAttempt = 0;
  const tick = () => {
    if (stopped || running || !dailyReportDue(new Date())) return;
    const date = previousReportDate(new Date());
    if (completedDate === date || Date.now() - lastAttempt < 10 * 60_000) return;
    lastAttempt = Date.now();
    running = runDailyReport(date, logger, true)
      .then(result => { if (!result.retryNeeded) completedDate = date; })
      .catch(error => logger.error({ error: error instanceof Error ? error.message : "Unknown failure" }, "Daily report job failed; retry on next scheduled check"))
      .finally(() => { running = undefined; });
  };
  const timer = setInterval(tick, 60_000);
  timer.unref();
  tick();
  logger.info({ timezone: "Asia/Kuala_Lumpur", schedule: "07:00 daily, 10-minute retry checks" }, "Daily reports enabled");
  return async () => { stopped = true; clearInterval(timer); await running; };
}
