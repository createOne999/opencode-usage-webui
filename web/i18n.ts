import { createInstance } from "i18next"
import { initReactI18next } from "react-i18next"
import ko from "./locales/ko.json"
import en from "./locales/en.json"
import zh from "./locales/zh.json"
import zht from "./locales/zht.json"
import de from "./locales/de.json"
import es from "./locales/es.json"
import fr from "./locales/fr.json"
import it from "./locales/it.json"
import da from "./locales/da.json"
import ja from "./locales/ja.json"
import pl from "./locales/pl.json"
import ru from "./locales/ru.json"
import bs from "./locales/bs.json"
import ar from "./locales/ar.json"
import no from "./locales/no.json"
import br from "./locales/br.json"
import th from "./locales/th.json"
import tr from "./locales/tr.json"
import uk from "./locales/uk.json"
import bn from "./locales/bn.json"
import gr from "./locales/gr.json"
import vi from "./locales/vi.json"

export const LANGUAGES = [
  { code: "ko", label: "한국어", tag: "ko-KR" },
  { code: "en", label: "English", tag: "en-US" },
  { code: "zh", label: "简体中文", tag: "zh-CN" },
  { code: "zht", label: "繁體中文", tag: "zh-TW" },
  { code: "de", label: "Deutsch", tag: "de-DE" },
  { code: "es", label: "Español", tag: "es-ES" },
  { code: "fr", label: "Français", tag: "fr-FR" },
  { code: "it", label: "Italiano", tag: "it-IT" },
  { code: "da", label: "Dansk", tag: "da-DK" },
  { code: "ja", label: "日本語", tag: "ja-JP" },
  { code: "pl", label: "Polski", tag: "pl-PL" },
  { code: "ru", label: "Русский", tag: "ru-RU" },
  { code: "bs", label: "Bosanski", tag: "bs-BA" },
  { code: "ar", label: "العربية", tag: "ar" },
  { code: "no", label: "Norsk", tag: "nb-NO" },
  { code: "br", label: "Português (Brasil)", tag: "pt-BR" },
  { code: "th", label: "ไทย", tag: "th-TH" },
  { code: "tr", label: "Türkçe", tag: "tr-TR" },
  { code: "uk", label: "Українська", tag: "uk-UA" },
  { code: "bn", label: "বাংলা", tag: "bn-BD" },
  { code: "gr", label: "Ελληνικά", tag: "el-GR" },
  { code: "vi", label: "Tiếng Việt", tag: "vi-VN" },
] as const

export type Locale = (typeof LANGUAGES)[number]["code"]

export const locale = (value?: string | null): Locale => LANGUAGES.find((item) => item.code === value)?.code ?? "ko"
export const intlLocale = (value?: string | null): string => LANGUAGES.find((item) => item.code === locale(value))?.tag ?? "ko-KR"
export const localeDir = (value?: string | null): "ltr" | "rtl" => locale(value) === "ar" ? "rtl" : "ltr"

export function createI18n(language = "ko") {
  const instance = createInstance()
  void instance.use(initReactI18next).init({
    resources: {
      ko: { translation: ko },
      en: { translation: en },
      zh: { translation: zh },
      zht: { translation: zht },
      de: { translation: de },
      es: { translation: es },
      fr: { translation: fr },
      it: { translation: it },
      da: { translation: da },
      ja: { translation: ja },
      pl: { translation: pl },
      ru: { translation: ru },
      bs: { translation: bs },
      ar: { translation: ar },
      no: { translation: no },
      br: { translation: br },
      th: { translation: th },
      tr: { translation: tr },
      uk: { translation: uk },
      bn: { translation: bn },
      gr: { translation: gr },
      vi: { translation: vi },
    },
    lng: locale(language),
    supportedLngs: LANGUAGES.map((item) => item.code),
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
