import { createInstance } from "i18next"
import { initReactI18next } from "react-i18next"
import ko from "./locales/ko.json"
import en from "./locales/en.json"

export type Locale = "ko" | "en"
export const locale = (value?: string | null): Locale => value === "en" ? "en" : "ko"

export function createI18n(language = "ko") {
  const instance = createInstance()
  void instance.use(initReactI18next).init({
    resources: { ko: { translation: ko }, en: { translation: en } },
    lng: locale(language),
    supportedLngs: ["ko", "en"],
    fallbackLng: "ko",
    keySeparator: false,
    nsSeparator: false,
    initAsync: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  })
  return instance
}

export const i18n = createI18n()
