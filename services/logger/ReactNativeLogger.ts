import { logger, consoleTransport } from 'react-native-logs';
import { LoggerInterface, LogLevel, LogPayload, LogTransport, LogEntry } from './LoggerInterface';

export class ReactNativeLogger implements LoggerInterface {
  private logger: any;
  private context: string;
  private currentLevel: LogLevel;
  private transports: LogTransport[] = [];

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
    const message = typeof payload === 'string' ? payload : payload.message;
    const metadata = typeof payload === 'string' ? undefined : (({ message: _m, ...rest }) => rest)(payload);
    if (typeof payload === 'string') {
      this.logger.debug(`[${this.context}] ${payload}`, ...args);
    } else {
      const { message: _m, ...rest } = payload;
      this.logger.debug(`[${this.context}] ${_m}`, { ...rest, ...args });
    }
    this.forward(LogLevel.DEBUG, message, undefined, metadata);
  }

  info(payload: LogPayload | string, ...args: any[]): void {
    const message = typeof payload === 'string' ? payload : payload.message;
    const metadata = typeof payload === 'string' ? undefined : (({ message: _m, ...rest }) => rest)(payload);
    if (typeof payload === 'string') {
      this.logger.info(`[${this.context}] ${payload}`, ...args);
    } else {
      const { message: _m, ...rest } = payload;
      this.logger.info(`[${this.context}] ${_m}`, { ...rest, ...args });
    }
    this.forward(LogLevel.INFO, message, undefined, metadata);
  }

  warn(payload: LogPayload | string, ...args: any[]): void {
    const message = typeof payload === 'string' ? payload : payload.message;
    const metadata = typeof payload === 'string' ? undefined : (({ message: _m, ...rest }) => rest)(payload);
    if (typeof payload === 'string') {
      this.logger.warn(`[${this.context}] ${payload}`, ...args);
    } else {
      const { message: _m, ...rest } = payload;
      this.logger.warn(`[${this.context}] ${_m}`, { ...rest, ...args });
    }
    this.forward(LogLevel.WARN, message, undefined, metadata);
  }

  error(payload: LogPayload | string, error?: Error, ...args: any[]): void {
    const message = typeof payload === 'string' ? payload : payload.message;
    const metadata = typeof payload === 'string' ? undefined : (({ message: _m, ...rest }) => rest)(payload);
    if (typeof payload === 'string') {
      const errorDetails = error ? { error: error.message, stack: error.stack } : {};
      this.logger.error(`[${this.context}] ${payload}`, { ...errorDetails, ...args });
    } else {
      const { message: _m, ...rest } = payload;
      const errorDetails = error ? { error: error.message, stack: error.stack } : {};
      this.logger.error(`[${this.context}] ${_m}`, { ...rest, ...errorDetails, ...args });
    }
    this.forward(LogLevel.ERROR, message, error, metadata);
  }

  setLevel(level: LogLevel): void {
    this.currentLevel = level;
    this.logger.setSeverity(this.mapLogLevel(level));
  }

  getLevel(): LogLevel {
    return this.currentLevel;
  }

  createChild(context: string): LoggerInterface {
    const child = new ReactNativeLogger(`${this.context}:${context}`, this.currentLevel);
    // Share transports with child loggers
    child.transports = this.transports;
    return child;
  }

  // ── Transport management ────────────────────────────────────────────

  addTransport(transport: LogTransport): void {
    this.transports.push(transport);
  }

  removeTransport(name: string): void {
    this.transports = this.transports.filter(t => t.name !== name);
  }

  getTransportNames(): string[] {
    return this.transports.map(t => t.name);
  }

  private forward(level: LogLevel, message: string, error?: Error, metadata?: Record<string, unknown>): void {
    if (this.transports.length === 0) return;

    const entry: LogEntry = {
      level,
      context: this.context,
      message,
      error,
      metadata,
      timestamp: new Date(),
    };

    const levelOrder = { [LogLevel.DEBUG]: 0, [LogLevel.INFO]: 1, [LogLevel.WARN]: 2, [LogLevel.ERROR]: 3 };

    for (const transport of this.transports) {
      const minLevel = transport.minLevel ?? LogLevel.DEBUG;
      if (levelOrder[level] >= levelOrder[minLevel]) {
        try {
          transport.log(entry);
        } catch {
          // Never let a broken transport crash the app
        }
      }
    }
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
