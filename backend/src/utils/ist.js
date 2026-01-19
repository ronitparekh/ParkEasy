const IST_OFFSET_MINUTES = 330; // Asia/Kolkata is UTC+05:30 (no DST)
export const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60 * 1000;

export function getIstDateParts(date = new Date()) {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    ms: shifted.getUTCMilliseconds(),
  };
}

export function makeUtcDateFromIstParts({
  year,
  month,
  day,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0,
}) {
  const utcMs = Date.UTC(year, month - 1, day, hour, minute, second, ms) - IST_OFFSET_MS;
  return new Date(utcMs);
}

export function getTodayIstRange(now = new Date()) {
  const { year, month, day } = getIstDateParts(now);
  const start = makeUtcDateFromIstParts({ year, month, day, hour: 0, minute: 0, second: 0, ms: 0 });
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end, now };
}

export function getBookingStartEndIst(booking) {
  const base = booking.bookingDate ? new Date(booking.bookingDate) : new Date(booking.createdAt);
  const { year, month, day } = getIstDateParts(base);

  const [startHRaw, startMRaw] = String(booking.startTime || "").split(":");
  const [endHRaw, endMRaw] = String(booking.endTime || "").split(":");
  const startH = Number(startHRaw);
  const startM = Number(startMRaw);
  const endH = Number(endHRaw);
  const endM = Number(endMRaw);

  if (
    Number.isNaN(startH) ||
    Number.isNaN(startM) ||
    Number.isNaN(endH) ||
    Number.isNaN(endM)
  ) {
    return { start: null, end: null };
  }

  const start = makeUtcDateFromIstParts({ year, month, day, hour: startH, minute: startM, second: 0, ms: 0 });
  const end = makeUtcDateFromIstParts({ year, month, day, hour: endH, minute: endM, second: 0, ms: 0 });
  return { start, end };
}

export function formatIstDateYmd(date = new Date()) {
  const { year, month, day } = getIstDateParts(date);
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export function parseYmd(dateStr) {
  const m = /^\s*(\d{4})-(\d{2})-(\d{2})\s*$/.exec(String(dateStr ?? ""));
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if ([year, month, day].some((n) => Number.isNaN(n))) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  return { year, month, day };
}

