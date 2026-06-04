// Local calendar-day key (YYYY-MM-DD). The single source of truth for "what
// day is this row." Must NOT use toISOString() — that returns UTC, which rolls
// over to the next day every evening for timezones behind UTC (e.g. US), filing
// logs under tomorrow's date. Garmin sync (date.today()), the calendar, and the
// weight log all key on the local date, so everything else must agree.
export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Today's local day key.
export const todayKey = () => dayKey()
