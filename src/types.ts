import type { Dayjs } from 'dayjs'

/** What the picker collects. */
export type PickerMode = 'date' | 'datetime' | 'time'

/**
 * Raw resource as supplied by the host application or returned from `resourceUrl`.
 * `freeMinutes` is the resource's available minutes on the selected day — the
 * backend computes it and the picker only displays it.
 */
export interface ResourceInput {
  id: string | number
  title?: string
  /** Available (free) minutes on the selected day; the backend computes this. */
  freeMinutes?: number
  /** Accent colour for the resource badge (any CSS colour). */
  color?: string
  /**
   * Marks this resource as the default selection. When the source returns one,
   * the picker pre-selects it after a day is chosen (unless the `resourceId`
   * option names a different one). Lets the API drive the default.
   */
  default?: boolean
  /** Arbitrary domain data forwarded to renderResource and callbacks. */
  extendedProps?: Record<string, unknown>
  [key: string]: unknown
}

/** Normalised resource exposed to render hooks and callbacks. */
export interface CalResource {
  id: string
  title: string
  /** Free minutes on the selected day, or null when the backend omitted it. */
  freeMinutes: number | null
  color?: string
  /** True when the source flagged this resource as the default selection. */
  isDefault: boolean
  extendedProps: Record<string, unknown>
  /** The original, untouched input. */
  raw: ResourceInput
}

/**
 * Where resources come from. Either a static array, a URL string the picker
 * GETs (a `date=YYYY-MM-DD` query param is appended for the selected day), or a
 * function returning resources (sync or async) for a given date.
 */
export type ResourceSource =
  | ResourceInput[]
  | string
  | ((date: Dayjs) => ResourceInput[] | Promise<ResourceInput[]>)

/**
 * Locale strings and behaviour. Month and weekday names are produced via `Intl`
 * from `intl`/`code`; everything the picker writes itself is overridable here so
 * a host app passes its own translations in.
 */
export interface Locale {
  /** BCP-47-ish code, e.g. 'da'. */
  code: string
  /** Day the week starts on (0 = Sunday). Overrides the `firstDay` option. */
  firstDay?: number
  /** Intl locale tag for month/weekday formatting; defaults to `code`. */
  intl?: string
  /** Button labels. */
  buttons?: { clear?: string; ok?: string; today?: string; prev?: string; next?: string }
  /** Inline labels. */
  labels?: {
    /** Prefix before a resource's free time, e.g. 'Free:' / 'Fri:'. */
    free?: string
    /** Per-resource confirm button, e.g. 'Choose' / 'Vælg'. */
    choose?: string
    /** Time field label, e.g. 'Time' / 'Tid'. */
    time?: string
    /** Shown when the resource source returns nothing. */
    noResources?: string
    /** Shown while resources load. */
    loading?: string
  }
}

/** Fired whenever the committed value changes (including clear). */
export interface ChangeInfo {
  /** Selected day with the chosen time applied, in the picker timezone; null when cleared. */
  date: Dayjs | null
  /** Formatted display value written into the input. */
  value: string
  /** ISO instant of `date`, or null when cleared / time-only with no day. */
  iso: string | null
  /** Chosen time as 'HH:mm', or null. */
  time: string | null
  /** Chosen resource, or null when none was picked. */
  resource: CalResource | null
  /**
   * Whether the chosen resource has enough free time for the task:
   * `freeMinutes >= requiredMinutes`. Null when either value is unknown.
   */
  sufficient: boolean | null
}

export interface DatePickerOptions {
  /** What to collect. Default 'date'. */
  mode?: PickerMode
  /** Initial value: a Dayjs-parseable string, a Date, or null. */
  value?: string | Date | null
  /** Timezone the picker reads and writes wall-clock time in (e.g. 'Europe/Copenhagen'). */
  timezone?: string
  locale?: Locale | string
  /** Day the week starts on (0 = Sunday). Default 1 (Monday). */
  firstDay?: number

  /** Minute granularity for the time field and its suggestions. Default 15. */
  step?: number
  /** Earliest selectable time as 'HH:mm'. Default '00:00'. */
  minTime?: string
  /** Latest selectable time as 'HH:mm', '24:00' allowed. Default '24:00'. */
  maxTime?: string
  /** Snap typed/initial times to the nearest `step`. Default true. */
  snap?: boolean

  /** Earliest selectable day (inclusive). */
  minDate?: string | Date
  /** Latest selectable day (inclusive). */
  maxDate?: string | Date

  /** Display format for the date part. Default 'DD-MM-YYYY'. */
  dateFormat?: string

  /** Resource source. When set, a resource list is shown after a day is picked. */
  resources?: ResourceSource
  /**
   * Pre-select the resource with this id once the resource list has loaded for
   * the selected day — the host-set default. Takes precedence over a resource
   * the source flags with `default: true`. The user can still pick another.
   */
  resourceId?: string | number
  /**
   * Task duration in minutes (e.g. summed work hours from sales lines). Resources
   * whose `freeMinutes` is below this are flagged as insufficient.
   */
  requiredMinutes?: number
  /** Disable the choose button on insufficient resources instead of just flagging. Default false. */
  blockInsufficient?: boolean
  /** Require a resource to be picked before a value can be committed. Default false. */
  resourceRequired?: boolean

  /** Render the picker open and inline (no input, no popup) inside the host element. */
  inline?: boolean
  /** Placeholder for the generated input. */
  placeholder?: string
  /** Name for a hidden input carrying the ISO value, for plain form submits. */
  name?: string

  /** Custom resource row renderer. Return a string (innerHTML) or a node. */
  renderResource?: (resource: CalResource) => HTMLElement | string

  onChange?: (info: ChangeInfo) => void
  onOpen?: () => void
  onClose?: () => void
}
