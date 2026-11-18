export function formatClock(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatChips(amount) {
  return amount.toLocaleString("en-US");
}

// Human-readable elapsed time for a tournament's lifetime (hours/minutes),
// as opposed to formatClock's mm:ss countdown for a single level. Falls
// back to seconds under a minute so a brief pause doesn't just read "0m".
export function formatDuration(ms) {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export function formatDateTime(epochMs) {
  if (!epochMs) return "—";
  return new Date(epochMs).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
