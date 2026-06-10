import { describe, it, expect } from 'vitest'
import {
  timeToMinutes,
  minutesToTime,
  snapMinutes,
  formatDuration,
  slotOptions,
  monthMatrix,
  weekdayLabels,
  toTz,
} from '../src/datelib'
import dayjs from 'dayjs'

describe('timeToMinutes / minutesToTime', () => {
  it('parses and round-trips HH:mm', () => {
    expect(timeToMinutes('00:00')).toBe(0)
    expect(timeToMinutes('06:30')).toBe(390)
    expect(timeToMinutes('24:00')).toBe(1440)
    expect(minutesToTime(0)).toBe('00:00')
    expect(minutesToTime(390)).toBe('06:30')
    expect(minutesToTime(1439)).toBe('23:59')
  })
})

describe('snapMinutes', () => {
  it('rounds to the nearest step', () => {
    expect(snapMinutes(7, 15)).toBe(0)
    expect(snapMinutes(8, 15)).toBe(15)
    expect(snapMinutes(52, 5)).toBe(50)
    expect(snapMinutes(53, 5)).toBe(55)
  })

  it('is a no-op for non-positive steps', () => {
    expect(snapMinutes(53, 0)).toBe(53)
  })
})

describe('formatDuration', () => {
  it('formats free time as H:MM without leading-zero hours', () => {
    expect(formatDuration(480)).toBe('8:00')
    expect(formatDuration(120)).toBe('2:00')
    expect(formatDuration(90)).toBe('1:30')
    expect(formatDuration(0)).toBe('0:00')
  })

  it('handles a negative remainder', () => {
    expect(formatDuration(-30)).toBe('-0:30')
  })
})

describe('slotOptions', () => {
  it('produces stepped slots, max exclusive', () => {
    expect(slotOptions('08:00', '09:00', 15)).toEqual(['08:00', '08:15', '08:30', '08:45'])
  })

  it('honours a 5-minute step', () => {
    expect(slotOptions('08:00', '08:20', 5)).toEqual(['08:00', '08:05', '08:10', '08:15'])
  })

  it('defaults to a full day in 15-minute slots', () => {
    expect(slotOptions()).toHaveLength(96)
  })
})

describe('monthMatrix', () => {
  it('always returns 6 full weeks', () => {
    const weeks = monthMatrix(dayjs('2026-06-15'), 1)
    expect(weeks).toHaveLength(6)
    expect(weeks.every((w) => w.length === 7)).toBe(true)
  })

  it('starts the grid on the configured first day of week', () => {
    // June 2026 starts on a Monday, so a Monday-first grid begins on 2026-06-01.
    const weeks = monthMatrix(dayjs('2026-06-15'), 1)
    expect(weeks[0][0].format('YYYY-MM-DD')).toBe('2026-06-01')
    // Sunday-first begins the previous Sunday, 2026-05-31.
    const sun = monthMatrix(dayjs('2026-06-15'), 0)
    expect(sun[0][0].format('YYYY-MM-DD')).toBe('2026-05-31')
  })
})

describe('weekdayLabels', () => {
  it('orders weekday names from the first day', () => {
    const en = weekdayLabels(1, 'en')
    expect(en[0].toLowerCase()).toContain('mon')
    expect(en[6].toLowerCase()).toContain('sun')
  })
})

describe('toTz', () => {
  it('reads a naive datetime as wall-clock time in the target tz', () => {
    const d = toTz('2026-06-05T14:00:00', 'Europe/Copenhagen')
    expect(d.format('YYYY-MM-DD HH:mm')).toBe('2026-06-05 14:00')
  })
})
