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

function shouldLog(level: LoggerLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[resolveLogLevel()];
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

function writeLog(level: LoggerLevel, message: string, context: LogContext): void {
  if (!shouldLog(level)) {
    return;
  }

  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  const line = JSON.stringify(payload);
  switch (level) {
    case 'debug':
    case 'info':
      console.log(line);
      break;
    case 'warn':
      console.warn(line);
      break;
    case 'error':
      console.error(line);
      break;
  }
}

function createLogger(context: LogContext = {}): Logger {
  return {
    child(childContext: LogContext): Logger {
      return createLogger({
        ...context,
        ...childContext,
      });
    },
    debug(message: string, messageContext: LogContext = {}): void {
      writeLog('debug', message, {
        ...context,
        ...messageContext,
      });
    },
    info(message: string, messageContext: LogContext = {}): void {
      writeLog('info', message, {
        ...context,
        ...messageContext,
      });
    },
    warn(message: string, messageContext: LogContext = {}): void {
      writeLog('warn', message, {
        ...context,
        ...messageContext,
      });
    },
    error(message: string, errorOrContext?: unknown, messageContext: LogContext = {}): void {
      const mergedContext: LogContext = {
        ...context,
        ...messageContext,
      };

      if (errorOrContext instanceof Error) {
        mergedContext.error = serializeError(errorOrContext);
      } else if (isPlainContext(errorOrContext)) {
        Object.assign(mergedContext, errorOrContext);
      } else if (errorOrContext !== undefined) {
        mergedContext.error = serializeError(errorOrContext);
      }

      writeLog('error', message, mergedContext);
    },
  };
}

export const logger: Logger = createLogger();
