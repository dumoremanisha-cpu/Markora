// Shared relative-time formatter ("2h ago", "Yesterday") — real, locale-
// aware (`Intl.RelativeTimeFormat`), used by the annotations panel
// (`new_ui/annotations.png`) rather than each surface rolling its own.
const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
];

export function formatRelativeTime(timestampMs: number, locale: string, now = Date.now()): string {
  const diffSeconds = Math.round((timestampMs - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  for (const [unit, secondsInUnit] of UNITS) {
    if (Math.abs(diffSeconds) >= secondsInUnit) {
      return rtf.format(Math.round(diffSeconds / secondsInUnit), unit);
    }
  }
  return rtf.format(diffSeconds, 'second');
}
