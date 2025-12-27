import { useEffect, useMemo } from 'react';
import { LoggerFactory } from '../services/logger/loggerFactory';
import { LoggerInterface } from '../services/logger/LoggerInterface';

/**
 * React hook for accessing the logger with a component-specific context
 * @param context The context name (usually the component name)
 * @returns A logger instance with the specified context
 */
export const useLogger = (context: string): LoggerInterface => {
  const logger = useMemo(() => {
    return LoggerFactory.getInstance().createLogger(context);
  }, [context]);

  // Attach logger to component lifecycle (optional, for debugging)
  useEffect(() => {
    if (__DEV__) {
      logger.debug('Component mounted');
      return () => logger.debug('Component unmounted');
    }
  }, [logger]);

  return logger;
};
