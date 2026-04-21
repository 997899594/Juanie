import pino from 'pino';

export type LoggerLevel = 'debug' | 'info' | 'warn' | 'error';

type LogContext = Record<string, unknown>;

interface SerializedError {
  name: string;
  message: string;
  stack?: string;
}

export interface Logger {
  child(context: LogContext): Logger;
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, errorOrContext?: unknown, context?: LogContext): void;
}

const LOG_LEVEL_PRIORITY: Record<LoggerLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function resolveLogLevel(): LoggerLevel {
  const configured = (process.env.LOG_LEVEL ?? process.env.JUANIE_LOG_LEVEL ?? 'info')
    .trim()
    .toLowerCase();

  if (configured in LOG_LEVEL_PRIORITY) {
    return configured as LoggerLevel;
  }

  return process.env.NODE_ENV === 'development' ? 'debug' : 'info';
}

function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: 'UnknownError',
    message: String(error),
  };
}

function isPlainContext(value: unknown): value is LogContext {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

const baseLogger = pino({
  base: undefined,
  level: resolveLogLevel(),
  messageKey: 'message',
  formatters: {
    bindings: () => ({}),
    level: (label) => ({ level: label }),
  },
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
});

function createLogger(instance: pino.Logger): Logger {
  return {
    child(childContext: LogContext): Logger {
      return createLogger(instance.child(childContext));
    },
    debug(message: string, messageContext: LogContext = {}): void {
      instance.debug(messageContext, message);
    },
    info(message: string, messageContext: LogContext = {}): void {
      instance.info(messageContext, message);
    },
    warn(message: string, messageContext: LogContext = {}): void {
      instance.warn(messageContext, message);
    },
    error(message: string, errorOrContext?: unknown, messageContext: LogContext = {}): void {
      const mergedContext: LogContext = {
        ...messageContext,
      };

      if (errorOrContext instanceof Error) {
        mergedContext.error = serializeError(errorOrContext);
      } else if (isPlainContext(errorOrContext)) {
        Object.assign(mergedContext, errorOrContext);
      } else if (errorOrContext !== undefined) {
        mergedContext.error = serializeError(errorOrContext);
      }

      instance.error(mergedContext, message);
    },
  };
}

export const logger: Logger = createLogger(baseLogger);
