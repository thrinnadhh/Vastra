import type { LoggerService } from '@nestjs/common';

type StructuredLogLevel = 'debug' | 'error' | 'fatal' | 'info' | 'trace' | 'warn';

interface StructuredLogEntry {
  readonly timestamp: string;
  readonly level: StructuredLogLevel;
  readonly service: 'vastra-backend';
  readonly message: unknown;
  readonly context?: string;
  readonly stack?: string;
}

function readContext(optionalParameters: readonly unknown[]): string | undefined {
  const candidate = optionalParameters.at(-1);
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : undefined;
}

export class StructuredLogger implements LoggerService {
  public log(message: unknown, ...optionalParameters: unknown[]): void {
    this.write('info', message, readContext(optionalParameters));
  }

  public error(message: unknown, ...optionalParameters: unknown[]): void {
    const stack = optionalParameters.find(
      (candidate): candidate is string =>
        typeof candidate === 'string' && candidate.includes('\n') && candidate.includes(' at '),
    );

    this.write('error', message, readContext(optionalParameters), stack);
  }

  public warn(message: unknown, ...optionalParameters: unknown[]): void {
    this.write('warn', message, readContext(optionalParameters));
  }

  public debug(message: unknown, ...optionalParameters: unknown[]): void {
    this.write('debug', message, readContext(optionalParameters));
  }

  public verbose(message: unknown, ...optionalParameters: unknown[]): void {
    this.write('trace', message, readContext(optionalParameters));
  }

  public fatal(message: unknown, ...optionalParameters: unknown[]): void {
    this.write('fatal', message, readContext(optionalParameters));
  }

  private write(
    level: StructuredLogLevel,
    message: unknown,
    context?: string,
    stack?: string,
  ): void {
    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: 'vastra-backend',
      message,
      ...(context === undefined ? {} : { context }),
      ...(stack === undefined ? {} : { stack }),
    };

    const destination = level === 'error' || level === 'fatal' ? process.stderr : process.stdout;
    destination.write(`${JSON.stringify(entry)}\n`);
  }
}
