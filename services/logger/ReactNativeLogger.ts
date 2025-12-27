import { logger, consoleTransport } from 'react-native-logs';
import { LoggerInterface, LogLevel, LogPayload } from './LoggerInterface';

export class ReactNativeLogger implements LoggerInterface {
  private logger: any;
  private context: string;
  private currentLevel: LogLevel;

  constructor(context: string = 'App', level: LogLevel = LogLevel.INFO) {
    this.context = context;
    this.currentLevel = level;

    // Define color types explicitly to match react-native-logs expected type
    type ColorType =
      | 'default'
      | 'black'
      | 'red'
      | 'green'
      | 'yellow'
      | 'blue'
      | 'magenta'
      | 'cyan'
      | 'white'
      | 'grey'
      | 'redBright'
      | 'greenBright'
      | 'yellowBright'
      | 'blueBright'
      | 'magentaBright'
      | 'cyanBright'
      | 'whiteBright';

    const loggerConfig = {
      enabled: __DEV__,
      transport: consoleTransport,
      transportOptions: {
        colors: {
          debug: 'blueBright' as ColorType,
          info: 'greenBright' as ColorType,
          warn: 'yellowBright' as ColorType,
          error: 'redBright' as ColorType,
        },
      },
      severity: this.mapLogLevel(level).toString(),
      async: true,
      dateFormat: 'time',
      printLevel: true,
      printDate: true,
    };

    this.logger = logger.createLogger(loggerConfig);
  }

  debug(payload: LogPayload | string, ...args: any[]): void {
    if (typeof payload === 'string') {
      this.logger.debug(`[${this.context}] ${payload}`, ...args);
    } else {
      const { message, ...rest } = payload;
      this.logger.debug(`[${this.context}] ${message}`, { ...rest, ...args });
    }
  }

  info(payload: LogPayload | string, ...args: any[]): void {
    if (typeof payload === 'string') {
      this.logger.info(`[${this.context}] ${payload}`, ...args);
    } else {
      const { message, ...rest } = payload;
      this.logger.info(`[${this.context}] ${message}`, { ...rest, ...args });
    }
  }

  warn(payload: LogPayload | string, ...args: any[]): void {
    if (typeof payload === 'string') {
      this.logger.warn(`[${this.context}] ${payload}`, ...args);
    } else {
      const { message, ...rest } = payload;
      this.logger.warn(`[${this.context}] ${message}`, { ...rest, ...args });
    }
  }

  error(payload: LogPayload | string, error?: Error, ...args: any[]): void {
    if (typeof payload === 'string') {
      const errorDetails = error ? { error: error.message, stack: error.stack } : {};
      this.logger.error(`[${this.context}] ${payload}`, { ...errorDetails, ...args });
    } else {
      const { message, ...rest } = payload;
      const errorDetails = error ? { error: error.message, stack: error.stack } : {};
      this.logger.error(`[${this.context}] ${message}`, { ...rest, ...errorDetails, ...args });
    }
  }

  setLevel(level: LogLevel): void {
    this.currentLevel = level;
    this.logger.setSeverity(this.mapLogLevel(level));
  }

  getLevel(): LogLevel {
    return this.currentLevel;
  }

  createChild(context: string): LoggerInterface {
    return new ReactNativeLogger(`${this.context}:${context}`, this.currentLevel);
  }

  private mapLogLevel(level: LogLevel): number {
    switch (level) {
      case LogLevel.DEBUG:
        return 0;
      case LogLevel.INFO:
        return 1;
      case LogLevel.WARN:
        return 2;
      case LogLevel.ERROR:
        return 3;
      default:
        return 1; // Default to INFO
    }
  }
}
