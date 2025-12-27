export * from './LoggerInterface';
export * from './ReactNativeLogger';
export * from './loggerFactory';

// Export a default logger instance for quick imports
import { LoggerFactory } from './loggerFactory';

// Export commonly used logger instances
export const logger = LoggerFactory.getInstance().getLogger();

// Export convenience functions for direct use
export const debug = (message: string, ...args: any[]) => logger.debug(message, ...args);
export const info = (message: string, ...args: any[]) => logger.info(message, ...args);
export const warn = (message: string, ...args: any[]) => logger.warn(message, ...args);
export const error = (message: string, error?: Error, ...args: any[]) => logger.error(message, error, ...args);
