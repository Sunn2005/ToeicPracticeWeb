import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { translations } from "./translations";

const STORAGE_KEY = "toeic-practice-language";
const LanguageContext = createContext(null);

function getInitialLanguage() {
  if (typeof window === "undefined") return "en";
  try {
    const savedLanguage = window.localStorage.getItem(STORAGE_KEY);
    return savedLanguage === "vi" || savedLanguage === "en" ? savedLanguage : "en";
  } catch {
    return "en";
  }
}

export function LanguageProvider({ children, fixedLanguage = null }) {
  const [preferredLanguage, setPreferredLanguage] = useState(getInitialLanguage);
  const language = fixedLanguage ?? preferredLanguage;
  const canSwitchLanguage = fixedLanguage === null;

  useEffect(() => {
    if (!canSwitchLanguage) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, preferredLanguage);
    } catch {
      // The language still works for this session when storage is unavailable.
    }
  }, [preferredLanguage, canSwitchLanguage]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(() => ({
    language,
    canSwitchLanguage,
    setLanguage: (nextLanguage) => {
      if (canSwitchLanguage) setPreferredLanguage(nextLanguage);
    },
    toggleLanguage: () => {
      if (canSwitchLanguage) setPreferredLanguage((current) => (current === "en" ? "vi" : "en"));
    },
    t: (key) => translations[language]?.[key] ?? translations.en[key] ?? key,
  }), [language, canSwitchLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

// The provider and its matching hook intentionally live together as one public i18n module.
// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return context;
}
