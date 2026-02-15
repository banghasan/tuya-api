import { getTimezone } from "./config.ts";

function normalizeOffset(offset: string): string | null {
  const trimmed = offset.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(/^GMT|^UTC/, "");
  if (
    normalized === "" ||
    normalized === "0" ||
    normalized === "+0" ||
    normalized === "-0"
  ) {
    return "+00:00";
  }

  const match = normalized.match(/^([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return null;

  const sign = match[1];
  const hours = match[2].padStart(2, "0");
  const minutes = (match[3] ?? "00").padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

export function formatDateTimeTZ(
  date: Date,
): { datetime: string; timezone: string } {
  const preferred = getTimezone();
  const fallback = "Asia/Jakarta";
  let timeZone = preferred;
  let formatter: Intl.DateTimeFormat;

  try {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZoneName: "shortOffset",
    });
  } catch {
    timeZone = fallback;
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZoneName: "shortOffset",
    });
  }

  const parts = formatter.formatToParts(date);
  const lookup = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const year = lookup("year");
  const month = lookup("month");
  const day = lookup("day");
  const hour = lookup("hour");
  const minute = lookup("minute");
  const second = lookup("second");
  const tzName = lookup("timeZoneName");

  const base = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  const offset = normalizeOffset(tzName);
  return { datetime: offset ? `${base}${offset}` : base, timezone: timeZone };
}
