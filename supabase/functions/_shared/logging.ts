type LogLevel = 'info' | 'warn' | 'error';

interface LogPayload {
  message: string;
  component: string;
  trace_id?: string;
  context?: Record<string, unknown>;
}

const writeLog = (level: LogLevel, payload: LogPayload) => {
  const entry = {
    level,
    timestamp: new Date().toISOString(),
    ...payload,
  };

  if (level === 'error') {
    console.error(JSON.stringify(entry));
    return;
  }

  if (level === 'warn') {
    console.warn(JSON.stringify(entry));
    return;
  }

  console.log(JSON.stringify(entry));
};

export const logInfo = (payload: LogPayload) => writeLog('info', payload);
export const logWarn = (payload: LogPayload) => writeLog('warn', payload);
export const logError = (payload: LogPayload) => writeLog('error', payload);
