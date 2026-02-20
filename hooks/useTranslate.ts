import { useTranslation } from 'react-i18next';
import { LoggerFactory } from '../services/logger/LoggerFactory';

/**
 * Custom hook that wraps i18next's useTranslation to provide enhanced translation
 * functionality with logging and fallback handling
 *
 * @param namespace Optional namespace for translations
 * @param options Optional i18next translation options
 * @returns Enhanced translation utilities
 */
export const useTranslate = () => {
  // Get the logger for translations
  const logger = LoggerFactory.getInstance().createLogger('Translations');

  // Get the original translation hook functionality
  const { t, i18n, ready } = useTranslation();

  /**
   * Enhanced translate function with additional error handling and logging
   *
   * @param key Translation key
   * @param params Optional parameters for interpolation
   * @returns Translated string
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- react-i18next t() has complex overloads
  const translate = (key: string, options?: any): string => {
    // Get the translation
    const translated = t(key, options);

    // Check if the translation is the same as the key (which indicates missing translation)
    if (translated === key && key.indexOf(':') < 0 && key.indexOf('.') < 0) {
      // Log the missing translation in development
      if (__DEV__) {
        logger.warn(`Missing translation for key: "${key}"`, {
          currentLanguage: i18n.language,
        });
      }
    }

    return translated;
  };

  /**
   * Gets the current language code
   *
   * @returns Current active language code
   */
  const getCurrentLanguage = (): string => {
    return i18n.language;
  };

  /**
   * Change the current language
   *
   * @param language Language code to change to
   * @returns Promise that resolves when language is changed
   */
  const changeLanguage = async (language: string): Promise<void> => {
    logger.info(`Changing language to: ${language}`);
    await i18n.changeLanguage(language);
  };

  /**
   * Check if the current language is right-to-left
   *
   * @returns boolean indicating if current language is RTL
   */
  const isRTL = (): boolean => {
    const language = i18n.language;
    return (
      language.startsWith('ar') || // Arabic
      language.startsWith('he') || // Hebrew
      language.startsWith('fa') // Farsi
    );
  };

  return {
    t: translate,
    i18n,
    ready,
    getCurrentLanguage,
    changeLanguage,
    isRTL,
  };
};
