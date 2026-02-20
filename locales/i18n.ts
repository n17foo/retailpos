import { initReactI18next } from 'react-i18next';
import i18n, { InitOptions } from 'i18next';
import * as Localization from 'expo-localization';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: {
      translation: typeof import('./en/common.json');
    };
  }
}

// Import translations
import enCommon from './en/common.json';
import esCommon from './es/common.json';
import frCommon from './fr/common.json';
import deCommon from './de/common.json';

// Define supported languages
const LANGUAGES = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
} as const;

export type LanguageCode = keyof typeof LANGUAGES;

export const SUPPORTED_LANGUAGE_CODES: LanguageCode[] = Object.keys(LANGUAGES) as LanguageCode[];

// Create i18n instance
const i18nInstance = i18n.createInstance();

export const initI18n = async () => {
  // Get device language safely inside the init function
  const locales = Localization.getLocales();
  const deviceLanguage = locales?.[0]?.languageCode || 'en';

  const options: InitOptions = {
    resources: {
      en: { translation: enCommon },
      es: { translation: esCommon },
      fr: { translation: frCommon },
      de: { translation: deCommon },
    },
    lng: SUPPORTED_LANGUAGE_CODES.includes(deviceLanguage as LanguageCode) ? deviceLanguage : 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false, // Disable Suspense for React Native
    },
    compatibilityJSON: 'v4' as const,
    parseMissingKeyHandler: (key: string) => {
      console.warn(`Missing translation: ${key}`);
      return key;
    },
  };

  await i18nInstance.use(initReactI18next).init(options);
};

// Initialize i18n
initI18n();

// Helper function to change language
export const changeLanguage = (language: LanguageCode) => {
  return i18nInstance.changeLanguage(language);
};

// Helper to get language name
export const getLanguageName = (code: LanguageCode): string => {
  return LANGUAGES[code] || code;
};

export const availableLanguages = Object.entries(LANGUAGES).map(([code, name]) => ({
  code: code as LanguageCode,
  name,
}));

export default i18nInstance;
