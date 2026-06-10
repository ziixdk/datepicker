import type { Dayjs } from 'dayjs'
import type {
  DatePickerOptions,
  PickerMode,
  Locale,
  CalResource,
  ResourceInput,
  ChangeInfo,
} from './types'
import {
  toTz,
  nowTz,
  timeToMinutes,
  minutesToTime,
  snapMinutes,
  formatDuration,
  slotOptions,
  monthMatrix,
  monthLabel,
  weekdayLabels,
} from './datelib'

const DEFAULT_LOCALE: Locale = {
  code: 'en',
  buttons: { clear: 'Clear', ok: 'OK', today: 'Today', prev: '‹', next: '›' },
  labels: {
    free: 'Free:',
    choose: 'Choose',
    time: 'Time',
    noResources: 'No resources available',
    loading: 'Loading…',
  },
}

let uidSeq = 0

/**
 * Framework-agnostic date / time / datetime picker. Construct with a host
 * element and options, then `render()`. Exposes an imperative surface
 * (getValue/setValue/clear/open/close/refetchResources/destroy) so Preact and
 * React callers can drive it through a ref, mirroring `@ziix/calendar`.
 */
export class DatePicker {
  readonly el: HTMLElement
  options: DatePickerOptions
  /** The generated text input; null in inline mode. */
  inputEl: HTMLInputElement | null = null

  private readonly uid: number
  private readonly tz?: string

  /** Month currently shown in the grid. */
  private viewMonth: Dayjs
  /** Committed/working selection. */
  private selDate: Dayjs | null = null
  private selTime: string | null = null
  private selResource: CalResource | null = null

  private resources: CalResource[] = []
  private resourcesLoading = false
  private resourceToken = 0
  private isOpen = false

  // DOM refs
  private badgeEl: HTMLElement | null = null
  private hiddenEl: HTMLInputElement | null = null
  private popupEl: HTMLElement | null = null
  private bodyEl: HTMLElement | null = null
  private onDocPointer = (e: Event) => this.handleOutside(e)

  constructor(el: HTMLElement, options: DatePickerOptions = {}) {
    this.el = el
    this.options = options
    this.uid = ++uidSeq
    this.tz = options.timezone

    const init = options.value ? toTz(options.value, this.tz) : null
    if (init && init.isValid()) {
      this.selDate = init.startOf('day')
      if (options.mode !== 'date') this.selTime = init.format('HH:mm')
    }
    if (this.selTime) this.selTime = this.normalizeTime(this.selTime)
    this.viewMonth = (this.selDate ?? nowTz(this.tz)).startOf('month')
  }

  // ---- derived config ------------------------------------------------------

  get mode(): PickerMode {
    return this.options.mode ?? 'date'
  }

  private get hasTime(): boolean {
    return this.mode === 'datetime' || this.mode === 'time'
  }

  private get hasDate(): boolean {
    return this.mode === 'datetime' || this.mode === 'date'
  }

  private get hasResources(): boolean {
    return this.options.resources != null
  }

  get locale(): Locale {
    const l = this.options.locale
    const base = DEFAULT_LOCALE
    if (!l) return base
    if (typeof l === 'string') return { ...base, code: l }
    return {
      ...base,
      ...l,
      buttons: { ...base.buttons, ...l.buttons },
      labels: { ...base.labels, ...l.labels },
    }
  }

  private get intlTag(): string {
    const l = this.locale
    return l.intl ?? l.code
  }

  private get firstDay(): number {
    return this.locale.firstDay ?? this.options.firstDay ?? 1
  }

  private get step(): number {
    return this.options.step ?? 15
  }

  private get dateFormat(): string {
    return this.options.dateFormat ?? 'DD-MM-YYYY'
  }

  // ---- public imperative API ----------------------------------------------

  /** Build the DOM into the host element. Returns `this`. */
  render(): this {
    this.el.classList.add('zd')
    this.el.innerHTML = ''

    if (this.options.inline) {
      this.popupEl = this.buildPopup()
      this.popupEl.classList.add('zd-inline')
      this.el.appendChild(this.popupEl)
      this.isOpen = true
      this.renderBody()
      if (this.hasResources && this.selDate) void this.loadResources()
    } else {
      this.el.appendChild(this.buildControl())
      this.syncInput()
    }
    return this
  }

