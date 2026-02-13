import { LoggerInterface, LogLevel, LogTransport } from './LoggerInterface';
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

  // ── Transport management ────────────────────────────────────────────

  /**
   * Register a log transport (Sentry, Datadog, New Relic, etc.).
   * Transports receive every log entry at or above their configured minLevel.
   */
  public addTransport(transport: LogTransport): void {
    if (this.currentLogger instanceof ReactNativeLogger) {
      this.currentLogger.addTransport(transport);
    }
  }

  /**
   * Remove a previously registered transport by name.
   */
  public removeTransport(name: string): void {
    if (this.currentLogger instanceof ReactNativeLogger) {
      this.currentLogger.removeTransport(name);
    }
  }

  /**
   * List currently registered transport names.
   */
  public getTransportNames(): string[] {
    if (this.currentLogger instanceof ReactNativeLogger) {
      return this.currentLogger.getTransportNames();
    }
    return [];
  }
}
