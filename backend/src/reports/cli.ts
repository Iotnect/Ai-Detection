import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { runDailyReport } from "./service.js";
import { previousReportDate } from "./period.js";

const date = process.argv.find(value => value.startsWith("--date="))?.slice(7) ?? previousReportDate(new Date());
const send = process.argv.includes("--send");
const logger = {
  info: (context: object, message: string) => console.log(JSON.stringify({ ...context, message })),
  warn: (context: object, message: string) => console.warn(JSON.stringify({ ...context, message })),
  error: (context: object, message: string) => console.error(JSON.stringify({ ...context, message })),
};
try {
  const result = await runDailyReport(date, logger, send);
  if (result.failedCount) process.exitCode = 1;
  if (!send) {
    await writeFile(result.fileName, result.pdf);
    console.log(`Preview saved: ${result.fileName}. No email sent. Use --send to send to REPORT_RECIPIENTS.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Daily report failed");
  process.exitCode = 1;
}
