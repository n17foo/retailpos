export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogPayload {
  message: string;
  [key: string]: any;
}

export interface LoggerInterface {
  /**
   * Log debug level information, typically for development/troubleshooting
   */
  debug(payload: LogPayload | string, ...args: any[]): void;

  /**
   * Log informational messages about normal application operation
   */
  info(payload: LogPayload | string, ...args: any[]): void;

  /**
   * Log warning messages that might indicate potential issues
   */
  warn(payload: LogPayload | string, ...args: any[]): void;

  /**
   * Log error messages for application failures
   */
  error(payload: LogPayload | string, error?: Error, ...args: any[]): void;

  /**
   * Set the current logger level
   */
  setLevel(level: LogLevel): void;

  /**
   * Get the current logger level
   */
  getLevel(): LogLevel;

  /**
   * Create a child logger with a specific context (e.g. service name)
   */
  createChild(context: string): LoggerInterface;
}
