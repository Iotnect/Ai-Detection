import PDFDocument from "pdfkit";
import { fileURLToPath } from "node:url";
import type { ReportReading } from "./data.js";
import { formatDuration, type CameraConnectivity } from "./connectivity.js";

const logo = fileURLToPath(new URL("../../assets/mbs-logo.png", import.meta.url));
const time = (value: string) => new Date(value).toLocaleString("en-MY", {
  timeZone: "Asia/Kuala_Lumpur", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true,
});

export async function createDailyReport(date: string, readings: ReportReading[], connectivity: CameraConnectivity[] = []): Promise<Buffer> {
  const alerts = readings.filter(row => ["RISING", "DANGER"].includes(row.status.toUpperCase()));
  const hours = new Set(readings.map(row => new Date(row.occurred_at).toLocaleString("en-GB", {
    timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", hourCycle: "h23",
  })));
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true,
    info: { Title: `MBS Daily CCTV Alert Report - ${date}`, Author: "NeoVision" } });
  const chunks: Buffer[] = [];
  const output = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", chunk => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  doc.image(logo, doc.page.width / 2 - 28, 26, { fit: [56, 56], align: "center" });
  doc.y = 92;
  doc.font("Helvetica-Bold").fontSize(14).fillColor("#0f172a").text("MAJLIS BANDARAYA SEREMBAN", { align: "center" });
  doc.moveDown(0.5).fontSize(18).fillColor("#2563eb").text("DAILY CCTV ALERT REPORT", { align: "center" });
  doc.moveDown(0.5).font("Helvetica").fontSize(10).fillColor("#475569")
    .text(`${date} | 00:00 - 23:59 Malaysia time (UTC+08:00)`, { align: "center" });
  doc.moveDown(1.5).fontSize(10).text(`Generated: ${time(new Date().toISOString())} (MYT)`);
  doc.moveDown(0.8).font("Helvetica-Bold").fillColor("#0f172a").text("MONITORING SUMMARY");
  doc.moveDown(0.6).font("Helvetica").fillColor("#475569").text(
    `Stored readings: ${readings.length}    Rising: ${alerts.filter(r => r.status.toUpperCase() === "RISING").length}    Danger: ${alerts.filter(r => r.status.toUpperCase() === "DANGER").length}`,
  );
  doc.moveDown(0.5).text(`Hours containing readings across monitored cameras: ${hours.size}/24`);
  if (readings.length) doc.moveDown(0.5).text(`First reading: ${time(readings[0]!.occurred_at)} | Last reading: ${time(readings.at(-1)!.occurred_at)} (MYT)`);
  doc.moveDown(0.8).fillColor(readings.length ? "#475569" : "#b45309").text(readings.length
    ? "This report lists RISING and DANGER events from stored inference readings. Gaps in recordings do not confirm safe conditions or continuous monitoring."
    : "NO INFERENCE DATA RECEIVED for this reporting day. Water conditions and monitoring availability cannot be confirmed. This is not an all-clear report.");
  let widths = [84, 78, 55, 40, 258];
  let headings = ["Date / time (MYT)", "Camera", "Status", "Water Y", "Location / Message"];
  const row = (values: string[], header = false, status = "") => {
    const cellHeight = Math.max(...values.map((text, i) => doc.font(header ? "Helvetica-Bold" : "Helvetica").fontSize(8).heightOfString(text, { width: widths[i]! - 12 }))) + 14;
    if (doc.y + cellHeight > doc.page.height - 65) {
      doc.addPage();
      doc.y = 40;
      if (!header) row(headings, true);
    }
    const y = doc.y;
    let x = 40;
    values.forEach((value, i) => {
      const width = widths[i]!;
      doc.rect(x, y, width, cellHeight).fillAndStroke(header ? "#2563eb" : "#f8fafc", "#e2e8f0");
      doc.font(header ? "Helvetica-Bold" : "Helvetica").fontSize(8)
        .fillColor(header ? "#ffffff" : i === 2 && status === "DANGER" ? "#dc2626" : i === 2 && status === "RISING" ? "#b45309" : "#334155")
        .text(value, x + 6, y + 7, { width: width - 12 });
      x += width;
    });
    doc.y = y + cellHeight;
    doc.x = 40;
  };
  const section = (title: string) => {
    if (doc.y > doc.page.height - 170) doc.addPage();
    doc.moveDown(1).font("Helvetica-Bold").fontSize(10).fillColor("#0f172a").text(title);
    doc.moveDown(0.7);
  };
  section("CAMERA CONNECTIVITY AND DOWNTIME");
  widths = [120, 68, 110, 110, 107];
  headings = ["Camera / location", "Day-end status", "Offline observed (MYT)", "Online again (MYT)", "Downtime in this day"];
  row(headings, true);
  for (const item of connectivity) {
    const camera = `${item.camera.name || item.camera.code}\n${item.camera.location ?? ""}`;
    if (!item.outages.length) {
      const duration = item.unverifiedMs === 86_400_000 ? "Unverified" : formatDuration(0);
      row([camera, item.endStatus.toUpperCase(), "-", "-", item.unverifiedMs > 0
        ? `${duration}\nUnverified: ${formatDuration(item.unverifiedMs)}` : duration]);
    }
    for (const outage of item.outages) {
      row([camera, item.endStatus.toUpperCase(), time(outage.offlineAt),
        outage.onlineAt ? time(outage.onlineAt) : outage.interrupted ? "Unverified after last check" : "Still offline at day end",
        formatDuration(outage.durationMs)]);
    }
    if (item.outages.length > 1) row([item.camera.name || item.camera.code, "TOTAL", "-", "-", formatDuration(item.downtimeMs)]);
    if (item.outages.length && item.unverifiedMs > 0) row([item.camera.name || item.camera.code, "UNVERIFIED", "No verified status for", formatDuration(item.unverifiedMs), "Excluded from downtime"]);
  }
  if (!connectivity.length) row(["No cameras available", "UNVERIFIED", "-", "-", "-"]);
  const note = connectivity.find(item => item.reportNote)?.reportNote ?? "Times show when DSS status was observed. Downtime is accumulated within this reporting day and retained after recovery. Coverage becomes unverified after three polling intervals without a successful check. Historical downtime before tracking began is unavailable.";
  doc.font("Helvetica").fontSize(8);
  if (doc.y + doc.heightOfString(note, { width: 515 }) + 12 > doc.page.height - 65) doc.addPage();
  doc.moveDown(0.7).fillColor("#64748b").text(note);
  section("RISING AND DANGER EVENTS");
  widths = [84, 78, 55, 40, 258];
  headings = ["Date / time (MYT)", "Camera", "Status", "Water Y", "Location / Message"];
  row(headings, true);
  if (!alerts.length) row(["-", "-", readings.length ? "NO ALERTS" : "NO DATA", "-", readings.length
    ? "No RISING or DANGER events recorded in the available readings."
    : "No inference readings were available for this day."]);
  for (const alert of alerts) row([time(alert.occurred_at), alert.cameras.code, alert.status.toUpperCase(), String(alert.smoothed_y),
    `${alert.cameras.location ?? "Location not set"}\n${alert.message}`], false, alert.status.toUpperCase());
  doc.moveDown(0.7).font("Helvetica").fontSize(8).fillColor("#64748b").text("Water Y values are camera pixel coordinates, not calibrated physical water depth.");
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(7).fillColor("#64748b").text(`MBS AI Flood Detection | ${date} | Page ${i + 1} of ${range.count}`, 40, doc.page.height - 55,
      { width: 515, align: "center", lineBreak: false });
  }
  doc.end();
  return output;
}
