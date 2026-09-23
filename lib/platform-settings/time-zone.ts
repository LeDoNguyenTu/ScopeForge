const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function wallClockEpoch(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
}

export function zonedLocalDateTimeToIso(value: string, timeZone: string): string | null {
  if (!isValidTimeZone(timeZone)) return null;
  const match = LOCAL_DATE_TIME.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second = "00"] = match;
  const target = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second);
  let instant = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    instant += target - wallClockEpoch(new Date(instant), timeZone);
  }
  if (wallClockEpoch(new Date(instant), timeZone) !== target) return null;
  return new Date(instant).toISOString();
}
