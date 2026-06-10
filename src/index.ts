import './styles.css'

export { DatePicker } from './DatePicker'
export { locales, resolveLocale } from './locales'

export {
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

export type {
  PickerMode,
  ResourceInput,
  CalResource,
  ResourceSource,
  Locale,
  ChangeInfo,
  DatePickerOptions,
} from './types'
