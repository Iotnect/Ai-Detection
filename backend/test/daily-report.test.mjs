import test from "node:test";
import assert from "node:assert/strict";
import { reportPeriod, previousReportDate, dailyReportDue } from "../dist/reports/period.js";
import { reportSettings } from "../dist/reports/settings.js";
import { reportClient, reportReadings } from "../dist/reports/data.js";
import { safeToRetry, startDailyReports } from "../dist/reports/service.js";

test("report dates follow Malaysia midnight, month/year boundaries and leap days", () => {
  assert.equal(previousReportDate(new Date("2026-11-09T23:00:00Z")), "2026-11-09");
  assert.equal(previousReportDate(new Date("2027-01-01T00:00:00+08:00")), "2026-12-31");
  assert.equal(previousReportDate(new Date("2028-03-01T07:00:00+08:00")), "2028-02-29");
  assert.deepEqual(reportPeriod("2026-11-09"), { date: "2026-11-09", start: "2026-11-08T16:00:00.000Z", end: "2026-11-09T16:00:00.000Z" });
  assert.throws(() => reportPeriod("2026-02-30"));
  assert.equal(dailyReportDue(new Date("2026-11-10T06:59:59+08:00")), false);
  assert.equal(dailyReportDue(new Date("2026-11-10T07:00:00+08:00")), true);
});
test("SMTP config deduplicates recipients and never includes secret values in errors", () => {
  const settings = { SUPABASE_URL: "https://example.supabase.co", SUPABASE_SECRET_KEY: "a".repeat(25),
    SMTP_HOST: "mail.example.com", SMTP_USER: "reports@example.com", SMTP_PASS: "sensitive-password",
    REPORT_FROM: "NeoVision <reports@example.com>", REPORT_RECIPIENTS: "test@example.com, TEST@example.com" };
  assert.deepEqual(reportSettings(settings).REPORT_RECIPIENTS, ["test@example.com"]);
  assert.throws(() => reportSettings({ ...settings, SMTP_PORT: "wrong" }), error => !error.message.includes("sensitive-password"));
});
test("daily history is scoped by client and half-open local day, and paginated without truncation", async () => {
  const calls = [];
  let page = 0;
  const row = { occurred_at: "2026-11-09T01:00:00Z", status: "NORMAL", smoothed_y: 331, message: "Stable", cameras: { code: "MBS-KDN-C1", location: "River" } };
  const db = { from(table) { calls.push(["table", table]); const q = {};
    for (const method of ["select", "eq", "gte", "lt", "order"]) q[method] = (...args) => { calls.push([method, ...args]); return q; };
    q.range = async (start, end) => { calls.push(["range", start, end]); return { data: page++ === 0 ? Array(1000).fill(row) : [row], error: null }; }; return q; } };
  const data = await reportReadings(db, "client-1", "2026-11-09");
  assert.equal(data.length, 1001);
  for (const expected of [["eq", "client_id", "client-1"], ["gte", "occurred_at", "2026-11-08T16:00:00.000Z"], ["lt", "occurred_at", "2026-11-09T16:00:00.000Z"], ["range", 1000, 1999]]) {
    assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(expected)));
  }
});
test("ambiguous client mappings and query failures stop report creation", async () => {
  const q = { select: () => q, eq: () => q, limit: async () => ({ data: [{ client_id: "a" }, { client_id: "b" }] }) };
  await assert.rejects(reportClient({ from: () => q }, "MBS-KDN-C1"), /one client/);
});
test("only unambiguous SMTP rejection or pre-DATA errors are automatically retried", () => {
  assert.equal(safeToRetry({ command: "CONN" }), true);
  assert.equal(safeToRetry({ responseCode: 451, command: "DATA" }), true);
  assert.equal(safeToRetry({ command: "DATA", code: "ETIMEDOUT" }), false);
  assert.equal(safeToRetry(new Error("receipt write failed")), false);
});
test("daily scheduler is disabled by default and does not send email", async () => {
  const original = process.env.REPORT_ENABLED;
  delete process.env.REPORT_ENABLED;
  const messages = [];
  const stop = startDailyReports({ info: (_, message) => messages.push(message), warn() {}, error() {} });
  await stop();
  assert.match(messages[0], /disabled/);
  if (original !== undefined) process.env.REPORT_ENABLED = original;
});
