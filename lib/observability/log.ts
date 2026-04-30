type LogLevel = 'info' | 'warn' | 'error';

export interface LogContext {
  requestId?: string;
  route?: string;
  code?: string;
  userId?: string;
  tenantId?: string;
  [key: string]: unknown;
}

function write(level: LogLevel, message: string, context?: LogContext) {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context ?? {}),
  };

  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.log(line);
}

export function logInfo(message: string, context?: LogContext) {
  write('info', message, context);
}

export function logWarn(message: string, context?: LogContext) {
  write('warn', message, context);
}

export function logError(message: string, context?: LogContext) {
  write('error', message, context);
}
