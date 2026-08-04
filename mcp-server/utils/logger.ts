import os from 'os';
import path from 'path';
import { AsyncLocalStorage } from 'node:async_hooks';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { LogBuffer } from '@hubspot/local-dev-lib/LogBuffer';
import { MAX_LOG_FILES } from '../../lib/constants.js';

type LoggingLevel =
  | 'debug'
  | 'info'
  | 'notice'
  | 'warning'
  | 'error'
  | 'critical'
  | 'alert'
  | 'emergency';

const MCP_LOG_DIR = path.join(os.homedir(), '.hscli', 'logs', 'tools');

export class McpLogger {
  private mcpServer: McpServer;
  private invocationStorage = new AsyncLocalStorage<LogBuffer>();

  constructor(mcpServer: McpServer) {
    this.mcpServer = mcpServer;
  }

  private log(level: LoggingLevel, logger: string, data: unknown): void {
    try {
      const buffer = this.invocationStorage.getStore();
      if (buffer) {
        const serialized =
          typeof data === 'string' ? data : JSON.stringify(data);
        buffer.record(level, [logger, serialized]);
      }
      this.mcpServer.sendLoggingMessage({ level, logger, data });
    } catch (error) {
      // sendLoggingMessage can throw if no transport is connected or the
      // client doesn't support logging. Write to stderr so failures surface
      // somewhere without corrupting the stdio JSON-RPC stream.
      process.stderr.write(
        `[McpLogger] Failed to send log message: ${error}\n`
      );
    }
  }

  debug(logger: string, data: unknown): void {
    this.log('debug', logger, data);
  }

  info(logger: string, data: unknown): void {
    this.log('info', logger, data);
  }

  warn(logger: string, data: unknown): void {
    this.log('warning', logger, data);
  }

  error(logger: string, data: unknown): void {
    this.log('error', logger, data);
  }

  // Runs fn in a fresh per-invocation log buffer context. All log calls made
  // within fn (including nested async callbacks like progress chunks) record
  // into this buffer rather than a shared one, so concurrent tool calls never
  // intermix their logs.
  runWithBuffer<T>(fn: () => Promise<T>): Promise<T> {
    return this.invocationStorage.run(new LogBuffer(), fn);
  }

  flushLogsToFile(filenamePrefix: string): string | null {
    const buffer = this.invocationStorage.getStore();
    if (!buffer) {
      return null;
    }
    return buffer.writeToFile({
      dir: MCP_LOG_DIR,
      filenamePrefix,
      maxFiles: MAX_LOG_FILES,
    });
  }
}
