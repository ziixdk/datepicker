import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

/**
 * Parse a value into a Dayjs anchored to `tz` (the shop timezone), if given.
 *
 * A naïve datetime string (no offset / `Z`) is read AS wall-clock time in `tz`,
 * not in the host's local zone — so a server value like `2026-06-05T14:00:00`
 * lands at 14:00 in the shop regardless of the browser timezone. Strings with an
 * offset, and Date/Dayjs values, are absolute instants displayed in `tz`.
 */
export function toTz(value: string | Date | Dayjs, tz?: string): Dayjs {
  if (!tz) return dayjs(value)
  if (typeof value === 'string' && !/([zZ])$|[+-]\d{2}:?\d{2}$/.test(value)) {
    return dayjs.tz(value, tz)
  }
  return dayjs(value).tz(tz)
}

/** "Now" in the picker timezone. */
export function nowTz(tz?: string): Dayjs {
  return tz ? dayjs().tz(tz) : dayjs()
}

/** Parse 'HH:mm' / 'HH:mm:ss' / '24:00' into minutes from midnight. */
export function timeToMinutes(t: string): number {
  const parts = t.split(':')
  const h = Number(parts[0]) || 0
  const m = Number(parts[1]) || 0
  return h * 60 + m
}

/** Format minutes-from-midnight back to a zero-padded 'HH:mm'. */
export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Round minutes to the nearest `step` (no-op when step <= 0). */
export function snapMinutes(min: number, step: number): number {
  if (step <= 0) return min
  return Math.round(min / step) * step
}

/**
 * Format a duration in minutes as `H:MM` (hours not zero-padded) — e.g. 480 →
 * `8:00`, 120 → `2:00`. Used for a resource's free time.
 */
export function formatDuration(totalMin: number): string {
  const sign = totalMin < 0 ? '-' : ''
  const abs = Math.abs(totalMin)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `${sign}${h}:${String(m).padStart(2, '0')}`
}

/**
 * The stepped time options for the field, from `min` (inclusive) to `max`
 * (exclusive) in `step`-minute increments — '00:00', '00:15', … for step 15.
 */
export function slotOptions(min = '00:00', max = '24:00', step = 15): string[] {
  const a = timeToMinutes(min)
  const b = timeToMinutes(max)
  const out: string[] = []
  if (step <= 0) return out
  for (let m = a; m < b; m += step) out.push(minutesToTime(m))
  return out
}

/**
 * A 6×7 matrix of Dayjs days covering the month `monthDate` falls in, padded
 * with the surrounding days so every week is full and the grid height is stable.
 */
export function monthMatrix(monthDate: Dayjs, firstDay = 1): Dayjs[][] {
  const startOfMonth = monthDate.startOf('month')
  const offset = (startOfMonth.day() - firstDay + 7) % 7
  let cur = startOfMonth.subtract(offset, 'day').startOf('day')
  const weeks: Dayjs[][] = []
  for (let w = 0; w < 6; w++) {
    const week: Dayjs[] = []
    for (let d = 0; d < 7; d++) {
      week.push(cur)
      cur = cur.add(1, 'day')
    }
    weeks.push(week)
  }
  return weeks
}

/** Capitalised "month year" title for the calendar header, via Intl. */
export function monthLabel(d: Dayjs, localeTag: string): string {
  const s = new Intl.DateTimeFormat(localeTag, { month: 'long', year: 'numeric' }).format(d.toDate())
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Short weekday names ordered from `firstDay`, via Intl. */
export function weekdayLabels(firstDay: number, localeTag: string): string[] {
  // 2021-08-01 (UTC) is a Sunday — a stable anchor for weekday names.
  const fmt = new Intl.DateTimeFormat(localeTag, { weekday: 'short' })
  const out: string[] = []
  for (let i = 0; i < 7; i++) {
    const dayIdx = (firstDay + i) % 7
    out.push(fmt.format(new Date(Date.UTC(2021, 7, 1 + dayIdx))))
  }
  return out
}
