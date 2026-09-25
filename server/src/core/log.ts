/** Structured JSON logs (one JSON object per line). */
export type LogFields = Record<string, unknown>;

export interface Logger {
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
}

export function createLogger(sink: (line: string) => void = (line) => console.log(line)): Logger {
  const write = (level: string, event: string, fields?: LogFields) => {
    const safe: LogFields = {};
    for (const [k, v] of Object.entries(fields ?? {})) safe[k] = v instanceof Error ? errorInfo(v) : v;
    sink(JSON.stringify({ ts: new Date().toISOString(), level, event, ...safe }));
  };
  return {
    info: (e, f) => write('info', e, f),
    warn: (e, f) => write('warn', e, f),
    error: (e, f) => write('error', e, f),
  };
}

export function errorInfo(e: unknown): { message: string; stack?: string } {
  if (e instanceof Error) return { message: e.message, stack: e.stack };
  return { message: String(e) };
}

export const silentLogger: Logger = { info() {}, warn() {}, error() {} };
