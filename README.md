# @ziix/datepicker

A small, framework-agnostic **date / time / datetime picker** with configurable
minute steps and **resource-aware selection**: it can fetch bookable resources
from a URL, show each one's free time on the chosen day, and let the user pick
the resource a task lands on.

Built for the same kind of host as [`@ziix/calendar`](https://github.com/ziixdk/calendar):
vanilla TypeScript, `dayjs` as the only peer dependency, timezone-correct, and
fully themeable through `--zd-*` CSS custom properties. Drive it imperatively
from Preact/React through a ref, or use it standalone.

## Install

```bash
npm install @ziix/datepicker dayjs
```

```js
import { DatePicker } from '@ziix/datepicker'
import '@ziix/datepicker/styles.css'
```

## Quick start

```js
const picker = new DatePicker(document.getElementById('picker'), {
  mode: 'datetime',
  timezone: 'Europe/Copenhagen',
  step: 15,
  onChange: (info) => console.log(info.value, info.iso),
}).render()
```

The picker renders a readonly input; clicking it opens a popup with a month grid
(and, depending on `mode`, a time field and a resource list). The chosen
resource appears as a badge next to the input — e.g. `05-06-2026 14:00` with a
`Torben` badge.

## Modes

| `mode`       | Collects            | Commits on                       |
|--------------|---------------------|----------------------------------|
| `'date'`     | a day               | day click (or a resource choice) |
| `'datetime'` | a day **and** time  | the **OK** button or a resource  |
| `'time'`     | a time only         | the **OK** button                |

```js
new DatePicker(el, { mode: 'date' }).render()      // just a date
new DatePicker(el, { mode: 'datetime' }).render()  // date + time
new DatePicker(el, { mode: 'time', step: 5 }).render()
```

## Time

The time is picked with two sliders (hour + minute), air-datepicker style, with
the value shown live above them. `step` is the minute granularity — the minute
slider snaps to it (5 / 10 / 15 …). `minTime` / `maxTime` are the **opening
hours**: the hour slider is clamped to them and any value past the close snaps
back inside. Initial / programmatic values are also snapped (unless
`snap: false`).

```js
new DatePicker(el, {
  mode: 'datetime',
  step: 5,            // 5-minute intervals; try 10, 15, …
  minTime: '07:00',
  maxTime: '17:00',
}).render()
```

## Resources

Set `resources` and, once a day is picked, the picker shows one row per
resource: title, free time, and a **Choose** button. This is the “pick a
delivery date and the resource it lands on” flow.

`resources` can be:

- an **array** of resources,
- a **URL string** — the picker `GET`s it with a `date=YYYY-MM-DD` query param
  and expects a JSON array back, or
- a **function** `(date: Dayjs) => ResourceInput[] | Promise<ResourceInput[]>`.

The backend computes `freeMinutes` (available minutes that day); the picker only
displays it (`Free: 8:00`).

```js
new DatePicker(el, {
  mode: 'datetime',
  resourceRequired: true,
  resources: '/api/delivery-resources', // GET /api/delivery-resources?date=2026-06-05
}).render()
```

Expected response:

```json
[
  { "id": 1, "title": "Torben", "freeMinutes": 480 },
  { "id": 2, "title": "Preben", "freeMinutes": 120 }
]
```

### Showing whether a resource has enough time

Pass `requiredMinutes` — typically the task's summed work hours from the sales
lines. Resources whose `freeMinutes` is below it are flagged red, and the
`onChange` payload reports `sufficient`.

```js
new DatePicker(el, {
  mode: 'datetime',
  resources: '/api/delivery-resources',
  requiredMinutes: 180,        // 3 h needed
  blockInsufficient: false,    // true → disable Choose on too-small resources
  onChange: ({ resource, sufficient }) =>
    console.log(resource?.title, sufficient), // e.g. "Preben" false
}).render()
```

## onChange payload

```ts
interface ChangeInfo {
  date: Dayjs | null   // chosen day with time applied, in the picker tz
  value: string        // formatted value written to the input, e.g. '05-06-2026 14:00'
  iso: string | null   // ISO instant, or null when cleared / time-only
  time: string | null  // 'HH:mm' or null
  resource: CalResource | null
  sufficient: boolean | null // freeMinutes >= requiredMinutes, or null
}
```

## Localisation & timezone

Month and weekday names always come from `Intl` using the locale code, so they
are localised for free. The few short strings the picker writes itself (Clear,
OK, Free:, Choose, Time, …) ship as built-in translations.

Pass a **language code** to use a built-in translation — regional codes fall
back to the base language (`da-DK` → `da`):

```js
new DatePicker(el, { locale: 'da' }).render()
```

Built-in languages (the 15 the ziix DMS ships):

`en` `da` `sv` `nb` `nl` `de` `fr` `pl` `fi` `is` `lv` `et` `kl` `es` `it`

Or pass a **`Locale` object** to override any string (or add a language):

```js
new DatePicker(el, {
  locale: {
    code: 'da',
    firstDay: 1,
    buttons: { clear: 'Nulstil', ok: 'OK' },
    labels: { free: 'Fri:', choose: 'Vælg', time: 'Tid', noResources: 'Ingen ledige' },
  },
}).render()
```

The locale map is also exported, so you can read or extend it:

```js
import { locales, resolveLocale } from '@ziix/datepicker'
locales.da.labels.choose // 'Vælg'
```

**Timezone** — times are read and written as wall-clock time in `timezone`, so
server values like `2026-06-05T14:00:00` land at 14:00 in the shop regardless of
the browser timezone.

## Imperative API

```ts
picker.render()                 // build the DOM (call once)
picker.open() / picker.close()
picker.getValue(): ChangeInfo
picker.setValue(value | null)   // set programmatically (no onChange)
picker.clear()                  // clear + fire onChange
picker.refetchResources()
picker.destroy()
picker.inputEl                  // the generated input (null when inline)
```

Pass `inline: true` to render the popup open and embedded (no input), and
`name: '...'` to also emit a hidden input carrying the ISO value for plain form
submits.

## Theming

Override `--zd-*` variables on `.zd` (or any ancestor) to map the picker onto
your design tokens — e.g. an OKLCH palette. Never restyle internals directly.

```css
.zd {
  --zd-accent: oklch(0.55 0.18 250);
  --zd-selected-bg: var(--zd-accent);
  --zd-danger: oklch(0.6 0.2 25);
  --zd-radius: 8px;
}
```

Key tokens: `--zd-border`, `--zd-bg`, `--zd-muted-bg`, `--zd-fg`,
`--zd-muted-fg`, `--zd-today-bg`, `--zd-accent`, `--zd-accent-fg`,
`--zd-selected-bg`, `--zd-selected-fg`, `--zd-danger`, `--zd-danger-bg`,
`--zd-radius`, `--zd-font`.

## Development

```bash
npm install
npm run dev        # vite playground at examples/index.html
npm test           # vitest
npm run typecheck
npm run build      # dist/ (ESM + d.ts + css)
```

## Changelog

This project follows [semantic versioning](https://semver.org). Newest first.

### 0.1.0 — 2026-06-10

Initial release.

- **Modes**: `date`, `datetime`, `time`.
- **Time sliders**: air-datepicker-style hour + minute sliders with a live value
  display; minute snaps to `step` (5 / 10 / 15 …), hour clamps to the opening
  hours (`minTime` / `maxTime`).
- **Resources**: source from an array, a URL (`?date=YYYY-MM-DD`), or a function;
  shows each resource's `freeMinutes`, flags resources below `requiredMinutes`,
  and renders the chosen resource as an input-group badge.
- **15 built-in locales** (`en da sv nb nl de fr pl fi is lv et kl es it`) plus
  full `Locale`-object override; month/weekday names via `Intl`.
- **Timezone-correct** wall-clock parsing (dayjs utc/timezone).
- **Themeable** via `--zd-*` CSS custom properties.
- **Imperative API**: `render` · `open` · `close` · `getValue` · `setValue` ·
  `clear` · `refetchResources` · `destroy`; `inline` and hidden-`name` support.

## License

MIT © ziix