  /** Open the popup (no-op inline or already open). */
  open(): void {
    if (this.options.inline || this.isOpen) return
    this.popupEl = this.buildPopup()
    this.el.appendChild(this.popupEl)
    this.isOpen = true
    this.viewMonth = (this.selDate ?? nowTz(this.tz)).startOf('month')
    this.renderBody()
    if (this.hasResources && this.selDate) void this.loadResources()
    document.addEventListener('pointerdown', this.onDocPointer, true)
    this.options.onOpen?.()
  }

  /** Close the popup without committing (no-op inline). */
  close(): void {
    if (this.options.inline || !this.isOpen) return
    document.removeEventListener('pointerdown', this.onDocPointer, true)
    this.popupEl?.remove()
    this.popupEl = null
    this.bodyEl = null
    this.isOpen = false
    this.options.onClose?.()
  }

  /** Replace the value programmatically. Pass null to clear. Does not fire onChange. */
  setValue(value: string | Date | null): void {
    if (value == null) {
      this.selDate = null
      this.selTime = null
      this.selResource = null
    } else {
      const d = toTz(value, this.tz)
      if (d.isValid()) {
        this.selDate = d.startOf('day')
        if (this.hasTime) this.selTime = this.normalizeTime(d.format('HH:mm'))
        this.viewMonth = this.selDate.startOf('month')
      }
    }
    this.syncInput()
    if (this.isOpen) this.renderBody()
  }

  /** The current committed value as a ChangeInfo snapshot. */
  getValue(): ChangeInfo {
    return this.buildChangeInfo()
  }

  /** Clear the selection and fire onChange. */
  clear(): void {
    this.selDate = null
    this.selTime = null
    this.selResource = null
    this.syncInput()
    if (this.isOpen) this.renderBody()
    this.options.onChange?.(this.buildChangeInfo())
  }

  /** Re-run the resource source for the selected day. */
  refetchResources(): void {
    if (this.hasResources && this.selDate) void this.loadResources()
  }

  /** Remove all DOM and listeners. */
  destroy(): void {
    document.removeEventListener('pointerdown', this.onDocPointer, true)
    this.el.innerHTML = ''
    this.el.classList.remove('zd')
    this.popupEl = null
    this.bodyEl = null
    this.inputEl = null
    this.isOpen = false
  }

  // ---- control (input + badge) --------------------------------------------

