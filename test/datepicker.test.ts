import { describe, it, expect, beforeEach } from 'vitest'
import { DatePicker } from '../src/DatePicker'
import type { ChangeInfo, ResourceInput } from '../src/types'

const TZ = 'Europe/Copenhagen'

function mount() {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return el
}

/** Drive the hour/minute sliders to a 'HH:mm' time. */
function setTime(el: HTMLElement, t: string) {
  const [h, m] = t.split(':')
  const hours = el.querySelector<HTMLInputElement>('.zd-time-hours')!
  const minutes = el.querySelector<HTMLInputElement>('.zd-time-minutes')!
  hours.value = String(Number(h))
  hours.dispatchEvent(new Event('input'))
  minutes.value = String(Number(m))
  minutes.dispatchEvent(new Event('input'))
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('date mode', () => {
  it('renders an input and opens a calendar on click', () => {
    const el = mount()
    const dp = new DatePicker(el, { mode: 'date', timezone: TZ }).render()
    expect(el.querySelector('.zd-input')).not.toBeNull()
    expect(el.querySelector('.zd-popup')).toBeNull()

    dp.inputEl!.click()
    expect(el.querySelector('.zd-popup')).not.toBeNull()
    expect(el.querySelectorAll('.zd-day').length).toBe(42)
  })

  it('commits immediately when a day is clicked (no time, no resources)', () => {
    const el = mount()
    let info: ChangeInfo | null = null
    const dp = new DatePicker(el, {
      mode: 'date',
      timezone: TZ,
      value: '2026-06-01',
      onChange: (i) => (info = i),
    }).render()

    dp.open()
    const cell = el.querySelector<HTMLButtonElement>('.zd-day[data-date="2026-06-05"]')!
    cell.click()

    expect(info).not.toBeNull()
    expect(info!.value).toBe('05-06-2026')
    expect(info!.time).toBeNull()
    expect(dp.inputEl!.value).toBe('05-06-2026')
    // popup closes after committing in pure date mode
    expect(el.querySelector('.zd-popup')).toBeNull()
  })

  it('respects minDate / maxDate by disabling out-of-range days', () => {
    const el = mount()
    const dp = new DatePicker(el, {
      mode: 'date',
      timezone: TZ,
      value: '2026-06-15',
      minDate: '2026-06-10',
      maxDate: '2026-06-20',
    }).render()
    dp.open()
    expect(el.querySelector<HTMLButtonElement>('.zd-day[data-date="2026-06-05"]')!.disabled).toBe(true)
    expect(el.querySelector<HTMLButtonElement>('.zd-day[data-date="2026-06-15"]')!.disabled).toBe(false)
    expect(el.querySelector<HTMLButtonElement>('.zd-day[data-date="2026-06-25"]')!.disabled).toBe(true)
  })
})

describe('datetime mode', () => {
  it('combines day and time into a formatted value committed via OK', () => {
    const el = mount()
    let info: ChangeInfo | null = null
    const dp = new DatePicker(el, {
      mode: 'datetime',
      timezone: TZ,
      step: 15,
      onChange: (i) => (info = i),
    }).render()
    dp.open()

    el.querySelector<HTMLButtonElement>('.zd-day[data-date="2026-06-05"]')!.click()
    setTime(el, '14:00')

    el.querySelector<HTMLButtonElement>('.zd-ok')!.click()

    expect(info!.value).toBe('05-06-2026 14:00')
    expect(info!.time).toBe('14:00')
    expect(info!.iso).not.toBeNull()
  })

  it('snaps slider minutes to the step and clamps to opening hours', () => {
    const el = mount()
    let info: ChangeInfo | null = null
    const dp = new DatePicker(el, {
      mode: 'datetime',
      timezone: TZ,
      step: 15,
      minTime: '07:00',
      maxTime: '17:00',
      value: '2026-06-05',
      onChange: (i) => (info = i),
    }).render()
    dp.open()
    // 14:07 → snapped to the 15-min step → 14:00
    setTime(el, '14:07')
    expect(el.querySelector<HTMLElement>('.zd-time-display')!.textContent).toBe('14:00')
    // 18:30 is past the 17:00 close → clamped to 17:00
    setTime(el, '18:30')
    expect(el.querySelector<HTMLElement>('.zd-time-display')!.textContent).toBe('17:00')
    el.querySelector<HTMLButtonElement>('.zd-ok')!.click()
    expect(info!.time).toBe('17:00')
  })

  it('defaults the time to a value so OK can commit once a day is chosen', () => {
    const el = mount()
    const dp = new DatePicker(el, {
      mode: 'datetime',
      timezone: TZ,
      value: '2026-06-05',
    }).render()
    dp.open()
    // sliders pre-fill a default time, so OK is enabled with a day selected
    expect(el.querySelector<HTMLButtonElement>('.zd-ok')!.disabled).toBe(false)
    expect(el.querySelector<HTMLElement>('.zd-time-display')!.textContent).toMatch(/^\d{2}:\d{2}$/)
  })

  it('cannot commit before a day is set', () => {
    const el = mount()
    const dp = new DatePicker(el, { mode: 'datetime', timezone: TZ }).render()
    dp.open()
    // no day chosen yet → OK disabled even though the time has a default
    expect(el.querySelector<HTMLButtonElement>('.zd-ok')!.disabled).toBe(true)
  })
})

describe('resource mode', () => {
  const resources: ResourceInput[] = [
    { id: 1, title: 'Torben', freeMinutes: 480 },
    { id: 2, title: 'Preben', freeMinutes: 120 },
  ]

  it('loads resources for the picked day and shows free time', async () => {
    const el = mount()
    const dp = new DatePicker(el, {
      mode: 'datetime',
      timezone: TZ,
      resources: (date) => {
        expect(date.format('YYYY-MM-DD')).toBe('2026-06-05')
        return resources
      },
    }).render()
    dp.open()
    el.querySelector<HTMLButtonElement>('.zd-day[data-date="2026-06-05"]')!.click()
    await Promise.resolve()
    await Promise.resolve()

    const rows = el.querySelectorAll('.zd-resource')
    expect(rows.length).toBe(2)
    expect(rows[0].querySelector('.zd-resource-free')!.textContent).toBe('Free: 8:00')
    expect(rows[1].querySelector('.zd-resource-free')!.textContent).toBe('Free: 2:00')
  })

  it('flags resources below requiredMinutes and reports sufficiency on choose', async () => {
    const el = mount()
    let info: ChangeInfo | null = null
    const dp = new DatePicker(el, {
      mode: 'datetime',
      timezone: TZ,
      requiredMinutes: 180,
      resources,
      onChange: (i) => (info = i),
    }).render()
    dp.open()
    el.querySelector<HTMLButtonElement>('.zd-day[data-date="2026-06-05"]')!.click()
    await Promise.resolve()
    await Promise.resolve()

    const rows = el.querySelectorAll('.zd-resource')
    // Torben (480) sufficient, Preben (120 < 180) insufficient
    expect(rows[0].classList.contains('zd-resource--insufficient')).toBe(false)
    expect(rows[1].classList.contains('zd-resource--insufficient')).toBe(true)

    setTime(el, '14:00')

    // choose Preben — insufficient
    rows[1].querySelector<HTMLButtonElement>('.zd-resource-choose')!.click()
    expect(info!.resource!.title).toBe('Preben')
    expect(info!.sufficient).toBe(false)
    expect(info!.value).toBe('05-06-2026 14:00')
    // input badge reflects the chosen resource
    const badge = el.querySelector<HTMLElement>('.zd-badge')!
    expect(badge.hidden).toBe(false)
    expect(badge.textContent).toBe('Preben')
    expect(badge.classList.contains('zd-badge--warn')).toBe(true)
  })

  it('disables choose on insufficient resources when blockInsufficient is set', async () => {
    const el = mount()
    const dp = new DatePicker(el, {
      mode: 'datetime',
      timezone: TZ,
      requiredMinutes: 180,
      blockInsufficient: true,
      resources,
    }).render()
    dp.open()
    el.querySelector<HTMLButtonElement>('.zd-day[data-date="2026-06-05"]')!.click()
    await Promise.resolve()
    await Promise.resolve()
    const choose = el.querySelectorAll('.zd-resource')[1].querySelector<HTMLButtonElement>('.zd-resource-choose')!
    expect(choose.disabled).toBe(true)
  })
})

describe('clear and setValue', () => {
  it('clears the value and fires onChange with nulls', () => {
    const el = mount()
    let info: ChangeInfo | null = null
    const dp = new DatePicker(el, {
      mode: 'date',
      timezone: TZ,
      value: '2026-06-05',
      onChange: (i) => (info = i),
    }).render()
    expect(dp.inputEl!.value).toBe('05-06-2026')
    dp.clear()
    expect(info!.date).toBeNull()
    expect(info!.value).toBe('')
    expect(dp.inputEl!.value).toBe('')
  })

  it('setValue updates the input without firing onChange', () => {
    const el = mount()
    let fired = false
    const dp = new DatePicker(el, { mode: 'date', timezone: TZ, onChange: () => (fired = true) }).render()
    dp.setValue('2026-06-05')
    expect(dp.inputEl!.value).toBe('05-06-2026')
    expect(fired).toBe(false)
  })
})

describe('built-in locales', () => {
  it('resolves a language code to translated labels', () => {
    const el = mount()
    const dp = new DatePicker(el, { mode: 'datetime', timezone: TZ, locale: 'da', resources: [] }).render()
    dp.open()
    expect(el.querySelector('.zd-clear')!.textContent).toBe('Ryd')
    expect(el.querySelector('.zd-time-label')!.textContent).toBe('Tid')
  })

  it('falls back from a regional code to the base language', () => {
    const el = mount()
    const dp = new DatePicker(el, { mode: 'date', timezone: TZ, locale: 'de-DE' }).render()
    dp.open()
    expect(el.querySelector('.zd-clear')!.textContent).toBe('Löschen')
  })

  it('lets an explicit Locale object override a built-in string', () => {
    const el = mount()
    const dp = new DatePicker(el, {
      mode: 'date',
      timezone: TZ,
      locale: { code: 'da', buttons: { clear: 'Nulstil' } },
    }).render()
    dp.open()
    expect(el.querySelector('.zd-clear')!.textContent).toBe('Nulstil')
  })
})

describe('inline mode', () => {
  it('renders the popup inline with no input', () => {
    const el = mount()
    new DatePicker(el, { mode: 'date', timezone: TZ, inline: true }).render()
    expect(el.querySelector('.zd-input')).toBeNull()
    expect(el.querySelector('.zd-popup.zd-inline')).not.toBeNull()
    expect(el.querySelectorAll('.zd-day').length).toBe(42)
  })
})
