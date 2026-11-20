import { useLanguage } from "../context/LanguageContext";

// Language names are proper nouns — always shown in their own script
// regardless of the active UI language, so these two labels aren't
// translation keys. Shows the language you'd switch *to*.
export function LanguageToggle({ className = "" }) {
  const { lang, toggleLanguage } = useLanguage();
  const label = lang === "he" ? "EN" : "עברית";

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      aria-label={lang === "he" ? "Switch to English" : "עבור לעברית"}
      className={
        className ||
        "rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700"
      }
    >
      {label}
    </button>
  );
}
