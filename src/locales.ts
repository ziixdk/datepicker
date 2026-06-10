import type { Locale } from './types'

/**
 * Built-in translations for the few strings the picker writes itself. Month and
 * weekday names come from `Intl`, so only these short labels need translating.
 *
 * Pass `locale: 'da'` to use one of these, or pass a full `Locale` object to
 * override any string. The 15 codes match the languages the ziix DMS ships.
 */
export const locales: Record<string, Locale> = {
  en: {
    code: 'en',
    buttons: { clear: 'Clear', ok: 'OK' },
    labels: { free: 'Free:', choose: 'Choose', time: 'Time', noResources: 'No resources available', loading: 'Loading…' },
  },
  da: {
    code: 'da',
    buttons: { clear: 'Ryd', ok: 'OK' },
    labels: { free: 'Fri:', choose: 'Vælg', time: 'Tid', noResources: 'Ingen ledige ressourcer', loading: 'Henter…' },
  },
  sv: {
    code: 'sv',
    buttons: { clear: 'Rensa', ok: 'OK' },
    labels: { free: 'Fri:', choose: 'Välj', time: 'Tid', noResources: 'Inga resurser tillgängliga', loading: 'Laddar…' },
  },
  nb: {
    code: 'nb',
    buttons: { clear: 'Tøm', ok: 'OK' },
    labels: { free: 'Fri:', choose: 'Velg', time: 'Tid', noResources: 'Ingen ressurser tilgjengelig', loading: 'Laster…' },
  },
  nl: {
    code: 'nl',
    buttons: { clear: 'Wissen', ok: 'OK' },
    labels: { free: 'Vrij:', choose: 'Kiezen', time: 'Tijd', noResources: 'Geen resources beschikbaar', loading: 'Laden…' },
  },
  de: {
    code: 'de',
    buttons: { clear: 'Löschen', ok: 'OK' },
    labels: { free: 'Frei:', choose: 'Wählen', time: 'Zeit', noResources: 'Keine Ressourcen verfügbar', loading: 'Lädt…' },
  },
  fr: {
    code: 'fr',
    buttons: { clear: 'Effacer', ok: 'OK' },
    labels: { free: 'Libre :', choose: 'Choisir', time: 'Heure', noResources: 'Aucune ressource disponible', loading: 'Chargement…' },
  },
  pl: {
    code: 'pl',
    buttons: { clear: 'Wyczyść', ok: 'OK' },
    labels: { free: 'Wolne:', choose: 'Wybierz', time: 'Czas', noResources: 'Brak dostępnych zasobów', loading: 'Ładowanie…' },
  },
  fi: {
    code: 'fi',
    buttons: { clear: 'Tyhjennä', ok: 'OK' },
    labels: { free: 'Vapaa:', choose: 'Valitse', time: 'Aika', noResources: 'Ei resursseja saatavilla', loading: 'Ladataan…' },
  },
  is: {
    code: 'is',
    buttons: { clear: 'Hreinsa', ok: 'Í lagi' },
    labels: { free: 'Laust:', choose: 'Velja', time: 'Tími', noResources: 'Engin tilföng í boði', loading: 'Hleð…' },
  },
  lv: {
    code: 'lv',
    buttons: { clear: 'Notīrīt', ok: 'Labi' },
    labels: { free: 'Brīvs:', choose: 'Izvēlēties', time: 'Laiks', noResources: 'Nav pieejamu resursu', loading: 'Ielādē…' },
  },
  et: {
    code: 'et',
    buttons: { clear: 'Tühjenda', ok: 'OK' },
    labels: { free: 'Vaba:', choose: 'Vali', time: 'Aeg', noResources: 'Ressursse pole saadaval', loading: 'Laadimine…' },
  },
  kl: {
    code: 'kl',
    buttons: { clear: 'Peerlugu', ok: 'OK' },
    labels: { free: 'Sungiusagaq:', choose: 'Toqqaruk', time: 'Nalunaaquttaq', noResources: 'Atortussaqanngilaq', loading: 'Usserneqarpoq…' },
  },
  es: {
    code: 'es',
    buttons: { clear: 'Borrar', ok: 'OK' },
    labels: { free: 'Libre:', choose: 'Elegir', time: 'Hora', noResources: 'No hay recursos disponibles', loading: 'Cargando…' },
  },
  it: {
    code: 'it',
    buttons: { clear: 'Cancella', ok: 'OK' },
    labels: { free: 'Libero:', choose: 'Scegli', time: 'Ora', noResources: 'Nessuna risorsa disponibile', loading: 'Caricamento…' },
  },
}

/**
 * Resolve a locale code (e.g. 'da' or 'da-DK') to a built-in `Locale`, falling
 * back to the base language and finally to English.
 */
export function resolveLocale(code: string): Locale {
  const lower = code.toLowerCase()
  return locales[lower] ?? locales[lower.split('-')[0]] ?? { code }
}
