export function malaysiaDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(now);
}

export function previousReportDate(now: Date): string {
  const midnight = new Date(`${malaysiaDate(now)}T00:00:00+08:00`);
  return malaysiaDate(new Date(midnight.getTime() - 1));
}

export function reportPeriod(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Report date must be YYYY-MM-DD");
  const start = new Date(`${date}T00:00:00+08:00`);
  if (!Number.isFinite(start.getTime()) || malaysiaDate(start) !== date) throw new Error("Invalid report date");
  return { date, start: start.toISOString(), end: new Date(start.getTime() + 86_400_000).toISOString() };
}

export function dailyReportDue(now: Date): boolean {
  const hour = Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", hourCycle: "h23",
  }).format(now));
  return hour >= 7;
}
