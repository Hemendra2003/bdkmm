// Every conversion takes an instant/calendar key and an explicit IANA timezone.
// The caller owns the clock and the choice of device/profile timezone.
function formatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    calendar: 'gregory',
    numberingSystem: 'latn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
}
function parts(date: Date, timeZone: string): Record<string, string> {
  return Object.fromEntries(
    formatter(timeZone)
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
}
export function localDateKey(date: Date, timeZone: string): string {
  // Preserve the legacy invalid-date behavior used by demo input validation.
  if (!Number.isFinite(date.getTime())) return '0NaN-NaN-NaN';
  const value = parts(date, timeZone);
  return `${value.year.padStart(4, '0')}-${value.month}-${value.day}`;
}
function utcCalendar(
  year: number,
  month: number,
  day: number,
  hour = 12,
  minute = 0,
  second = 0,
): Date {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  return date;
}
export function calendarDate(key: string, timeZone: string): Date {
  const desired = new Date(key + 'T12:00:00Z');
  if (!Number.isFinite(desired.getTime())) return desired;
  let instant = desired.getTime();
  // Translate local noon to an instant using the zone's actual offset, including
  // DST. Noon avoids the usual missing/duplicated midnight transition hours.
  for (let attempt = 0; attempt < 3; attempt++) {
    const value = parts(new Date(instant), timeZone);
    const wall = utcCalendar(
      Number(value.year),
      Number(value.month),
      Number(value.day),
      Number(value.hour),
      Number(value.minute),
      Number(value.second),
    ).getTime();
    const correction = desired.getTime() - wall;
    instant += correction;
    if (correction === 0) break;
  }
  return new Date(instant);
}
export function dateKeyOffset(date: Date, days: number, timeZone: string): string {
  const value = parts(date, timeZone);
  const shifted = utcCalendar(Number(value.year), Number(value.month), Number(value.day) + days);
  return `${String(shifted.getUTCFullYear()).padStart(4, '0')}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}
