import { createContext, useContext, useEffect, useState } from "react";
import { he } from "../translations/he";
import { en } from "../translations/en";

const DICTS = { he, en };
const LOCALES = { he: "he-IL", en: "en-US" };
const STORAGE_KEY = "app_lang";

const LanguageContext = createContext(null);

function resolve(dict, key) {
  return key.split(".").reduce((obj, part) => (obj && typeof obj === "object" ? obj[part] : undefined), dict);
}

function interpolate(str, params) {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (match, name) => (params[name] !== undefined ? params[name] : match));
}

// Applied immediately (not just from an effect) so a reload never flashes
// the wrong direction before React mounts — see main.jsx, which calls this
// synchronously before render using the same localStorage read.
export function applyDocumentDirection(lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
}

export function getStoredLanguage() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "en" || stored === "he" ? stored : "he";
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(getStoredLanguage);

  useEffect(() => {
    applyDocumentDirection(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  }, [lang]);

  function setLang(next) {
    setLangState(next === "en" ? "en" : "he");
  }

  function toggleLanguage() {
    setLangState((current) => (current === "he" ? "en" : "he"));
  }

  // Falls back he -> raw key string, never throws and never renders
  // "undefined" for a key that hasn't been translated yet.
  function t(key, params) {
    const str = resolve(DICTS[lang], key) ?? resolve(DICTS.he, key) ?? key;
    return interpolate(str, params);
  }

  const value = { lang, setLang, toggleLanguage, t, locale: LOCALES[lang] };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return ctx;
}
