// Calendar arithmetic in a named time zone, as Foundation's Calendar does it on the device: the
// planner works in the city's local days, noons and evenings, whatever the browser's own zone.

const formatters = new Map()

function formatter (timeZone) {
  let format = formatters.get(timeZone)
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric'
    })
    formatters.set(timeZone, format)
  }
  return format
}

/** The wall-clock fields of `date` in `timeZone`. */
export function parts (date, timeZone) {
  const fields = {}
  for (const { type, value } of formatter(timeZone).formatToParts(date)) fields[type] = Number(value)
  return { year: fields.year, month: fields.month, day: fields.day, hour: fields.hour, minute: fields.minute, second: fields.second }
}

function offset (time, timeZone) {
  const p = parts(new Date(time), timeZone)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(time / 1000) * 1000
}

/** The instant a wall-clock time falls on in `timeZone`; out-of-range fields roll over. */
export function zoned (year, month, day, hour = 0, minute = 0, second = 0, timeZone) {
  const wall = Date.UTC(year, month - 1, day, hour, minute, second)
  const first = offset(wall, timeZone)
  let time = wall - first
  const second_ = offset(time, timeZone)
  if (second_ !== first) time = wall - second_
  return new Date(time)
}

export function startOfDay (date, timeZone) {
  const p = parts(date, timeZone)
  return zoned(p.year, p.month, p.day, 0, 0, 0, timeZone)
}

/** `date`'s day at `hour`:00, like `Calendar.date(bySettingHour:minute:second:of:)`. */
export function atHour (date, hour, timeZone) {
  const p = parts(date, timeZone)
  return zoned(p.year, p.month, p.day, hour, 0, 0, timeZone)
}

/** The same wall-clock time `days` later, like `Calendar.date(byAdding: .day, ...)`. */
export function addDays (date, days, timeZone) {
  const p = parts(date, timeZone)
  return zoned(p.year, p.month, p.day + days, p.hour, p.minute, p.second, timeZone)
}

export function hour (date, timeZone) {
  return parts(date, timeZone).hour
}

/** Whole calendar days from `from`'s day to `to`'s day. */
export function daysBetween (from, to, timeZone) {
  const a = parts(from, timeZone)
  const b = parts(to, timeZone)
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86400000)
}

export function weekday (date, timeZone, locale = 'en-US') {
  return new Intl.DateTimeFormat(locale, { timeZone, weekday: 'long' }).format(date)
}
