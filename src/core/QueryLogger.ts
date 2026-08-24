import { Logger, QueryRunner } from 'typeorm';
import util from 'util';

function formatParams(parameters?: any[]): string {
  if (!parameters || parameters.length === 0) return '[]';
  try {
    return util.inspect(parameters, { depth: 3, colors: false, maxArrayLength: 20 });
  } catch {
    try {
      return JSON.stringify(parameters);
    } catch {
      return '[unserializable params]';
    }
  }
}

function timestamp(): string {
  return new Date().toISOString();
}

export class QueryLogger implements Logger {
  constructor(private readonly slowQueryMs: number = 500) {}

  logQuery(query: string, parameters?: any[], _queryRunner?: QueryRunner): void {
    // Show queries with bound parameters
    // eslint-disable-next-line no-console
    console.log(`[${timestamp()}] [QUERY] ${query}\n  params: ${formatParams(parameters)}\n`);
  }

  logQueryError(error: string | Error, query: string, parameters?: any[], _queryRunner?: QueryRunner): void {
    // eslint-disable-next-line no-console
    console.error(`[${timestamp()}] [QUERY ERROR] ${query}\n  params: ${formatParams(parameters)}\n  error: ${error instanceof Error ? error.stack || error.message : error}`);
  }

  logQuerySlow(time: number, query: string, parameters?: any[], _queryRunner?: QueryRunner): void {
    // eslint-disable-next-line no-console
    console.warn(`[${timestamp()}] [SLOW QUERY > ${this.slowQueryMs}ms] ${time}ms\n  ${query}\n  params: ${formatParams(parameters)}\n`);
  }

  logSchemaBuild(message: string, _queryRunner?: QueryRunner): void {
    // eslint-disable-next-line no-console
    console.log(`[${timestamp()}] [SCHEMA] ${message}`);
  }

  logMigration(message: string, _queryRunner?: QueryRunner): void {
    // eslint-disable-next-line no-console
    console.log(`[${timestamp()}] [MIGRATION] ${message}`);
  }

  log(level: 'log' | 'info' | 'warn', message: any, _queryRunner?: QueryRunner): void {
    // eslint-disable-next-line no-console
    const line = `[${timestamp()}] [${level.toUpperCase()}] ${typeof message === 'string' ? message : util.inspect(message)}`;
    if (level === 'warn') console.warn(line);
    else console.log(line);
  }
}
