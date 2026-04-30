"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import ar from "../../lib/i18n/locales/ar/translation.json";
import en from "../../lib/i18n/locales/en/translation.json";

const I18nContext = createContext();

const resources = { ar, en };

function getNestedValue(obj, path) {
  return path.split(".").reduce((current, key) => current?.[key], obj) || path;
}

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState("ar");

  useEffect(() => {
    const saved = localStorage.getItem("rp_locale");
    if (saved && (saved === "ar" || saved === "en")) {
      setLocaleState(saved);
    }
  }, []);

  const setLocale = useCallback((newLocale) => {
    setLocaleState(newLocale);
    localStorage.setItem("rp_locale", newLocale);
    document.documentElement.lang = newLocale;
    document.documentElement.dir = newLocale === "ar" ? "rtl" : "ltr";
  }, []);

  const t = useCallback((key, defaultValue) => {
    const resource = resources[locale] || resources.ar;
    return getNestedValue(resource, key) || defaultValue || key;
  }, [locale]);

  const value = { locale, setLocale, t };

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    return { locale: "ar", setLocale: () => {}, t: (key) => key };
  }
  return context;
}
