// Wraps a directional glyph (← → ◀ ▶) so it visually flips in RTL mode.
// Author every arrow in its LTR-semantic direction (back = ←, forward/next
// = →) and this handles the rest via Tailwind's rtl: variant, which tracks
// the nearest dir="rtl" ancestor (set on <html> by LanguageContext) — no
// per-string "which way does this arrow point in Hebrew" bookkeeping needed.
export function MirroredGlyph({ children }) {
  return (
    <span aria-hidden="true" className="inline-block rtl:-scale-x-100">
      {children}
    </span>
  );
}
