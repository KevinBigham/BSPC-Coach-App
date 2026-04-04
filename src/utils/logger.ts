type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL: LogLevel = __DEV__ ? 'debug' : 'warn';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL];
}

function createEntry(level: LogLevel, message: string, data?: Record<string, unknown>): LogEntry {
  return {
    level,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
}

function emit(entry: LogEntry): void {
  if (__DEV__) {
    const prefix = `[${entry.level.toUpperCase()}]`;
    const args: unknown[] = [prefix, entry.message];
    if (entry.data) args.push(entry.data);

    switch (entry.level) {
      case 'debug':
        console.debug(...args);
        break;
      case 'info':
        console.info(...args);
        break;
      case 'warn':
        console.warn(...args);
        break;
      case 'error':
        console.error(...args);
        break;
    }
  }

  // In production, Sentry breadcrumbs would be added here:
  // Sentry.addBreadcrumb({ category: 'log', message: entry.message, level: entry.level, data: entry.data });
}

export const logger = {
  debug(message: string, data?: Record<string, unknown>) {
    if (shouldLog('debug')) emit(createEntry('debug', message, data));
  },
  info(message: string, data?: Record<string, unknown>) {
    if (shouldLog('info')) emit(createEntry('info', message, data));
  },
  warn(message: string, data?: Record<string, unknown>) {
    if (shouldLog('warn')) emit(createEntry('warn', message, data));
  },
  error(message: string, data?: Record<string, unknown>) {
    if (shouldLog('error')) emit(createEntry('error', message, data));
  },
};
