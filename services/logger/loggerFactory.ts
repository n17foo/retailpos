import { LoggerInterface, LogLevel } from './LoggerInterface';
import { ReactNativeLogger } from './ReactNativeLogger';

/**
 * Logger factory that provides access to the current active logger service
 */
export class LoggerFactory {
  private static instance: LoggerFactory;
  private currentLogger: LoggerInterface;
  private defaultLevel: LogLevel = LogLevel.INFO;

  private constructor() {
    // Initialize with ReactNativeLogger as the default implementation
    this.currentLogger = new ReactNativeLogger('App', this.defaultLevel);
  }

  /**
   * Get the singleton instance of the LoggerFactory
   */
  public static getInstance(): LoggerFactory {
    if (!LoggerFactory.instance) {
      LoggerFactory.instance = new LoggerFactory();
    }
    return LoggerFactory.instance;
  }

  /**
   * Get the current logger instance
   */
  public getLogger(): LoggerInterface {
    return this.currentLogger;
  }

  /**
   * Create a child logger with a specific context
   * @param context The context name (e.g., service or component name)
   */
  public createLogger(context: string): LoggerInterface {
    return this.currentLogger.createChild(context);
  }

  /**
   * Set the global log level for all loggers
   * @param level The log level to set
   */
  public setGlobalLogLevel(level: LogLevel): void {
    this.defaultLevel = level;
    this.currentLogger.setLevel(level);
  }

  /**
   * Configure the logger with a custom implementation
   * @param logger A custom logger implementation
   */
  public setLogger(logger: LoggerInterface): void {
    this.currentLogger = logger;
  }
}
