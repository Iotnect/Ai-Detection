import type { LiveDetection } from "@/hooks/useDetectionStream";

const MALAYSIA_TIME_ZONE = "Asia/Kuala_Lumpur";

export interface FloodReportOptions {
  fromDate: string;
  toDate: string;
  events: LiveDetection[];
}

interface CameraSummary {
  cameraId: string;
  location: string;
  total: number;
  rising: number;
  danger: number;
  minimumY: number;
  maximumY: number;
}

function reportDate(value: string | Date): string {
  return new Intl.DateTimeFormat("en-MY", {
    timeZone: MALAYSIA_TIME_ZONE,
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(typeof value === "string" ? new Date(value) : value).toUpperCase();
}

function reportDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat("en-MY", {
    timeZone: MALAYSIA_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(typeof value === "string" ? new Date(value) : value);
}

async function loadMbsLogo(): Promise<string> {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const response = await fetch(`${basePath}/Majlis_Bandaraya_Seremban.svg`);
  if (!response.ok) throw new Error("Unable to load the MBS logo.");

  const svg = await response.blob();
  const source = URL.createObjectURL(svg);

  try {
    const image = new Image();
    image.src = source;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 320;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Unable to prepare the MBS logo.");

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(source);
  }
}

function summarizeByCamera(events: LiveDetection[]): CameraSummary[] {
  const summaries = new Map<string, CameraSummary>();

  for (const event of events) {
    const summary = summaries.get(event.camera_id) ?? {
      cameraId: event.camera_id,
      location: event.camera_location || "-",
      total: 0,
      rising: 0,
      danger: 0,
      minimumY: event.smoothed_y,
      maximumY: event.smoothed_y,
    };
    const status = event.status.toUpperCase();

    summary.total += 1;
    if (status === "RISING") summary.rising += 1;
    if (status === "DANGER") summary.danger += 1;
    summary.minimumY = Math.min(summary.minimumY, event.smoothed_y);
    summary.maximumY = Math.max(summary.maximumY, event.smoothed_y);
    summaries.set(event.camera_id, summary);
  }

  return Array.from(summaries.values()).sort((left, right) =>
    left.cameraId.localeCompare(right.cameraId),
  );
}

export async function createFloodAlertReportPdf({
  fromDate,
  toDate,
  events,
}: FloodReportOptions, logo: string): Promise<{ bytes: ArrayBuffer; fileName: string }> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const risingCount = events.filter(
    (event) => event.status.toUpperCase() === "RISING",
  ).length;
  const dangerCount = events.filter(
    (event) => event.status.toUpperCase() === "DANGER",
  ).length;
  const summaries = summarizeByCamera(events);
  const periodStart = new Date(`${fromDate}T00:00:00+08:00`);
  const periodEnd = new Date(`${toDate}T23:59:59.999+08:00`);
  const generatedAt = new Date();

  pdf.addImage(logo, "PNG", pageWidth / 2 - 12, 10, 24, 24, "MBS_LOGO", "FAST");
  pdf.setTextColor(15, 23, 42);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("Majlis Bandaraya Seremban", pageWidth / 2, 39, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(100, 116, 139);
  pdf.setFontSize(9);
  pdf.text("AI FLOOD DETECTION SYSTEM", pageWidth / 2, 44, { align: "center" });

  pdf.setDrawColor(37, 99, 235);
  pdf.setLineWidth(0.8);
  pdf.line(14, 49, pageWidth - 14, 49);
  pdf.setTextColor(37, 99, 235);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(17);
  pdf.text("FLOOD DETECTION ALERT REPORT", pageWidth / 2, 59, {
    align: "center",
  });
  pdf.setTextColor(245, 158, 11);
  pdf.setFontSize(10);
  pdf.text("RISING AND DANGER EVENTS", pageWidth / 2, 65, { align: "center" });

  const details = [
    ["REPORTING AUTHORITY", "MAJLIS BANDARAYA SEREMBAN"],
    ["MONITORING PERIOD", `${reportDateTime(periodStart)} - ${reportDateTime(periodEnd)}`],
    ["REPORT DATE", reportDate(generatedAt)],
    ["GENERATED AT", reportDateTime(generatedAt)],
  ];
  let detailY = 76;
  pdf.setFontSize(8.5);
  for (const [label, value] of details) {
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(71, 85, 105);
    pdf.text(label, 14, detailY);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(15, 23, 42);
    pdf.text(":", 55, detailY);
    pdf.text(value, 60, detailY);
    detailY += 5;
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(100, 116, 139);
  pdf.text("OVERVIEW", 14, 100);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(51, 65, 85);
  const overview = events.length
    ? `This report summarises ${events.length} water-level alert events classified as RISING or DANGER during the selected monitoring period. Normal events are excluded.`
    : "No RISING or DANGER water-level events were recorded during the selected monitoring period. Normal events are excluded.";
  pdf.text(pdf.splitTextToSize(overview, pageWidth - 28), 14, 106);

  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(14, 116, pageWidth - 28, 29, 2, 2, "FD");
  const cards = [
    ["TOTAL ALERTS", String(events.length)],
    ["RISING", String(risingCount)],
    ["DANGER", String(dangerCount)],
    ["CAMERAS AFFECTED", String(summaries.length)],
  ];
  const cardWidth = (pageWidth - 28) / cards.length;
  cards.forEach(([label, value], index) => {
    const centerX = 14 + cardWidth * index + cardWidth / 2;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text(label, centerX, 127, { align: "center" });
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(15);
    pdf.setTextColor(index === 2 ? 220 : 15, index === 2 ? 38 : 23, index === 2 ? 38 : 42);
    pdf.text(value, centerX, 137, { align: "center" });
  });

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(100, 116, 139);
  pdf.text("SUMMARY BY CAMERA", 14, 155);
  autoTable(pdf, {
    startY: 159,
    margin: { left: 14, right: 14, bottom: 22 },
    head: [["Camera", "Location", "Total", "Rising", "Danger", "Min Y", "Max Y"]],
    body: summaries.length
      ? summaries.map((summary) => [
          summary.cameraId,
          summary.location,
          String(summary.total),
          String(summary.rising),
          String(summary.danger),
          String(summary.minimumY),
          String(summary.maximumY),
        ])
      : [["-", "No alert events", "0", "0", "0", "-", "-"]],
    theme: "grid",
    styles: { fontSize: 7.5, cellPadding: 2, textColor: [51, 65, 85] },
    headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105] },
  });

  const pdfWithTable = pdf as typeof pdf & { lastAutoTable?: { finalY: number } };
  let listY = (pdfWithTable.lastAutoTable?.finalY ?? 159) + 11;
  if (listY > 248) {
    pdf.addPage();
    listY = 20;
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(100, 116, 139);
  pdf.text("LIST OF RISING AND DANGER EVENTS", 14, listY);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(71, 85, 105);
  pdf.text("The following alerts were recorded during the selected monitoring period:", 14, listY + 5);

  autoTable(pdf, {
    startY: listY + 9,
    margin: { left: 10, right: 10, bottom: 22 },
    head: [["No.", "Date & Time", "Camera", "Location", "Status", "Water Y", "Confidence", "Message"]],
    body: events.length
      ? events.map((event, index) => [
          String(index + 1),
          reportDateTime(event.timestamp),
          event.camera_id,
          event.camera_location || "-",
          event.status.toUpperCase(),
          String(event.smoothed_y),
          event.confidence == null ? "-" : `${Math.round(event.confidence * 100)}%`,
          event.message,
        ])
      : [["-", "-", "-", "-", "NO ALERTS", "-", "-", "No rising or danger events recorded"]],
    theme: "grid",
    styles: { fontSize: 6.5, cellPadding: 1.6, textColor: [51, 65, 85] },
    headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 27 },
      2: { cellWidth: 20 },
      3: { cellWidth: 29 },
      4: { cellWidth: 16, halign: "center" },
      5: { cellWidth: 15, halign: "center" },
      6: { cellWidth: 17, halign: "center" },
    },
    didParseCell: (cell) => {
      if (cell.section !== "body" || cell.column.index !== 4) return;
      const status = String(cell.cell.raw).toUpperCase();
      if (status === "DANGER") cell.cell.styles.textColor = [220, 38, 38];
      if (status === "RISING") cell.cell.styles.textColor = [217, 119, 6];
      cell.cell.styles.fontStyle = "bold";
    },
  });

  const pageCount = pdf.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    pdf.setPage(pageNumber);
    const pageHeight = pdf.internal.pageSize.getHeight();
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.2);
    pdf.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15);
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(6.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text(
      "Generated by the MBS AI Flood Detection System. Status reflects system records at the time of generation.",
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" },
    );
    pdf.setFont("helvetica", "normal");
    pdf.text(`Page ${pageNumber} of ${pageCount}`, pageWidth - 14, pageHeight - 6, {
      align: "right",
    });
  }

  return {
    bytes: pdf.output("arraybuffer"),
    fileName: `mbs-flood-alert-report-${fromDate}-to-${toDate}.pdf`,
  };
}

export async function exportFloodAlertReport(
  options: FloodReportOptions,
): Promise<void> {
  const logo = await loadMbsLogo();
  const { bytes, fileName } = await createFloodAlertReportPdf(options, logo);
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
