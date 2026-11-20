export function formatClock(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatChips(amount, locale = "en-US") {
  return amount.toLocaleString(locale);
}

// Human-readable elapsed time for a tournament's lifetime (hours/minutes),
// as opposed to formatClock's mm:ss countdown for a single level. Falls
// back to seconds under a minute so a brief pause doesn't just read "0m".
// `t` is the active useLanguage().t — passing it translates the unit
// suffixes; omitting it falls back to plain English letters.
export function formatDuration(ms, t) {
  const hourUnit = t ? t("common.hourAbbrev") : "h";
  const minuteUnit = t ? t("common.minuteAbbrev") : "m";
  const secondUnit = t ? t("common.secondAbbrev") : "s";
  if (ms < 60000) return `${Math.round(ms / 1000)}${secondUnit}`;
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}${minuteUnit}`;
  return `${hours}${hourUnit} ${minutes}${minuteUnit}`;
}

export function formatDateTime(epochMs, locale = "en-US") {
  if (!epochMs) return "—";
  return new Date(epochMs).toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