  private buildControl(): HTMLElement {
    const group = document.createElement('div')
    group.className = 'zd-control'

    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'zd-input'
    input.readOnly = true
    input.placeholder = this.options.placeholder ?? ''
    input.addEventListener('click', () => (this.isOpen ? this.close() : this.open()))
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        this.open()
      }
    })
    this.inputEl = input
    group.appendChild(input)

    const badge = document.createElement('span')
    badge.className = 'zd-badge'
    badge.hidden = true
    this.badgeEl = badge
    group.appendChild(badge)

    if (this.options.name) {
      const hidden = document.createElement('input')
      hidden.type = 'hidden'
      hidden.name = this.options.name
      this.hiddenEl = hidden
      group.appendChild(hidden)
    }
    return group
  }

  /** Reflect the committed selection into the input, badge and hidden field. */
  private syncInput(): void {
    const info = this.buildChangeInfo()
    if (this.inputEl) this.inputEl.value = info.value
    if (this.hiddenEl) this.hiddenEl.value = info.iso ?? ''
    if (this.badgeEl) {
      if (info.resource) {
        this.badgeEl.hidden = false
        this.badgeEl.textContent = info.resource.title
        this.badgeEl.style.removeProperty('--zd-badge-accent')
        if (info.resource.color) this.badgeEl.style.setProperty('--zd-badge-accent', info.resource.color)
        this.badgeEl.classList.toggle('zd-badge--warn', info.sufficient === false)
      } else {
        this.badgeEl.hidden = true
        this.badgeEl.textContent = ''
        this.badgeEl.classList.remove('zd-badge--warn')
      }
    }
  }

  // ---- popup ---------------------------------------------------------------

  private buildPopup(): HTMLElement {
    const popup = document.createElement('div')
    popup.className = 'zd-popup'
    popup.setAttribute('role', 'dialog')
    const body = document.createElement('div')
    body.className = 'zd-body'
    this.bodyEl = body
    popup.appendChild(body)
    return popup
  }

  private renderBody(): void {
    const body = this.bodyEl
    if (!body) return
    body.innerHTML = ''

    if (this.hasDate) body.appendChild(this.buildCalendar())
    if (this.hasTime) body.appendChild(this.buildTimeRow())
    if (this.hasResources) body.appendChild(this.buildResourceList())
    body.appendChild(this.buildFooter())
  }

  private buildCalendar(): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'zd-cal'

    const header = document.createElement('div')
    header.className = 'zd-cal-header'
    const prev = this.navButton(this.locale.buttons?.prev ?? '‹', 'zd-prev', () => this.shiftMonth(-1))
    const title = document.createElement('div')
    title.className = 'zd-title'
    title.textContent = monthLabel(this.viewMonth, this.intlTag)
    const next = this.navButton(this.locale.buttons?.next ?? '›', 'zd-next', () => this.shiftMonth(1))
    header.append(prev, title, next)
    wrap.appendChild(header)

    const weekdays = document.createElement('div')
    weekdays.className = 'zd-weekdays'
    for (const name of weekdayLabels(this.firstDay, this.intlTag)) {
      const cell = document.createElement('span')
      cell.className = 'zd-weekday'
      cell.textContent = name
      weekdays.appendChild(cell)
    }
    wrap.appendChild(weekdays)

    const grid = document.createElement('div')
    grid.className = 'zd-grid'
    const today = nowTz(this.tz).startOf('day')
    const month = this.viewMonth.month()
    for (const week of monthMatrix(this.viewMonth, this.firstDay)) {
      for (const day of week) {
        grid.appendChild(this.dayButton(day, month, today))
      }
    }
    wrap.appendChild(grid)
    return wrap
  }

  private dayButton(day: Dayjs, month: number, today: Dayjs): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'zd-day'
    btn.textContent = String(day.date())
    btn.dataset.date = day.format('YYYY-MM-DD')
    if (day.month() !== month) btn.classList.add('zd-day--outside')
    if (day.isSame(today, 'day')) btn.classList.add('zd-day--today')
    if (this.selDate && day.isSame(this.selDate, 'day')) btn.classList.add('zd-day--selected')
    if (this.isDisabledDay(day)) {
      btn.disabled = true
      btn.classList.add('zd-day--disabled')
    } else {
      btn.addEventListener('click', () => this.pickDay(day))
    }
    return btn
  }

  private buildTimeRow(): HTMLElement {
    const row = document.createElement('div')
    row.className = 'zd-time-row'

    const label = document.createElement('label')
    label.className = 'zd-time-label'
    label.textContent = this.locale.labels?.time ?? 'Time'
    const listId = `zd-times-${this.uid}`
    label.htmlFor = `${listId}-input`

    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'zd-time'
    input.id = `${listId}-input`
    input.setAttribute('list', listId)
    input.placeholder = 'HH:mm'
    input.value = this.selTime ?? ''
    input.addEventListener('change', () => this.pickTime(input.value))
    input.addEventListener('blur', () => {
      input.value = this.selTime ?? ''
    })

    const datalist = document.createElement('datalist')
    datalist.id = listId
    for (const t of slotOptions(this.options.minTime, this.options.maxTime, this.step)) {
      const opt = document.createElement('option')
      opt.value = t
      datalist.appendChild(opt)
    }

    row.append(label, input, datalist)
    return row
  }

  private buildResourceList(): HTMLElement {
    const list = document.createElement('div')
    list.className = 'zd-resources'

    if (!this.selDate) {
      return list
    }
    if (this.resourcesLoading) {
      const empty = document.createElement('div')
      empty.className = 'zd-resources-empty'
      empty.textContent = this.locale.labels?.loading ?? 'Loading…'
      list.appendChild(empty)
      return list
    }
    if (this.resources.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'zd-resources-empty'
      empty.textContent = this.locale.labels?.noResources ?? 'No resources available'
      list.appendChild(empty)
      return list
    }

    for (const res of this.resources) {
      list.appendChild(this.resourceRow(res))
    }
    return list
  }

  private resourceRow(res: CalResource): HTMLElement {
    const insufficient = this.isInsufficient(res)
    const row = document.createElement('div')
    row.className = 'zd-resource'
    row.dataset.id = res.id
    if (insufficient) row.classList.add('zd-resource--insufficient')
    if (this.selResource?.id === res.id) row.classList.add('zd-resource--selected')

    const custom = this.options.renderResource?.(res)
    if (custom != null) {
      if (typeof custom === 'string') row.innerHTML = custom
      else row.appendChild(custom)
      row.addEventListener('click', () => this.pickResource(res))
      return row
    }

    const title = document.createElement('span')
    title.className = 'zd-resource-title'
    title.textContent = res.title
    if (res.color) title.style.setProperty('--zd-badge-accent', res.color)

    const free = document.createElement('span')
    free.className = 'zd-resource-free'
    free.textContent = res.freeMinutes == null ? '' : `${this.locale.labels?.free ?? 'Free:'} ${formatDuration(res.freeMinutes)}`

    const choose = document.createElement('button')
    choose.type = 'button'
    choose.className = 'zd-resource-choose'
    choose.textContent = this.locale.labels?.choose ?? 'Choose'
    if (insufficient && this.options.blockInsufficient) {
      choose.disabled = true
    } else {
      choose.addEventListener('click', () => this.pickResource(res))
    }

    row.append(title, free, choose)
    return row
  }

  private buildFooter(): HTMLElement {
    const footer = document.createElement('div')
    footer.className = 'zd-footer'

    const clear = document.createElement('button')
    clear.type = 'button'
    clear.className = 'zd-clear'
    clear.textContent = this.locale.buttons?.clear ?? 'Clear'
    clear.addEventListener('click', () => this.clear())
    footer.appendChild(clear)

    // When resources are required the commit happens through a resource row;
    // otherwise an explicit OK button commits the current date/time selection.
    if (!this.options.resourceRequired) {
      const ok = document.createElement('button')
      ok.type = 'button'
      ok.className = 'zd-ok'
      ok.textContent = this.locale.buttons?.ok ?? 'OK'
      ok.disabled = !this.canCommit()
      ok.addEventListener('click', () => this.commit(this.selResource))
      footer.appendChild(ok)
    }
    return footer
  }

  private navButton(text: string, cls: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = `zd-nav ${cls}`
    btn.textContent = text
    btn.addEventListener('click', onClick)
    return btn
  }

  // ---- interaction ---------------------------------------------------------

  private shiftMonth(delta: number): void {
    this.viewMonth = this.viewMonth.add(delta, 'month')
    this.renderBody()
  }

  private pickDay(day: Dayjs): void {
    this.selDate = day.startOf('day')
    this.viewMonth = this.selDate.startOf('month')
    // Picking a different day invalidates the resource selection and list.
    this.selResource = null
    if (this.hasResources) {
      this.resources = []
      void this.loadResources()
    }
    // Pure date mode with no resources commits immediately.
    if (this.mode === 'date' && !this.hasResources) {
      this.commit(null)
      return
    }
    this.renderBody()
  }

  private pickTime(raw: string): void {
    const norm = this.normalizeTime(raw)
    this.selTime = norm
    this.renderBody()
  }

  private pickResource(res: CalResource): void {
    if (this.isInsufficient(res) && this.options.blockInsufficient) return
    this.selResource = res
    this.commit(res)
  }

  private commit(resource: CalResource | null): void {
    if (!this.canCommit()) return
    if (this.options.resourceRequired && !resource) return
    this.selResource = resource
    this.syncInput()
    this.options.onChange?.(this.buildChangeInfo())
    this.close()
  }

  private handleOutside(e: Event): void {
    const target = e.target as Node | null
    if (target && (this.el.contains(target) || this.popupEl?.contains(target))) return
    this.close()
  }

  // ---- helpers -------------------------------------------------------------

  private normalizeTime(raw: string): string | null {
    const m = /^(\d{1,2}):(\d{1,2})/.exec(raw.trim())
    if (!m) return this.selTime
    let mins = Number(m[1]) * 60 + Number(m[2])
    if (this.options.snap !== false) mins = snapMinutes(mins, this.step)
    const lo = timeToMinutes(this.options.minTime ?? '00:00')
    const hi = timeToMinutes(this.options.maxTime ?? '24:00')
    mins = Math.min(Math.max(mins, lo), Math.max(lo, hi - this.step))
    return minutesToTime(mins)
  }

  private isDisabledDayBound(day: Dayjs, bound: string | Date | undefined, dir: 'before' | 'after'): boolean {
    if (!bound) return false
    const b = toTz(bound, this.tz).startOf('day')
    return dir === 'before' ? day.isBefore(b, 'day') : day.isAfter(b, 'day')
  }

  private isDisabledDay(day: Dayjs): boolean {
    return (
      this.isDisabledDayBound(day, this.options.minDate, 'before') ||
      this.isDisabledDayBound(day, this.options.maxDate, 'after')
    )
  }

  private isInsufficient(res: CalResource): boolean {
    const req = this.options.requiredMinutes
    if (req == null || res.freeMinutes == null) return false
    return res.freeMinutes < req
  }

  private canCommit(): boolean {
    if (this.mode === 'time') return this.selTime != null
    if (this.mode === 'datetime') return this.selDate != null && this.selTime != null
    return this.selDate != null
  }

  /** Combine the selected day and time into one Dayjs in the picker timezone. */
  private combined(): Dayjs | null {
    if (this.mode === 'time') {
      if (this.selTime == null) return null
      const base = nowTz(this.tz).startOf('day')
      return base.add(timeToMinutes(this.selTime), 'minute')
    }
    if (!this.selDate) return null
    if (this.hasTime && this.selTime != null) {
      return this.selDate.startOf('day').add(timeToMinutes(this.selTime), 'minute')
    }
    return this.selDate
  }

  private formatValue(): string {
    if (this.mode === 'time') return this.selTime ?? ''
    if (!this.selDate) return ''
    const datePart = this.selDate.format(this.dateFormat)
    if (this.mode === 'datetime') return this.selTime ? `${datePart} ${this.selTime}` : datePart
    return datePart
  }

  private buildChangeInfo(): ChangeInfo {
    const combined = this.combined()
    const resource = this.selResource
    let sufficient: boolean | null = null
    if (resource && this.options.requiredMinutes != null && resource.freeMinutes != null) {
      sufficient = resource.freeMinutes >= this.options.requiredMinutes
    }
    return {
      date: this.mode === 'time' ? combined : this.selDate ? combined : null,
      value: this.formatValue(),
      iso: this.mode === 'time' ? null : combined ? combined.toISOString() : null,
      time: this.hasTime ? this.selTime : null,
      resource,
      sufficient,
    }
  }

  // ---- resource source -----------------------------------------------------

  private normalizeResource(input: ResourceInput): CalResource {
    return {
      id: String(input.id),
      title: input.title ?? String(input.id),
      freeMinutes: typeof input.freeMinutes === 'number' ? input.freeMinutes : null,
      color: input.color,
      extendedProps: input.extendedProps ?? {},
      raw: input,
    }
  }

  private async loadResources(): Promise<void> {
    const src = this.options.resources
    if (src == null || !this.selDate) return
    const date = this.selDate
    const token = ++this.resourceToken
    this.resourcesLoading = true
    if (this.isOpen) this.renderBody()

    let raw: ResourceInput[] = []
    try {
      if (Array.isArray(src)) {
        raw = src
      } else if (typeof src === 'string') {
        const url = `${src}${src.includes('?') ? '&' : '?'}date=${date.format('YYYY-MM-DD')}`
        const res = await fetch(url, { headers: { Accept: 'application/json' } })
        raw = res.ok ? await res.json() : []
      } else {
        raw = await src(date)
      }
    } catch {
      raw = []
    }

    // A newer load (or a clear) superseded this one — drop the stale result.
    if (token !== this.resourceToken) return
    this.resources = raw.map((r) => this.normalizeResource(r))
    this.resourcesLoading = false
    if (this.isOpen) this.renderBody()
  }
}
